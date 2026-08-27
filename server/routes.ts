import { Router, Request, Response } from 'express';
import { db } from './db';
import { mysqlEngine } from './mysql';
import { WSAction } from '../src/types/ipam';

export function createApiRouter(broadcast: (type: WSAction, payload: any) => void): Router {
  const router = Router();

  // Health check
  router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // MySQL Database status & security diagnostics
  router.get('/db/status', async (req: Request, res: Response) => {
    try {
      const mysqlStatus = await mysqlEngine.getStatus();
      res.json({
        success: true,
        data: {
          storageEngine: 'MySQL Relational Database + In-Memory Microsecond Cache',
          mysql: mysqlStatus,
          security: {
            passwordHashing: 'BCrypt (10 Salt Rounds, zero plaintext)',
            apiKeyStorage: 'SHA-256 Digest + AES-256-GCM Symmetrically Encrypted',
            sensitiveDataPolicy: 'Enforced Zero-Plaintext Storage',
          },
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // MySQL Config template and guidance
  router.get('/db/config-template', (req: Request, res: Response) => {
    res.json({
      success: true,
      configFile: 'config/mysql.config.json',
      envExampleFile: '.env.example',
      schemaFile: 'server/schema.sql',
      environmentVariables: [
        'MYSQL_HOST',
        'MYSQL_PORT',
        'MYSQL_USER',
        'MYSQL_PASSWORD',
        'MYSQL_DATABASE',
        'MYSQL_URL',
        'MYSQL_SSL',
        'APP_SECRET_KEY',
      ],
    });
  });

  // Full bootstrap state
  router.get('/bootstrap', (req: Request, res: Response) => {
    try {
      const datacenters = db.getDatacenters();
      const vlans = db.getVlans();
      const subnets = db.getSubnets();
      const ips = db.getIPs();
      const stats = db.getStats();
      const activityLogs = db.getActivityLogs();
      const currentUser = db.getCurrentUser();
      const users = db.getUsers();

      res.json({
        success: true,
        data: {
          datacenters,
          vlans,
          subnets,
          ips,
          stats,
          activityLogs,
          currentUser,
          users,
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

  router.post('/datacenters', (req: Request, res: Response) => {
    try {
      const { name, location, description } = req.body;
      const created = db.createDatacenter({ name, location, description });
      broadcast('DATACENTER_CREATED', created);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.put('/datacenters/:id', (req: Request, res: Response) => {
    try {
      const updated = db.updateDatacenter(req.params.id, req.body);
      broadcast('DATACENTER_UPDATED', updated);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.delete('/datacenters/:id', (req: Request, res: Response) => {
    try {
      const result = db.deleteDatacenter(req.params.id);
      broadcast('DATACENTER_DELETED', { id: req.params.id });
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // --- VLAN ROUTES ---
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

  router.post('/vlans', (req: Request, res: Response) => {
    try {
      const { vlanId, name, description, datacenterId } = req.body;
      const created = db.createVlan({ vlanId, name, description, datacenterId });
      broadcast('VLAN_CREATED', created);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.put('/vlans/:id', (req: Request, res: Response) => {
    try {
      const updated = db.updateVlan(req.params.id, req.body);
      broadcast('VLAN_UPDATED', updated);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.delete('/vlans/:id', (req: Request, res: Response) => {
    try {
      const result = db.deleteVlan(req.params.id);
      broadcast('VLAN_DELETED', { id: req.params.id });
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // --- SUBNET ROUTES ---
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

  router.post('/subnets', (req: Request, res: Response) => {
    try {
      const { cidr, segmentType, datacenterId, vlanId, description } = req.body;
      const created = db.createSubnet({ cidr, segmentType, datacenterId, vlanId, description });
      broadcast('SUBNET_CREATED', created);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.put('/subnets/:id', (req: Request, res: Response) => {
    try {
      const updated = db.updateSubnet(req.params.id, req.body);
      broadcast('SUBNET_UPDATED', updated);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.delete('/subnets/:id', (req: Request, res: Response) => {
    try {
      const result = db.deleteSubnet(req.params.id);
      broadcast('SUBNET_DELETED', { id: req.params.id });
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Next Available IP
  router.get('/subnets/:id/next-available-ip', (req: Request, res: Response) => {
    try {
      const result = db.getNextAvailableIP(req.params.id);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Reserve Next Available IP
  router.post('/subnets/:id/reserve-next-ip', (req: Request, res: Response) => {
    try {
      const { assignedDevice, description } = req.body;
      const reserved = db.reserveNextAvailableIP(req.params.id, { assignedDevice, description });
      broadcast('IP_CREATED', reserved);
      res.status(201).json({ success: true, data: reserved });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Bulk Generate IPs in Subnet
  router.post('/subnets/:id/bulk-generate-ips', (req: Request, res: Response) => {
    try {
      const { count, startingOffset, status } = req.body;
      const result = db.bulkGenerateIPs(req.params.id, { count, startingOffset, status });
      broadcast('BULK_IPS_CREATED', { subnetId: req.params.id, created: result.created });
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
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

  router.post('/ips', (req: Request, res: Response) => {
    try {
      const { ipAddress, subnetId, status, assignedDevice, description } = req.body;
      const created = db.createIP({ ipAddress, subnetId, status, assignedDevice, description });
      broadcast('IP_CREATED', created);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.put('/ips/:id', (req: Request, res: Response) => {
    try {
      const updated = db.updateIP(req.params.id, req.body);
      broadcast('IP_UPDATED', updated);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.delete('/ips/:id', (req: Request, res: Response) => {
    try {
      const result = db.deleteIP(req.params.id);
      broadcast('IP_DELETED', { id: req.params.id, ipAddress: result.ipAddress });
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // --- USER PROFILE & AUTHENTICATION ROUTES ---
  router.get('/user/current', (req: Request, res: Response) => {
    try {
      const user = db.getCurrentUser();
      res.json({ success: true, data: user });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.put('/user/profile', (req: Request, res: Response) => {
    try {
      const currentUser = db.getCurrentUser();
      if (!currentUser) return res.status(401).json({ success: false, error: 'No authenticated user session found' });
      const updated = db.updateUserProfile(currentUser.id, req.body);
      broadcast('USER_UPDATED', updated);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.get('/users', (req: Request, res: Response) => {
    try {
      const users = db.getUsers();
      res.json({ success: true, data: users });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/auth/signin', (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const user = db.signIn(email, password);
      broadcast('USER_UPDATED', user);
      res.json({ success: true, data: user });
    } catch (err: any) {
      res.status(401).json({ success: false, error: err.message });
    }
  });

  router.post('/auth/signout', (req: Request, res: Response) => {
    try {
      db.signOut();
      res.json({ success: true, message: 'Signed out successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/auth/signup', (req: Request, res: Response) => {
    try {
      const { name, email, password, role, department, organization, location, phone, bio, primaryDatacenterId } = req.body;
      const newUser = db.createUser({
        name,
        email,
        password,
        role,
        department,
        organization,
        location,
        phone,
        bio,
        primaryDatacenterId,
      });
      broadcast('USER_CREATED', newUser);
      res.status(201).json({ success: true, data: newUser });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/auth/switch-user', (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });
      const user = db.switchUser(userId);
      broadcast('USER_UPDATED', user);
      res.json({ success: true, data: user });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/user/generate-api-key', (req: Request, res: Response) => {
    try {
      const currentUser = db.getCurrentUser();
      if (!currentUser) return res.status(401).json({ success: false, error: 'No authenticated user session found' });
      const apiKey = db.generateApiKey(currentUser.id);
      const updated = db.getCurrentUser();
      broadcast('USER_UPDATED', updated);
      res.json({ success: true, data: { apiKey, user: updated } });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  return router;
}
