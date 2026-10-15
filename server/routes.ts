import { Router, Request, Response } from 'express';
import { db } from './db';
import { mysqlEngine } from './mysql';
import { WSAction, UserProfile } from '../src/types/ipam';
import { parseCIDR } from '../src/utils/ipCalculator';

const SESSION_COOKIE_NAME = 'ipam_session_token';
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  // Secure in production unless COOKIE_SECURE=false (plain-HTTP deployments); dev runs on http://localhost.
  secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// Browsers sign in with the session cookie; scripts send `Authorization: Bearer <session token or API key>`.
function getSessionUser(req: Request): UserProfile | null {
  const token = getSessionToken(req);
  return db.getUserBySession(token) || db.getUserByApiKey(token);
}

// Only what other engineers need to see; never API keys or contact details.
const publicUser = (u: UserProfile) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  department: u.department,
  access: u.access,
  datacenterIds: u.datacenterIds,
});

// What the admin panel lists: account and permissions, no profile details or key material.
const adminView = (u: UserProfile) => ({ ...publicUser(u), status: u.status, createdAt: u.createdAt });

// Writes that touch no datacenter; anything else that isn't matched below is admin-only.
const PERSONAL_WRITES = new Set(['/db/retry', '/auth/signin', '/auth/signout', '/auth/signup', '/user/profile', '/user/generate-api-key']);

// The datacenters a write changes (old and new, for moves), or 'admin' when only admins may make it.
function datacentersTouched(req: Request): string[] | 'admin' {
  const body = req.body ?? {};
  const dcOfSubnet = (id?: string) => (id ? db.getSubnetById(id)?.datacenterId : undefined);
  let m: RegExpExecArray | null;
  let ids: (string | undefined)[];
  if (PERSONAL_WRITES.has(req.path)) ids = [];
  else if (req.path === '/vlans') ids = [body.datacenterId];
  else if ((m = /^\/vlans\/([^/]+)$/.exec(req.path))) ids = [db.getVlanById(m[1])?.datacenterId, body.datacenterId];
  else if (req.path === '/subnets') ids = [body.datacenterId];
  else if ((m = /^\/subnets\/([^/]+)(?:\/(?:reserve-next-ip|bulk-generate-ips))?$/.exec(req.path))) ids = [dcOfSubnet(m[1]), body.datacenterId];
  else if (req.path === '/ips') ids = [dcOfSubnet(body.subnetId)];
  else if ((m = /^\/ips\/([^/]+)$/.exec(req.path))) ids = [dcOfSubnet(db.getIPById(m[1])?.subnetId), dcOfSubnet(body.subnetId)];
  else return 'admin';
  // Unknown records drop out here; the handler then answers "not found" as before.
  return ids.filter((id): id is string => !!id);
}

const PUBLIC_PATHS = new Set(['/health', '/db/retry', '/bootstrap', '/auth/me', '/auth/signin', '/auth/signout', '/auth/signup']);

function getSessionToken(req: Request): string | undefined {
  return req.cookies?.[SESSION_COOKIE_NAME] || 
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);
}

export function createApiRouter(broadcast: (type: WSAction, payload: any) => void): Router {
  const router = Router();

  router.use((req: Request, res: Response, next) => {
    if (PUBLIC_PATHS.has(req.path) || getSessionUser(req)) return next();
    res.status(401).json({ success: false, error: 'Authentication required' });
  });

  // Everyone signed in can read everything. Members change only what is in their datacenters;
  // datacenters themselves and accounts are admin-only.
  router.use((req: Request, res: Response, next) => {
    if (PUBLIC_PATHS.has(req.path)) return next();
    const user = getSessionUser(req)!;
    if (user.access === 'admin') return next();
    if (req.path.startsWith('/admin')) return res.status(403).json({ success: false, error: 'Only admins can do this.' });
    if (req.method === 'GET') return next();
    const touched = datacentersTouched(req);
    if (touched === 'admin') return res.status(403).json({ success: false, error: 'Only admins can do this.' });
    const denied = touched.find((dcId) => !db.canEditDatacenter(user, dcId));
    if (!denied) return next();
    res.status(403).json({ success: false, error: `You don't have edit rights in ${db.getDatacenterById(denied)?.name ?? 'this datacenter'}.` });
  });

  // Health check
  router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // MySQL Database status & connection retry
  router.get('/db/status', async (req: Request, res: Response) => {
    try {
      const mysqlStatus = await mysqlEngine.getStatus();
      res.json({
        success: true,
        data: {
          storageEngine: 'MySQL Relational Database Engine',
          mysql: mysqlStatus,
          connected: db.isDatabaseConnected(),
          error: db.getDatabaseError(),
          configFile: 'config/mysql.config.json',
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Re-read /config/mysql.config.json and attempt reconnection
  router.post('/db/retry', async (req: Request, res: Response) => {
    try {
      const result = await db.retryConnection();
      if (result.success) {
        broadcast('INIT_STATE', {
          datacenters: db.getDatacenters(),
          vlans: db.getVlans(),
          subnets: db.getSubnets(),
          ips: db.getIPs(),
          stats: db.getStats(),
        });
        res.json({
          success: true,
          dbConnected: true,
          message: 'Successfully reconnected to MySQL database',
        });
      } else {
        const cfg = mysqlEngine.getConfig();
        res.json({
          success: false,
          dbConnected: false,
          error: result.error || 'Connection failed',
          dbError: result.error || 'Connection failed',
          config: {
            host: cfg?.host || 'localhost',
            port: cfg?.port || 3306,
            database: cfg?.database || 'ipam_db',
            user: cfg?.user || 'ipam_user',
            configFile: 'config/mysql.config.json',
          },
        });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Full bootstrap state
  router.get('/bootstrap', async (req: Request, res: Response) => {
    try {
      if (!db.isDatabaseConnected()) {
        // Attempt to connect using the latest config on disk
        await db.retryConnection();
      }

      if (!db.isDatabaseConnected()) {
        const cfg = mysqlEngine.getConfig();
        const dbErr = db.getDatabaseError() || 'Could not connect to MySQL server';
        res.json({
          success: false,
          dbConnected: false,
          error: `Database Connection Error: ${dbErr}. Please verify /config/mysql.config.json.`,
          dbError: dbErr,
          config: {
            host: cfg?.host || 'localhost',
            port: cfg?.port || 3306,
            database: cfg?.database || 'ipam_db',
            user: cfg?.user || 'beyondip',
            configFile: 'config/mysql.config.json',
          },
        });
        return;
      }

      const currentUser = getSessionUser(req);
      if (!currentUser) {
        res.json({ success: true, dbConnected: true, data: { currentUser: null } });
        return;
      }

      const datacenters = db.getDatacenters();
      const vlans = db.getVlans();
      const subnets = db.getSubnets();
      const ips = db.getIPs();
      const stats = db.getStats();
      const activityLogs = db.getActivityLogs();
      res.json({
        success: true,
        dbConnected: true,
        data: {
          datacenters,
          vlans,
          subnets,
          ips,
          stats,
          activityLogs,
          currentUser,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Stats
  router.get('/stats', (req: Request, res: Response) => {
    try {
      const stats = db.getStats();
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Global search
  router.get('/search', (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || '';
      const results = db.search(query);
      res.json({ success: true, data: results });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Activity logs
  router.get('/logs', (req: Request, res: Response) => {
    try {
      const logs = db.getActivityLogs();
      res.json({ success: true, data: logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- DATACENTER ROUTES ---
  router.get('/datacenters', (req: Request, res: Response) => {
    try {
      const datacenters = db.getDatacenters();
      res.json({ success: true, data: datacenters });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/datacenters/:id', (req: Request, res: Response) => {
    try {
      const dc = db.getDatacenterById(req.params.id);
      if (!dc) return res.status(404).json({ success: false, error: 'Datacenter not found' });
      res.json({ success: true, data: dc });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/datacenters', async (req: Request, res: Response) => {
    try {
      const { name, location, description } = req.body;
      const created = await db.persisted(() => db.createDatacenter({ name, location, description }));
      broadcast('DATACENTER_CREATED', created);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  router.put('/datacenters/:id', async (req: Request, res: Response) => {
    try {
      const updated = await db.persisted(() => db.updateDatacenter(req.params.id, req.body));
      broadcast('DATACENTER_UPDATED', updated);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  router.delete('/datacenters/:id', async (req: Request, res: Response) => {
    try {
      const result = await db.persisted(() => db.deleteDatacenter(req.params.id));
      broadcast('DATACENTER_DELETED', { id: req.params.id });
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  // --- VLAN ROUTES ---
  router.get('/vlans/options', (req: Request, res: Response) => {
    try {
      const options = db.getVlanOptions();
      res.json({ success: true, data: options });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/vlans', (req: Request, res: Response) => {
    try {
      const datacenterId = req.query.datacenterId as string | undefined;
      const vlans = db.getVlans(datacenterId);
      res.json({ success: true, data: vlans });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/vlans/:id', (req: Request, res: Response) => {
    try {
      const vlan = db.getVlanById(req.params.id);
      if (!vlan) return res.status(404).json({ success: false, error: 'VLAN not found' });
      res.json({ success: true, data: vlan });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/vlans', async (req: Request, res: Response) => {
    try {
      const created = await db.persisted(() => db.createVlan(req.body));
      const dc = db.getDatacenterById(created.datacenterId);
      broadcast('VLAN_CREATED', created);
      res.status(201).json({
        success: true,
        message: `VLAN ${created.vlanId} ("${created.name}") created successfully in Datacenter "${dc?.name || created.datacenterId}".`,
        data: {
          ...created,
          datacenter: dc ? { id: dc.id, name: dc.name, location: dc.location } : undefined,
        },
      });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  router.put('/vlans/:id', async (req: Request, res: Response) => {
    try {
      const updated = await db.persisted(() => db.updateVlan(req.params.id, req.body));
      broadcast('VLAN_UPDATED', updated);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  router.delete('/vlans/:id', async (req: Request, res: Response) => {
    try {
      const result = await db.persisted(() => db.deleteVlan(req.params.id));
      broadcast('VLAN_DELETED', { id: req.params.id });
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  // --- SUBNET ROUTES ---
  router.get('/subnets/options', (req: Request, res: Response) => {
    try {
      const options = db.getSubnetOptions();
      res.json({ success: true, data: options });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/subnets', (req: Request, res: Response) => {
    try {
      const { datacenterId, vlanId, segmentType } = req.query;
      const subnets = db.getSubnets({
        datacenterId: datacenterId as string,
        vlanId: vlanId as string,
        segmentType: segmentType as any,
      });
      res.json({ success: true, data: subnets });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/subnets/:id', (req: Request, res: Response) => {
    try {
      const subnet = db.getSubnetById(req.params.id);
      if (!subnet) return res.status(404).json({ success: false, error: 'Subnet not found' });
      res.json({ success: true, data: subnet });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/subnets', async (req: Request, res: Response) => {
    try {
      const created = await db.persisted(() => db.createSubnet(req.body));
      const dc = db.getDatacenterById(created.datacenterId);
      const vlan = created.vlanId ? db.getVlanById(created.vlanId) : null;
      let calculation: any = null;
      try {
        const calc = parseCIDR(created.cidr);
        calculation = {
          cidr: calc.cidr,
          ipVersion: calc.ipVersion,
          netmask: calc.netmask,
          networkAddress: calc.networkAddress,
          broadcastAddress: calc.broadcastAddress,
          firstUsableHost: calc.firstUsableHost,
          lastUsableHost: calc.lastUsableHost,
          totalHosts: calc.totalHosts,
          usableHosts: calc.usableHosts,
          usableHostsFormatted: calc.usableHostsFormatted,
          isPrivate: calc.isPrivate,
        };
      } catch {
        // Fallback
      }

      broadcast('SUBNET_CREATED', created);
      res.status(201).json({
        success: true,
        message: `Subnet ${created.cidr} (${created.segmentType}) allocated successfully in Datacenter "${dc?.name || created.datacenterId}".`,
        data: {
          ...created,
          datacenter: dc ? { id: dc.id, name: dc.name, location: dc.location } : undefined,
          vlan: vlan ? { id: vlan.id, vlanId: vlan.vlanId, name: vlan.name } : null,
          calculation,
        },
      });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  router.put('/subnets/:id', async (req: Request, res: Response) => {
    try {
      const updated = await db.persisted(() => db.updateSubnet(req.params.id, req.body));
      broadcast('SUBNET_UPDATED', updated);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  router.delete('/subnets/:id', async (req: Request, res: Response) => {
    try {
      const result = await db.persisted(() => db.deleteSubnet(req.params.id));
      broadcast('SUBNET_DELETED', { id: req.params.id });
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  // Next Available IP
  router.get('/subnets/:id/next-available-ip', (req: Request, res: Response) => {
    try {
      const result = db.getNextAvailableIP(req.params.id);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  // Reserve Next Available IP
  router.post('/subnets/:id/reserve-next-ip', async (req: Request, res: Response) => {
    try {
      const { assignedDevice, description } = req.body;
      const reserved = await db.persisted(() => db.reserveNextAvailableIP(req.params.id, { assignedDevice, description }));
      broadcast('IP_CREATED', reserved);
      res.status(201).json({ success: true, data: reserved });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  // Bulk Generate IPs in Subnet
  router.post('/subnets/:id/bulk-generate-ips', async (req: Request, res: Response) => {
    try {
      const { count, startingOffset, status } = req.body;
      const result = await db.persisted(() => db.bulkGenerateIPs(req.params.id, { count, startingOffset, status }));
      broadcast('BULK_IPS_CREATED', { subnetId: req.params.id, created: result.created });
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  // --- IP ADDRESS ROUTES ---
  router.get('/ips', (req: Request, res: Response) => {
    try {
      const { subnetId, datacenterId, status, search } = req.query;
      const ips = db.getIPs({
        subnetId: subnetId as string,
        datacenterId: datacenterId as string,
        status: status as any,
        search: search as string,
      });
      res.json({ success: true, data: ips });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/ips/:id', (req: Request, res: Response) => {
    try {
      const ip = db.getIPById(req.params.id);
      if (!ip) return res.status(404).json({ success: false, error: 'IP address record not found' });
      res.json({ success: true, data: ip });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/ips', async (req: Request, res: Response) => {
    try {
      const { ipAddress, subnetId, status, assignedDevice, description } = req.body;
      const created = await db.persisted(() => db.createIP({ ipAddress, subnetId, status, assignedDevice, description }));
      broadcast('IP_CREATED', created);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  router.put('/ips/:id', async (req: Request, res: Response) => {
    try {
      const updated = await db.persisted(() => db.updateIP(req.params.id, req.body));
      broadcast('IP_UPDATED', updated);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  router.delete('/ips/:id', async (req: Request, res: Response) => {
    try {
      const result = await db.persisted(() => db.deleteIP(req.params.id));
      broadcast('IP_DELETED', { id: req.params.id, ipAddress: result.ipAddress });
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  // --- USER PROFILE & AUTHENTICATION ROUTES (COOKIE-BASED SESSIONS) ---
  router.get('/user/current', (req: Request, res: Response) => {
    try {
      const user = getSessionUser(req);
      if (!user) {
        return res.status(401).json({ success: false, authenticated: false, error: 'No active session' });
      }
      res.json({ success: true, authenticated: true, data: user });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/auth/me', (req: Request, res: Response) => {
    try {
      const user = getSessionUser(req);
      if (!user) {
        return res.json({ success: false, authenticated: false, user: null });
      }
      res.json({ success: true, authenticated: true, user });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.put('/user/profile', async (req: Request, res: Response) => {
    try {
      const currentUser = getSessionUser(req);
      if (!currentUser) return res.status(401).json({ success: false, error: 'No authenticated user session found' });
      const updated = await db.persisted(() => db.updateUserProfile(currentUser.id, req.body));
      broadcast('USER_UPDATED', publicUser(updated));
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  router.get('/users', (req: Request, res: Response) => {
    try {
      const users = db.getUsers().map(publicUser);
      res.json({ success: true, data: users });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/auth/signin', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const { user, session } = await db.persisted(() => db.signIn(email, password));
      res.cookie(SESSION_COOKIE_NAME, session.token, SESSION_COOKIE_OPTIONS);
      res.json({ success: true, data: { user } });
    } catch (err: any) {
      res.status(err.status ?? 401).json({ success: false, error: err.message });
    }
  });

  router.post('/auth/signout', async (req: Request, res: Response) => {
    try {
      const token = getSessionToken(req);
      await db.persisted(() => db.signOutSession(token));
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      res.json({ success: true, message: 'Signed out successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/auth/signup', async (req: Request, res: Response) => {
    try {
      const { name, email, password, role, department, organization, location, phone, bio, primaryDatacenterId } = req.body;
      const user = await db.persisted(() =>
        db.createUser({ name, email, password, role, department, organization, location, phone, bio, primaryDatacenterId }),
      );
      // A request, not a sign-in: no session until an admin approves it.
      res.status(201).json({ success: true, data: { pending: true, email: user.email } });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  // --- ADMIN: accounts and permissions (guarded above) ---
  router.get('/admin/users', (req: Request, res: Response) => {
    res.json({ success: true, data: db.getUsers().map(adminView) });
  });

  router.put('/admin/users/:id', async (req: Request, res: Response) => {
    try {
      const { access, status, datacenterIds } = req.body ?? {};
      const actor = getSessionUser(req)!;
      const updated = await db.persisted(() => db.updateUserAccess(actor.id, req.params.id, { access, status, datacenterIds }));
      broadcast('USER_UPDATED', publicUser(updated));
      res.json({ success: true, data: adminView(updated) });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  router.delete('/admin/users/:id', async (req: Request, res: Response) => {
    try {
      const actor = getSessionUser(req)!;
      await db.persisted(() => db.deleteUser(actor.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  router.post('/user/generate-api-key', async (req: Request, res: Response) => {
    try {
      // Only a signed-in browser may mint keys, so a leaked key can't replace itself and lock the owner out.
      const currentUser = db.getUserBySession(req.cookies?.[SESSION_COOKIE_NAME]);
      if (!currentUser) return res.status(401).json({ success: false, error: 'Sign in to the web app to create an API key' });
      const apiKey = await db.persisted(() => db.generateApiKey(currentUser.id));
      const updated = db.getUserById(currentUser.id);
      res.json({ success: true, data: { apiKey, user: updated } });
    } catch (err: any) {
      res.status(err.status ?? 400).json({ success: false, error: err.message });
    }
  });

  return router;
}
