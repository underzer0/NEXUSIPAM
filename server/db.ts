import fs from 'fs';
import path from 'path';
import { Datacenter, VLAN, Subnet, IPAddress, ActivityLog, IPAMStats, SegmentType, IPStatus, UserProfile, IPVersion } from '../src/types/ipam';
import { isIPInCIDR, isValidCIDR, isValidIP, parseCIDR, ipToInt, intToIp, getIPVersion, compressIPv6, generateIPRange } from '../src/utils/ipCalculator';
import { mysqlEngine } from './mysql';
import { hashPasswordSync, verifyPasswordSync, generateSecureApiKey, hashSensitiveData, generateSessionToken, API_KEY_PREFIX } from './crypto';

const MIN_PASSWORD = 6;

export interface UserSession {
  token: string;
  userId: string;
  expiresAt: number; // epoch ms
}

export interface CreateVlanParams {
  vlanId?: number | string;
  tag?: number | string;
  vid?: number | string;
  id?: number | string;
  name?: string;
  vlanName?: string;
  vlan_name?: string;
  description?: string;
  notes?: string;
  datacenterId?: string;
  datacenter_id?: string;
  datacenter?: string;
  datacenterName?: string;
}

export interface UpdateVlanParams {
  vlanId?: number | string;
  tag?: number | string;
  vid?: number | string;
  name?: string;
  vlanName?: string;
  vlan_name?: string;
  description?: string;
  notes?: string;
  datacenterId?: string;
  datacenter_id?: string;
  datacenter?: string;
  datacenterName?: string;
}

export interface CreateSubnetParams {
  cidr?: string;
  prefix?: string;
  subnetCidr?: string;
  network?: string;
  segmentType?: SegmentType | string;
  segment_type?: SegmentType | string;
  type?: SegmentType | string;
  routingClassification?: SegmentType | string;
  datacenterId?: string;
  datacenter_id?: string;
  datacenter?: string;
  datacenterName?: string;
  vlanId?: string | number | null;
  vlan_id?: string | number | null;
  vlan?: string | number | null;
  vlanTag?: string | number | null;
  vlanName?: string;
  description?: string;
  purpose?: string;
  notes?: string;
}

export interface UpdateSubnetParams {
  cidr?: string;
  prefix?: string;
  subnetCidr?: string;
  network?: string;
  segmentType?: SegmentType | string;
  segment_type?: SegmentType | string;
  type?: SegmentType | string;
  routingClassification?: SegmentType | string;
  datacenterId?: string;
  datacenter_id?: string;
  datacenter?: string;
  datacenterName?: string;
  vlanId?: string | number | null;
  vlan_id?: string | number | null;
  vlan?: string | number | null;
  vlanTag?: string | number | null;
  vlanName?: string;
  description?: string;
  purpose?: string;
  notes?: string;
}

class IPAMDatabase {
  private datacenters: Datacenter[] = [];
  private vlans: VLAN[] = [];
  private subnets: Subnet[] = [];
  private ips: IPAddress[] = [];
  private activityLogs: ActivityLog[] = [];
  private users: UserProfile[] = [];
  // Strictly stores salted BCrypt hashes ($2a$10$...), never plaintext!
  private passwordHashes: Map<string, string> = new Map();
  // userId -> SHA-256 of the user's API key; the raw key is shown once and never kept.
  private apiKeyHashes: Map<string, string> = new Map();
  // Active user sessions (token -> UserSession) for cookie authentication
  private sessions: Map<string, UserSession> = new Map();
  private dataDir: string;
  private dbFilePath: string;
  private isDbConnected: boolean = false;
  private dbError: string | null = null;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.dbFilePath = path.join(this.dataDir, 'ipam-database.json');
    this.initializeStore();
  }

  // MySQL writes started by the current persisted() call; null when none is running.
  private pendingWrites: Promise<void>[] | null = null;

  private track(write: Promise<void>): void {
    const tracked = write.catch((err) => {
      if (this.isDbConnected) console.error('[IPAM Database] Write failed:', err);
      throw err;
    });
    if (this.pendingWrites) this.pendingWrites.push(tracked);
    // Writes outside a request (session expiry cleanup) have nobody to report to.
    else tracked.catch(() => {});
  }

  /**
   * Runs a change and waits until MySQL has stored it. If any write fails, memory is reloaded
   * from MySQL so the failed change is not shown as saved, and the caller gets a 503 error.
   */
  public async persisted<T>(change: () => T): Promise<T> {
    if (!this.isDbConnected) throw new DatabaseWriteError('The database is not connected, so nothing was saved.');
    // change() is synchronous, so no other request can add writes to this list meanwhile.
    this.pendingWrites = [];
    let result: T;
    let writes: Promise<void>[];
    try {
      result = change();
    } finally {
      writes = this.pendingWrites;
      this.pendingWrites = null;
    }
    const failed = (await Promise.allSettled(writes)).some((r) => r.status === 'rejected');
    if (failed) {
      const reload = await this.reloadFromMySQL().catch(() => null);
      if (!reload?.success) {
        this.isDbConnected = false;
        this.dbError = 'Lost the connection to MySQL while saving.';
      }
      throw new DatabaseWriteError('The database did not save this change. Please try again.');
    }
    return result;
  }

  public isDatabaseConnected(): boolean {
    return this.isDbConnected;
  }

  public getDatabaseError(): string | null {
    return this.dbError || mysqlEngine.getLastError();
  }

  public async retryConnection(): Promise<{ success: boolean; error?: string }> {
    const res = await mysqlEngine.reloadConfigAndReconnect();
    if (res.success) {
      this.isDbConnected = true;
      this.dbError = null;
      await this.reloadFromMySQL();
      return { success: true };
    } else {
      this.isDbConnected = false;
      this.dbError = res.error || mysqlEngine.getLastError() || 'Could not connect to MySQL server';
      return { success: false, error: this.dbError };
    }
  }

  private async initializeStore(): Promise<void> {
    // 1. Connect to MySQL database from /config/mysql.config.json
    const mysqlConnected = await mysqlEngine.initialize();
    if (mysqlConnected) {
      this.isDbConnected = true;
      this.dbError = null;
      const mysqlData = await mysqlEngine.loadAll();
      if (mysqlData && (mysqlData.datacenters.length > 0 || mysqlData.users.length > 0)) {
        this.datacenters = mysqlData.datacenters;
        this.vlans = mysqlData.vlans;
        this.subnets = mysqlData.subnets;
        this.ips = mysqlData.ips;
        this.activityLogs = mysqlData.activityLogs;
        this.users = mysqlData.users;
        this.passwordHashes = mysqlData.passwords;
        this.apiKeyHashes = mysqlData.apiKeyHashes;
        if (mysqlData.sessions) {
          this.sessions = mysqlData.sessions;
        }
        console.log(`[IPAM Database] Connected to MySQL: ${this.datacenters.length} Datacenters, ${this.vlans.length} VLANs, ${this.subnets.length} Subnets, ${this.ips.length} IPs, ${this.users.length} Users.`);
        return;
      } else {
        // Connected to MySQL, initialize default root user and default datacenter if schema is fresh
        console.log('[IPAM Database] Connected to MySQL with empty tables. Seeding initial schema...');
        await this.seedInitialDataset();
        return;
      }
    }

    // 2. Database connection failed - DO NOT FALL BACK TO LOCAL STORAGE
    this.isDbConnected = false;
    this.dbError = mysqlEngine.getLastError() || 'Connection refused or host unreachable. Check /config/mysql.config.json';
    console.error(`[IPAM Database Error] MySQL connection failed: ${this.dbError}. Please configure /config/mysql.config.json.`);
    this.datacenters = [];
    this.vlans = [];
    this.subnets = [];
    this.ips = [];
    this.activityLogs = [];
    this.users = [];
    this.passwordHashes = new Map();
    this.apiKeyHashes = new Map();
    this.sessions = new Map();
  }

  private async seedInitialDataset(): Promise<void> {
    const adminUser: UserProfile = {
      id: 'usr-admin-default',
      name: 'System Administrator',
      email: 'admin@beyondip.internal',
      role: 'Super Administrator',
      access: 'admin',
      status: 'active',
      datacenterIds: [],
      department: 'Infrastructure & Cloud Ops',
      organization: 'BeyondIP Enterprise',
      location: 'Corporate HQ',
      phone: '+1 (555) 019-2834',
      bio: 'Primary Enterprise IPAM & Network Infrastructure Administrator.',
      primaryDatacenterId: 'dc-us-east-1',
      twoFactorEnabled: false,
      emailNotifications: true,
      collisionAlerts: true,
      exhaustionAlerts: true,
      themePreference: 'dark',
      apiKey: '',
      createdAt: new Date().toISOString(),
    };
    // Without IPAM_ADMIN_PASSWORD the seeded admin gets an unguessable password and stays unusable.
    const defaultPasswordHash = hashPasswordSync(process.env.IPAM_ADMIN_PASSWORD || generateSessionToken());

    const defaultDc: Datacenter = {
      id: 'dc-us-east-1',
      name: 'US-East (Virginia)',
      location: 'Ashburn, VA, USA',
      description: 'Primary Production Cloud Hub and Core Network Router',
      createdAt: new Date().toISOString(),
    };

    const defaultVlan: VLAN = {
      id: 'vlan-10',
      vlanId: 10,
      name: 'VLAN 10 - Corp Internal',
      description: 'Core Corporate Local Subnet',
      datacenterId: defaultDc.id,
      createdAt: new Date().toISOString(),
    };

    const defaultSubnet: Subnet = {
      id: 'sub-10-10-0-0-24',
      cidr: '10.10.0.0/24',
      ipVersion: 'IPv4',
      segmentType: 'Private',
      datacenterId: defaultDc.id,
      vlanId: defaultVlan.id,
      description: 'Core Production Subnet',
      createdAt: new Date().toISOString(),
    };

    this.users = [adminUser];
    this.passwordHashes.set(adminUser.id, defaultPasswordHash);
    this.datacenters = [defaultDc];
    this.vlans = [defaultVlan];
    this.subnets = [defaultSubnet];
    this.ips = [];
    this.activityLogs = [];

    // Save directly into MySQL
    try {
      await mysqlEngine.saveDatacenter(defaultDc);
      await mysqlEngine.saveVlan(defaultVlan);
      await mysqlEngine.saveSubnet(defaultSubnet);
      await mysqlEngine.saveUser(adminUser, defaultPasswordHash, null);
    } catch (err) {
      console.error('[MySQL Seed Error]', err);
      this.isDbConnected = false;
      this.dbError = 'Could not write the starting data to MySQL.';
    }
  }

  public async reloadFromMySQL(): Promise<{ success: boolean; stats: any; error?: string }> {
    const mysqlData = await mysqlEngine.loadAll();
    if (mysqlData) {
      this.datacenters = mysqlData.datacenters;
      this.vlans = mysqlData.vlans;
      this.subnets = mysqlData.subnets;
      this.ips = mysqlData.ips;
      this.activityLogs = mysqlData.activityLogs;
      this.users = mysqlData.users;
      this.passwordHashes = mysqlData.passwords;
      this.apiKeyHashes = mysqlData.apiKeyHashes;
      if (mysqlData.sessions) {
        this.sessions = mysqlData.sessions;
      }
      this.persist();
      return {
        success: true,
        stats: {
          datacenters: this.datacenters.length,
          vlans: this.vlans.length,
          subnets: this.subnets.length,
          ips: this.ips.length,
          users: this.users.length,
        },
      };
    }
    return { success: false, stats: null, error: 'Could not load records from MySQL database' };
  }

  public async syncAllToMySQL(): Promise<{ success: boolean; synced: any; error?: string }> {
    try {
      const status = await mysqlEngine.getStatus();
      if (!status.connected) {
        return { success: false, synced: null, error: status.error || 'MySQL is not connected' };
      }

      // Sync all datacenters
      for (const dc of this.datacenters) {
        await mysqlEngine.saveDatacenter(dc);
      }
      // Sync all vlans
      for (const vlan of this.vlans) {
        await mysqlEngine.saveVlan(vlan);
      }
      // Sync all subnets
      for (const sub of this.subnets) {
        await mysqlEngine.saveSubnet(sub);
      }
      // Sync all ips
      for (const ip of this.ips) {
        await mysqlEngine.saveIP(ip);
      }
      // Sync all activity logs
      for (const log of this.activityLogs) {
        await mysqlEngine.saveActivityLog(log);
      }
      // Sync all users
      for (const user of this.users) {
        const hash = this.passwordHashes.get(user.id) ?? '';
        await mysqlEngine.saveUser(user, hash, this.apiKeyHashes.get(user.id) ?? null);
      }
      // Sync all valid sessions
      for (const session of this.sessions.values()) {
        if (session.expiresAt > Date.now()) {
          await mysqlEngine.saveSession(session.token, session.userId, new Date(session.expiresAt));
        }
      }

      return {
        success: true,
        synced: {
          datacenters: this.datacenters.length,
          vlans: this.vlans.length,
          subnets: this.subnets.length,
          ips: this.ips.length,
          users: this.users.length,
          activityLogs: this.activityLogs.length,
        },
      };
    } catch (err: any) {
      return { success: false, synced: null, error: err.message };
    }
  }

  private loadFromFile(): boolean {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const raw = fs.readFileSync(this.dbFilePath, 'utf-8');
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
          this.datacenters = Array.isArray(data.datacenters) ? data.datacenters : [];
          this.vlans = Array.isArray(data.vlans) ? data.vlans : [];
          this.subnets = Array.isArray(data.subnets) ? data.subnets : [];
          this.ips = Array.isArray(data.ips) ? data.ips : [];
          this.activityLogs = Array.isArray(data.activityLogs) ? data.activityLogs : [];
          this.users = Array.isArray(data.users) ? data.users : [];
          
          // Securely sanitize any legacy raw passwords into salted BCrypt hashes
          this.passwordHashes = new Map();
          if (data.passwords && typeof data.passwords === 'object') {
            for (const [userId, passVal] of Object.entries(data.passwords)) {
              if (typeof passVal === 'string') {
                if (passVal.startsWith('$2a$') || passVal.startsWith('$2b$')) {
                  this.passwordHashes.set(userId, passVal);
                } else {
                  // Hash raw legacy password immediately
                  this.passwordHashes.set(userId, hashPasswordSync(passVal));
                }
              }
            }
          }
          if (data.passwordHashes && typeof data.passwordHashes === 'object') {
            for (const [userId, hashVal] of Object.entries(data.passwordHashes)) {
              if (typeof hashVal === 'string') {
                this.passwordHashes.set(userId, hashVal);
              }
            }
          }

          this.sessions = new Map();
          if (data.sessions && typeof data.sessions === 'object') {
            for (const [token, sessionData] of Object.entries(data.sessions)) {
              if (sessionData && typeof sessionData === 'object' && (sessionData as any).expiresAt > Date.now()) {
                this.sessions.set(token, sessionData as UserSession);
              }
            }
          }

          console.log(`[IPAM Storage] Successfully loaded store: ${this.datacenters.length} Datacenters, ${this.vlans.length} VLANs, ${this.subnets.length} Subnets, ${this.ips.length} IPs, ${this.users.length} Users.`);
          return true;
        }
      }
    } catch (err) {
      console.error('[IPAM Storage] Error loading database file from disk:', err);
    }
    return false;
  }

  private persist(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      // Security guarantee: User passwords stored on disk are STRICTLY salted BCrypt hashes ($2a$10$...)
      const payload = {
        version: 2,
        securityEngine: 'BCrypt-Salted-Hash-v2+AES256GCM',
        lastSaved: new Date().toISOString(),
        datacenters: this.datacenters,
        vlans: this.vlans,
        subnets: this.subnets,
        ips: this.ips,
        activityLogs: this.activityLogs,
        users: this.users,
        passwordHashes: Object.fromEntries(this.passwordHashes.entries()),
        sessions: Object.fromEntries(this.sessions.entries()),
      };

      const tempPath = `${this.dbFilePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.dbFilePath);
    } catch (err) {
      console.error('[IPAM Storage] Error writing database to disk:', err);
    }
  }

  public logActivity(action: ActivityLog['action'], entityType: ActivityLog['entityType'], entityId: string, title: string, detail: string): ActivityLog {
    const log: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      action,
      entityType,
      entityId,
      title,
      detail,
      timestamp: new Date().toISOString(),
    };
    this.activityLogs.unshift(log);
    if (this.activityLogs.length > 200) {
      this.activityLogs.pop();
    }
    this.persist();
    // Asynchronously write through to MySQL
    this.track(mysqlEngine.saveActivityLog(log));
    return log;
  }

  public getActivityLogs(): ActivityLog[] {
    return [...this.activityLogs];
  }

  // --- DATACENTER CRUD ---
  public getDatacenters(): Datacenter[] {
    return [...this.datacenters];
  }

  public getDatacenterById(id: string): Datacenter | undefined {
    return this.datacenters.find(dc => dc.id === id);
  }

  public createDatacenter(data: { name: string; location: string; description: string }): Datacenter {
    if (!data.name?.trim()) throw new Error('Datacenter name is required');
    if (!data.location?.trim()) throw new Error('Location is required');

    // Check duplicate name
    if (this.datacenters.some(dc => dc.name.toLowerCase() === data.name.trim().toLowerCase())) {
      throw new Error(`Datacenter with name "${data.name}" already exists`);
    }

    const id = `dc-${data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
    const newDc: Datacenter = {
      id,
      name: data.name.trim(),
      location: data.location.trim(),
      description: data.description?.trim() || '',
      createdAt: new Date().toISOString(),
    };
    this.datacenters.push(newDc);
    this.logActivity('CREATE', 'Datacenter', newDc.id, `Datacenter Created: ${newDc.name}`, `Added location ${newDc.location}`);
    this.persist();
    this.track(mysqlEngine.saveDatacenter(newDc));
    return newDc;
  }

  public updateDatacenter(id: string, data: { name?: string; location?: string; description?: string }): Datacenter {
    const index = this.datacenters.findIndex(dc => dc.id === id);
    if (index === -1) throw new Error(`Datacenter ${id} not found`);

    if (data.name && data.name.trim()) {
      const duplicate = this.datacenters.some(dc => dc.id !== id && dc.name.toLowerCase() === data.name!.trim().toLowerCase());
      if (duplicate) throw new Error(`Another Datacenter with name "${data.name}" already exists`);
      this.datacenters[index].name = data.name.trim();
    }
    if (data.location !== undefined) this.datacenters[index].location = data.location.trim();
    if (data.description !== undefined) this.datacenters[index].description = data.description.trim();

    const updated = this.datacenters[index];
    this.logActivity('UPDATE', 'Datacenter', updated.id, `Datacenter Updated: ${updated.name}`, `Modified configuration for ${updated.name}`);
    this.persist();
    this.track(mysqlEngine.saveDatacenter(updated));
    return updated;
  }

  public deleteDatacenter(id: string): { success: boolean; deletedId: string } {
    const dc = this.datacenters.find(d => d.id === id);
    if (!dc) throw new Error(`Datacenter ${id} not found`);

    // Check cascade constraints
    const attachedVlans = this.vlans.filter(v => v.datacenterId === id);
    const attachedSubnets = this.subnets.filter(s => s.datacenterId === id);

    if (attachedSubnets.length > 0 || attachedVlans.length > 0) {
      throw new Error(`Cannot delete Datacenter "${dc.name}" because it still contains ${attachedVlans.length} VLAN(s) and ${attachedSubnets.length} Subnet(s). Please delete or reassign them first.`);
    }

    this.datacenters = this.datacenters.filter(d => d.id !== id);
    this.logActivity('DELETE', 'Datacenter', id, `Datacenter Deleted: ${dc.name}`, `Removed datacenter location ${dc.location}`);
    this.persist();
    this.track(mysqlEngine.deleteDatacenter(id));
    return { success: true, deletedId: id };
  }

  public resolveDatacenter(datacenterInput?: string): Datacenter {
    if (!this.datacenters.length) {
      throw new Error('No Datacenters configured. Please create a Datacenter first.');
    }
    if (!datacenterInput || !datacenterInput.trim()) {
      return this.datacenters[0];
    }
    const trimmed = datacenterInput.trim();
    // 1. Direct ID match
    let found = this.datacenters.find(d => d.id === trimmed);
    if (found) return found;

    // 2. Case-insensitive exact name match
    found = this.datacenters.find(d => d.name.toLowerCase() === trimmed.toLowerCase());
    if (found) return found;

    // 3. Case-insensitive partial name or location match
    found = this.datacenters.find(d => 
      d.name.toLowerCase().includes(trimmed.toLowerCase()) || 
      d.location.toLowerCase().includes(trimmed.toLowerCase())
    );
    if (found) return found;

    throw new Error(`Datacenter "${datacenterInput}" not found. Available datacenters: ${this.datacenters.map(d => `${d.name} (${d.id})`).join(', ')}`);
  }

  public resolveVlan(vlanInput: string | number | null | undefined, datacenterId: string): VLAN | null {
    if (vlanInput === undefined || vlanInput === null || vlanInput === '' || vlanInput === 0) {
      return null;
    }
    const trimmed = typeof vlanInput === 'string' ? vlanInput.trim() : String(vlanInput);
    if (trimmed.toLowerCase() === 'none' || trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
      return null;
    }

    const dc = this.datacenters.find(d => d.id === datacenterId);
    const dcName = dc?.name || datacenterId;

    // 1. Direct ID match
    let found = this.vlans.find(v => v.id === trimmed);
    if (found) {
      if (found.datacenterId !== datacenterId) {
        throw new Error(`Selected VLAN (ID: ${found.vlanId}) belongs to a different Datacenter! VLANs must match the Subnet's Datacenter.`);
      }
      return found;
    }

    // 2. 802.1Q Tag (number) match within the specified Datacenter
    const numericTag = Number(trimmed);
    if (!isNaN(numericTag) && numericTag >= 1 && numericTag <= 4094) {
      found = this.vlans.find(v => v.datacenterId === datacenterId && v.vlanId === numericTag);
      if (found) return found;

      // Check if tag exists in another Datacenter for clear error message
      const otherDcVlan = this.vlans.find(v => v.vlanId === numericTag);
      if (otherDcVlan) {
        throw new Error(`Selected VLAN (Tag: ${numericTag}) belongs to a different Datacenter! VLANs must match the Subnet's Datacenter.`);
      }
    }

    // 3. Name match within the specified Datacenter
    found = this.vlans.find(v => v.datacenterId === datacenterId && v.name.toLowerCase() === trimmed.toLowerCase());
    if (found) return found;

    throw new Error(`VLAN "${vlanInput}" not found in Datacenter "${dcName}". Specify a valid VLAN Tag (1-4094), VLAN ID, or "none".`);
  }

  public getVlanOptions() {
    return {
      datacenters: this.datacenters.map(d => ({ id: d.id, name: d.name, location: d.location })),
      vlanIdRange: { min: 1, max: 4094, standard: 'IEEE 802.1Q VID' },
      fields: [
        {
          name: 'datacenterId',
          aliases: ['datacenter', 'datacenterName'],
          type: 'string',
          required: true,
          description: 'Datacenter Location ID or Name (defaults to primary datacenter if omitted)',
          guiDefault: this.datacenters[0]?.id || ''
        },
        {
          name: 'vlanId',
          aliases: ['tag', 'vid', 'vlan_id'],
          type: 'number',
          required: true,
          description: 'VLAN ID (802.1Q Tag between 1 and 4094). Unique per Datacenter.'
        },
        {
          name: 'name',
          aliases: ['vlanName', 'vlan_name'],
          type: 'string',
          required: true,
          description: 'VLAN Name (e.g. DMZ-Edge-Traffic, App-Tier, DB-Cluster)'
        },
        {
          name: 'description',
          aliases: ['notes'],
          type: 'string',
          required: false,
          description: 'Optional layer-2 routing or security segment notes'
        }
      ]
    };
  }

  public getSubnetOptions() {
    return {
      datacenters: this.datacenters.map(d => ({ id: d.id, name: d.name, location: d.location })),
      vlans: this.vlans.map(v => ({ id: v.id, vlanId: v.vlanId, name: v.name, datacenterId: v.datacenterId })),
      segmentTypes: [
        { value: 'Private', description: 'Private (RFC1918 / IPv6 ULA fd00::/8)' },
        { value: 'Public', description: 'Publicly Routed (Global)' }
      ],
      presets: [
        { label: 'IPv4 /24', cidr: '10.10.100.0/24' },
        { label: 'IPv4 /26', cidr: '172.16.50.0/26' },
        { label: 'IPv6 ULA /64', cidr: 'fd00:10:10::/64' },
        { label: 'IPv6 Public /64', cidr: '2001:db8:1000::/64' }
      ],
      fields: [
        {
          name: 'datacenterId',
          aliases: ['datacenter', 'datacenterName'],
          type: 'string',
          required: true,
          description: 'Datacenter Scope ID or Name (defaults to primary datacenter if omitted)',
          guiDefault: this.datacenters[0]?.id || ''
        },
        {
          name: 'cidr',
          aliases: ['prefix', 'subnetCidr', 'network'],
          type: 'string',
          required: true,
          description: 'Subnet CIDR Prefix (IPv4 e.g. 10.10.100.0/24 or IPv6 e.g. fd00:10:10::/64, 2001:db8::/64)'
        },
        {
          name: 'vlanId',
          aliases: ['vlan', 'vlanTag', 'vlanName'],
          type: 'string | number | null',
          required: false,
          description: 'Associated VLAN in target Datacenter (UUID, 802.1Q tag number like 100, or "none" for un-tagged L3)'
        },
        {
          name: 'segmentType',
          aliases: ['segment_type', 'type', 'routingClassification'],
          type: 'string ("Private" | "Public")',
          required: false,
          description: 'Routing classification. Auto-detected from CIDR if omitted (RFC1918/ULA -> Private, else Public)'
        },
        {
          name: 'description',
          aliases: ['purpose', 'notes'],
          type: 'string',
          required: false,
          description: 'Subnet purpose or workload description'
        }
      ]
    };
  }

  // --- VLAN CRUD ---
  public getVlans(datacenterId?: string): VLAN[] {
    if (datacenterId) {
      return this.vlans.filter(v => v.datacenterId === datacenterId);
    }
    return [...this.vlans];
  }

  public getVlanById(id: string): VLAN | undefined {
    return this.vlans.find(v => v.id === id);
  }

  public createVlan(data: CreateVlanParams): VLAN {
    const rawVlanId = data.vlanId ?? data.tag ?? data.vid ?? data.id;
    const vlanNum = Number(rawVlanId);
    if (rawVlanId === undefined || isNaN(vlanNum) || vlanNum < 1 || vlanNum > 4094) {
      throw new Error('VLAN ID must be a valid 802.1Q tag between 1 and 4094');
    }

    const name = (data.name ?? data.vlanName ?? data.vlan_name)?.trim();
    if (!name) {
      throw new Error('VLAN Name is required.');
    }

    const dc = this.resolveDatacenter(data.datacenterId ?? data.datacenter_id ?? data.datacenter ?? data.datacenterName);

    // Uniqueness constraint: (datacenterId + vlanId) must be unique
    const existing = this.vlans.find(v => v.datacenterId === dc.id && v.vlanId === vlanNum);
    if (existing) {
      throw new Error(`VLAN ID ${vlanNum} already exists in Datacenter "${dc.name}". VLAN IDs must be unique within the same Datacenter.`);
    }

    const desc = (data.description ?? data.notes ?? '').trim();
    const id = `vlan-${dc.id}-${vlanNum}-${Date.now().toString(36)}`;
    const newVlan: VLAN = {
      id,
      vlanId: vlanNum,
      name,
      description: desc,
      datacenterId: dc.id,
      createdAt: new Date().toISOString(),
    };
    this.vlans.push(newVlan);
    this.logActivity('CREATE', 'VLAN', newVlan.id, `VLAN ${vlanNum} Created`, `Assigned "${newVlan.name}" in ${dc.name}`);
    this.persist();
    this.track(mysqlEngine.saveVlan(newVlan));
    return newVlan;
  }

  public updateVlan(id: string, data: UpdateVlanParams): VLAN {
    const index = this.vlans.findIndex(v => v.id === id);
    if (index === -1) throw new Error(`VLAN ${id} not found`);

    const current = this.vlans[index];
    const targetDc = (data.datacenterId || data.datacenter_id || data.datacenter || data.datacenterName)
      ? this.resolveDatacenter(data.datacenterId || data.datacenter_id || data.datacenter || data.datacenterName)
      : this.resolveDatacenter(current.datacenterId);

    const rawVlanId = data.vlanId ?? data.tag ?? data.vid;
    const targetVlanId = rawVlanId !== undefined ? Number(rawVlanId) : current.vlanId;

    if (isNaN(targetVlanId) || targetVlanId < 1 || targetVlanId > 4094) {
      throw new Error('VLAN ID must be a valid 802.1Q tag between 1 and 4094');
    }

    // Check duplicate in same DC
    const duplicate = this.vlans.find(v => v.id !== id && v.datacenterId === targetDc.id && v.vlanId === targetVlanId);
    if (duplicate) {
      throw new Error(`VLAN ID ${targetVlanId} already exists in Datacenter "${targetDc.name}".`);
    }

    const name = (data.name ?? data.vlanName ?? data.vlan_name)?.trim();
    if (name) current.name = name;

    const desc = data.description ?? data.notes;
    if (desc !== undefined) current.description = desc.trim();

    current.datacenterId = targetDc.id;
    current.vlanId = targetVlanId;

    this.logActivity('UPDATE', 'VLAN', current.id, `VLAN ${current.vlanId} Updated`, `Updated "${current.name}" in ${targetDc.name}`);
    this.persist();
    this.track(mysqlEngine.saveVlan(current));
    return current;
  }

  public deleteVlan(id: string): { success: boolean; deletedId: string } {
    const vlan = this.vlans.find(v => v.id === id);
    if (!vlan) throw new Error(`VLAN ${id} not found`);

    // Check attached subnets
    const attachedSubnets = this.subnets.filter(s => s.vlanId === id);
    if (attachedSubnets.length > 0) {
      throw new Error(`Cannot delete VLAN ${vlan.vlanId} because ${attachedSubnets.length} Subnet(s) are bound to it. Please reassign or delete the subnets first.`);
    }

    this.vlans = this.vlans.filter(v => v.id !== id);
    this.logActivity('DELETE', 'VLAN', id, `VLAN ${vlan.vlanId} Deleted`, `Removed VLAN "${vlan.name}"`);
    this.persist();
    this.track(mysqlEngine.deleteVlan(id));
    return { success: true, deletedId: id };
  }

  // --- SUBNET CRUD ---
  public getSubnets(filters?: { datacenterId?: string; vlanId?: string; segmentType?: SegmentType }): Subnet[] {
    let result = [...this.subnets];
    if (filters?.datacenterId) {
      result = result.filter(s => s.datacenterId === filters.datacenterId);
    }
    if (filters?.vlanId) {
      result = result.filter(s => s.vlanId === filters.vlanId);
    }
    if (filters?.segmentType) {
      result = result.filter(s => s.segmentType === filters.segmentType);
    }
    return result;
  }

  public getSubnetById(id: string): Subnet | undefined {
    return this.subnets.find(s => s.id === id);
  }

  public createSubnet(data: CreateSubnetParams): Subnet {
    const rawCidr = (data.cidr ?? data.prefix ?? data.subnetCidr ?? data.network)?.trim();
    if (!rawCidr) {
      throw new Error('CIDR Prefix is required (e.g. 10.10.100.0/24 or 2001:db8:10::/64).');
    }
    if (!isValidCIDR(rawCidr)) {
      throw new Error(`Invalid CIDR format: "${rawCidr}". Please provide a valid IPv4 (e.g. 10.10.100.0/24) or IPv6 (e.g. fd00:10::/64, 2001:db8::/64).`);
    }

    const calc = parseCIDR(rawCidr);
    const normalizedCidr = calc.cidr;

    // Resolve Datacenter
    const dc = this.resolveDatacenter(data.datacenterId ?? data.datacenter_id ?? data.datacenter ?? data.datacenterName);

    // Resolve VLAN (if specified)
    const rawVlan = data.vlanId ?? data.vlan_id ?? data.vlan ?? data.vlanTag ?? data.vlanName;
    const vlan = this.resolveVlan(rawVlan, dc.id);

    // Check duplicate CIDR in same Datacenter
    const duplicate = this.subnets.find(s => s.datacenterId === dc.id && s.cidr === normalizedCidr);
    if (duplicate) {
      throw new Error(`Subnet CIDR ${normalizedCidr} is already assigned in Datacenter "${dc.name}".`);
    }

    // Determine segment type (auto-detect RFC1918 / ULA if omitted, or validate user choice)
    let segmentType: SegmentType;
    const rawSegment = data.segmentType ?? data.segment_type ?? data.type ?? data.routingClassification;
    if (rawSegment) {
      const lower = String(rawSegment).trim().toLowerCase();
      if (lower === 'private') {
        segmentType = 'Private';
      } else if (lower === 'public') {
        segmentType = 'Public';
      } else {
        throw new Error(`Invalid segment routing classification: "${rawSegment}". Options are "Private" (RFC1918 / ULA) or "Public".`);
      }
    } else {
      segmentType = calc.isPrivate ? 'Private' : 'Public';
    }

    const rawDesc = data.description ?? data.purpose ?? data.notes;
    const description = rawDesc?.trim() || `${calc.ipVersion} ${segmentType} Subnet ${normalizedCidr}`;

    const id = `sub-${normalizedCidr.replace(/[\.\:\/]/g, '-')}-${Date.now().toString(36)}`;
    const newSubnet: Subnet = {
      id,
      cidr: normalizedCidr,
      ipVersion: calc.ipVersion,
      segmentType,
      datacenterId: dc.id,
      vlanId: vlan ? vlan.id : null,
      description,
      createdAt: new Date().toISOString(),
    };
    this.subnets.push(newSubnet);
    this.logActivity('CREATE', 'Subnet', newSubnet.id, `Subnet ${newSubnet.cidr} (${calc.ipVersion}) Created`, `Configured as ${segmentType} in ${dc.name}`);
    this.persist();
    this.track(mysqlEngine.saveSubnet(newSubnet));
    return newSubnet;
  }

  public updateSubnet(id: string, data: UpdateSubnetParams): Subnet {
    const index = this.subnets.findIndex(s => s.id === id);
    if (index === -1) throw new Error(`Subnet ${id} not found`);

    const current = this.subnets[index];
    const targetDc = (data.datacenterId || data.datacenter_id || data.datacenter || data.datacenterName)
      ? this.resolveDatacenter(data.datacenterId || data.datacenter_id || data.datacenter || data.datacenterName)
      : this.resolveDatacenter(current.datacenterId);

    const rawCidr = (data.cidr ?? data.prefix ?? data.subnetCidr ?? data.network)?.trim();
    const targetCidr = rawCidr || current.cidr;

    if (!isValidCIDR(targetCidr)) {
      throw new Error(`Invalid CIDR format: "${targetCidr}". Expected IPv4 or IPv6 CIDR (e.g. 10.10.10.0/24 or 2001:db8::/64)`);
    }

    const calc = parseCIDR(targetCidr);
    const normalizedCidr = calc.cidr;

    // Check duplicate in same DC
    const duplicate = this.subnets.find(s => s.id !== id && s.datacenterId === targetDc.id && s.cidr === normalizedCidr);
    if (duplicate) {
      throw new Error(`Subnet CIDR ${normalizedCidr} already exists in this Datacenter.`);
    }

    // If changing CIDR, check if any existing IPs fall outside the new CIDR
    if (normalizedCidr !== current.cidr) {
      const existingIps = this.ips.filter(ip => ip.subnetId === id);
      const invalidIps = existingIps.filter(ip => !isIPInCIDR(ip.ipAddress, normalizedCidr));
      if (invalidIps.length > 0) {
        throw new Error(`Cannot change CIDR to ${normalizedCidr} because ${invalidIps.length} assigned IP(s) (e.g. ${invalidIps[0].ipAddress}) do not fall inside this new block.`);
      }
    }

    // Resolve VLAN if passed
    const rawVlan = data.vlanId ?? data.vlan_id ?? data.vlan ?? data.vlanTag ?? data.vlanName;
    if (rawVlan !== undefined) {
      const vlan = this.resolveVlan(rawVlan, targetDc.id);
      current.vlanId = vlan ? vlan.id : null;
    }

    // Resolve segmentType if passed
    const rawSegment = data.segmentType ?? data.segment_type ?? data.type ?? data.routingClassification;
    if (rawSegment !== undefined) {
      const lower = String(rawSegment).trim().toLowerCase();
      if (lower === 'private') {
        current.segmentType = 'Private';
      } else if (lower === 'public') {
        current.segmentType = 'Public';
      } else {
        throw new Error(`Invalid segment routing classification: "${rawSegment}". Options are "Private" or "Public".`);
      }
    }

    const rawDesc = data.description ?? data.purpose ?? data.notes;
    if (rawDesc !== undefined) {
      current.description = rawDesc.trim();
    }

    current.cidr = normalizedCidr;
    current.ipVersion = calc.ipVersion;
    current.datacenterId = targetDc.id;

    this.logActivity('UPDATE', 'Subnet', current.id, `Subnet ${current.cidr} Updated`, `Updated configuration in ${targetDc.name}`);
    this.persist();
    this.track(mysqlEngine.saveSubnet(current));
    return current;
  }

  public deleteSubnet(id: string): { success: boolean; deletedId: string; deletedIPCount: number } {
    const subnet = this.subnets.find(s => s.id === id);
    if (!subnet) throw new Error(`Subnet ${id} not found`);

    const deletedIPCount = this.ips.filter(ip => ip.subnetId === id).length;
    this.ips = this.ips.filter(ip => ip.subnetId !== id);
    this.subnets = this.subnets.filter(s => s.id !== id);

    this.logActivity('DELETE', 'Subnet', id, `Subnet ${subnet.cidr} Deleted`, `Removed subnet and purged ${deletedIPCount} child IP assignment(s).`);
    this.persist();
    this.track(mysqlEngine.deleteSubnet(id));
    return { success: true, deletedId: id, deletedIPCount };
  }

  // --- IP ADDRESS CRUD ---
  public getIPs(filters?: { subnetId?: string; datacenterId?: string; status?: IPStatus; search?: string }): IPAddress[] {
    let result = [...this.ips];

    if (filters?.subnetId) {
      result = result.filter(ip => ip.subnetId === filters.subnetId);
    }
    if (filters?.datacenterId) {
      const dcSubnetIds = new Set(this.subnets.filter(s => s.datacenterId === filters.datacenterId).map(s => s.id));
      result = result.filter(ip => dcSubnetIds.has(ip.subnetId));
    }
    if (filters?.status) {
      result = result.filter(ip => ip.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(ip => 
        ip.ipAddress.toLowerCase().includes(q) ||
        ip.assignedDevice.toLowerCase().includes(q) ||
        ip.description.toLowerCase().includes(q)
      );
    }

    return result;
  }

  public getIPById(id: string): IPAddress | undefined {
    return this.ips.find(ip => ip.id === id);
  }

  public createIP(data: { ipAddress: string; subnetId: string; status: IPStatus; assignedDevice?: string; description?: string }): IPAddress {
    let ip = data.ipAddress?.trim();
    if (!isValidIP(ip)) {
      throw new Error(`Invalid IP address: "${ip}". Please enter a valid IPv4 (e.g. 192.168.1.10) or IPv6 (e.g. 2001:db8::1, fd00:10::1)`);
    }

    const version = getIPVersion(ip);
    if (version === 'IPv6') {
      ip = compressIPv6(ip);
    }

    const subnet = this.subnets.find(s => s.id === data.subnetId);
    if (!subnet) {
      throw new Error(`Parent Subnet with ID "${data.subnetId}" not found`);
    }

    // MATH & LOGIC CONSTRAINT: Ensure IP mathematically falls within the parent Subnet CIDR block!
    if (!isIPInCIDR(ip, subnet.cidr)) {
      throw new Error(`Validation Error: IP Address "${ip}" mathematically falls OUTSIDE of parent Subnet CIDR block "${subnet.cidr}".`);
    }

    // Check duplicate in same Subnet
    const existing = this.ips.find(i => {
      if (i.subnetId !== data.subnetId) return false;
      if (version === 'IPv6' && getIPVersion(i.ipAddress) === 'IPv6') {
        return compressIPv6(i.ipAddress) === ip;
      }
      return i.ipAddress === ip;
    });
    if (existing) {
      throw new Error(`IP Address "${ip}" is already tracked in Subnet "${subnet.cidr}". Update the existing record instead.`);
    }

    const id = `ip-${ip.replace(/[\.\:]/g, '-')}-${Date.now().toString(36)}`;
    const newIp: IPAddress = {
      id,
      ipAddress: ip,
      ipVersion: version === 'IPv6' ? 'IPv6' : 'IPv4',
      subnetId: data.subnetId,
      status: data.status || 'Active',
      assignedDevice: data.assignedDevice?.trim() || '',
      description: data.description?.trim() || '',
      lastUpdated: new Date().toISOString(),
    };
    this.ips.push(newIp);
    this.logActivity('CREATE', 'IP', newIp.id, `IP ${newIp.ipAddress} (${newIp.ipVersion}) Assigned`, `Status: ${newIp.status} (Host: ${newIp.assignedDevice || 'None'})`);
    this.persist();
    this.track(mysqlEngine.saveIP(newIp));
    return newIp;
  }

  public updateIP(id: string, data: { ipAddress?: string; status?: IPStatus; assignedDevice?: string; description?: string; subnetId?: string }): IPAddress {
    const index = this.ips.findIndex(i => i.id === id);
    if (index === -1) throw new Error(`IP record with ID ${id} not found`);

    const current = this.ips[index];
    const targetSubnetId = data.subnetId || current.subnetId;
    const subnet = this.subnets.find(s => s.id === targetSubnetId);
    if (!subnet) throw new Error(`Target Subnet ${targetSubnetId} not found`);

    let targetIp = data.ipAddress ? data.ipAddress.trim() : current.ipAddress;
    if (!isValidIP(targetIp)) {
      throw new Error(`Invalid IP address: "${targetIp}"`);
    }

    const version = getIPVersion(targetIp);
    if (version === 'IPv6') {
      targetIp = compressIPv6(targetIp);
    }

    // Math validation
    if (!isIPInCIDR(targetIp, subnet.cidr)) {
      throw new Error(`Validation Error: IP Address "${targetIp}" mathematically falls OUTSIDE of parent Subnet CIDR block "${subnet.cidr}".`);
    }

    // Check duplicate
    const duplicate = this.ips.find(i => {
      if (i.id === id || i.subnetId !== targetSubnetId) return false;
      if (version === 'IPv6' && getIPVersion(i.ipAddress) === 'IPv6') {
        return compressIPv6(i.ipAddress) === targetIp;
      }
      return i.ipAddress === targetIp;
    });
    if (duplicate) {
      throw new Error(`IP Address "${targetIp}" already exists in Subnet "${subnet.cidr}".`);
    }

    current.ipAddress = targetIp;
    current.ipVersion = version === 'IPv6' ? 'IPv6' : 'IPv4';
    current.subnetId = targetSubnetId;
    if (data.status) current.status = data.status;
    if (data.assignedDevice !== undefined) current.assignedDevice = data.assignedDevice.trim();
    if (data.description !== undefined) current.description = data.description.trim();
    current.lastUpdated = new Date().toISOString();

    const actionType: ActivityLog['action'] = current.status === 'Reserved' ? 'RESERVE' : 'UPDATE';
    this.logActivity(actionType, 'IP', current.id, `IP ${current.ipAddress} Updated`, `Status: ${current.status}, Host: ${current.assignedDevice || 'None'}`);
    this.persist();
    this.track(mysqlEngine.saveIP(current));
    return current;
  }

  public deleteIP(id: string): { success: boolean; deletedId: string; ipAddress: string } {
    const ip = this.ips.find(i => i.id === id);
    if (!ip) throw new Error(`IP with ID ${id} not found`);

    this.ips = this.ips.filter(i => i.id !== id);
    this.logActivity('DELETE', 'IP', id, `IP ${ip.ipAddress} Released`, `Removed IP assignment record.`);
    this.persist();
    this.track(mysqlEngine.deleteIP(id));
    return { success: true, deletedId: id, ipAddress: ip.ipAddress };
  }

  // --- SPECIAL ACTIONS: Bulk Generate, Next Available, Reserve Next ---
  public bulkGenerateIPs(subnetId: string, options?: { count?: number; startingOffset?: number; status?: IPStatus }): { created: IPAddress[]; totalGenerated: number } {
    const subnet = this.subnets.find(s => s.id === subnetId);
    if (!subnet) throw new Error(`Subnet ${subnetId} not found`);

    const calc = parseCIDR(subnet.cidr);
    const existingIps = new Set(
      this.ips
        .filter(i => i.subnetId === subnetId)
        .map(i => calc.ipVersion === 'IPv6' ? compressIPv6(i.ipAddress) : i.ipAddress)
    );

    const offset = options?.startingOffset || 0;
    const requestedCount = options?.count || (calc.ipVersion === 'IPv4' ? Math.min(calc.usableHosts, 64) : 32);
    const status = options?.status || 'Available';
    const created: IPAddress[] = [];
    const now = new Date().toISOString();

    if (calc.ipVersion === 'IPv4') {
      const firstInt = ipToInt(calc.firstUsableHost);
      const lastInt = ipToInt(calc.lastUsableHost);
      const totalUsable = lastInt - firstInt + 1;

      for (let i = offset; i < totalUsable && created.length < requestedCount; i++) {
        const currentInt = firstInt + i;
        if (currentInt > lastInt) break;

        const ipStr = intToIp(currentInt);
        if (!existingIps.has(ipStr)) {
          const newIp: IPAddress = {
            id: `ip-${ipStr.replace(/[\.\:]/g, '-')}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
            ipAddress: ipStr,
            ipVersion: 'IPv4',
            subnetId,
            status,
            assignedDevice: '',
            description: `Bulk generated ${status} pool host`,
            lastUpdated: now,
          };
          this.ips.push(newIp);
          created.push(newIp);
          existingIps.add(ipStr);
          this.track(mysqlEngine.saveIP(newIp));
        }
      }
    } else {
      // IPv6 bulk generation
      const range = generateIPRange(subnet.cidr, 500);
      for (let i = offset; i < range.length && created.length < requestedCount; i++) {
        const ipStr = range[i];
        if (!existingIps.has(ipStr)) {
          const newIp: IPAddress = {
            id: `ip-${ipStr.replace(/[\.\:]/g, '-')}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
            ipAddress: ipStr,
            ipVersion: 'IPv6',
            subnetId,
            status,
            assignedDevice: '',
            description: `Bulk generated IPv6 ${status} pool host`,
            lastUpdated: now,
          };
          this.ips.push(newIp);
          created.push(newIp);
          existingIps.add(ipStr);
          this.track(mysqlEngine.saveIP(newIp));
        }
      }
    }

    this.logActivity('CREATE', 'IP', subnetId, `Bulk Generated ${created.length} ${calc.ipVersion} IPs`, `Populated IP slots for subnet ${subnet.cidr}`);
    this.persist();
    return { created, totalGenerated: created.length };
  }

  public getNextAvailableIP(subnetId: string): { availableIP: string | null; subnetCidr: string; totalUsable: number; allocatedCount: number; totalUsableFormatted?: string } {
    const subnet = this.subnets.find(s => s.id === subnetId);
    if (!subnet) throw new Error(`Subnet ${subnetId} not found`);

    const calc = parseCIDR(subnet.cidr);
    const trackedIps = this.ips.filter(i => i.subnetId === subnetId);

    // Any IP that is Active or Reserved is considered taken.
    const activeOrReservedSet = new Set(
      trackedIps
        .filter(i => i.status === 'Active' || i.status === 'Reserved')
        .map(i => calc.ipVersion === 'IPv6' ? compressIPv6(i.ipAddress) : i.ipAddress)
    );

    let nextAvailable: string | null = null;

    if (calc.ipVersion === 'IPv4') {
      const firstInt = ipToInt(calc.firstUsableHost);
      const lastInt = ipToInt(calc.lastUsableHost);

      for (let cur = firstInt; cur <= lastInt; cur++) {
        const candidate = intToIp(cur);
        if (!activeOrReservedSet.has(candidate)) {
          nextAvailable = candidate;
          break;
        }
      }
    } else {
      // IPv6 next available search
      const range = generateIPRange(subnet.cidr, 1000);
      for (const candidate of range) {
        if (!activeOrReservedSet.has(candidate)) {
          nextAvailable = candidate;
          break;
        }
      }
    }

    return {
      availableIP: nextAvailable,
      subnetCidr: subnet.cidr,
      totalUsable: calc.usableHosts,
      totalUsableFormatted: calc.usableHostsFormatted,
      allocatedCount: activeOrReservedSet.size,
    };
  }

  public reserveNextAvailableIP(subnetId: string, data: { assignedDevice?: string; description?: string }): IPAddress {
    const subnet = this.subnets.find(s => s.id === subnetId);
    if (!subnet) throw new Error(`Subnet ${subnetId} not found`);

    const { availableIP } = this.getNextAvailableIP(subnetId);
    if (!availableIP) {
      throw new Error(`Subnet ${subnet.cidr} has no available IP addresses remaining.`);
    }

    const version = getIPVersion(availableIP);

    // Check if there is an existing 'Available' record in DB for this IP
    const existing = this.ips.find(i => {
      if (i.subnetId !== subnetId) return false;
      if (version === 'IPv6' && getIPVersion(i.ipAddress) === 'IPv6') {
        return compressIPv6(i.ipAddress) === availableIP;
      }
      return i.ipAddress === availableIP;
    });

    if (existing) {
      existing.status = 'Reserved';
      existing.assignedDevice = data.assignedDevice?.trim() || '';
      existing.description = data.description?.trim() || 'Reserved via Next Available API';
      existing.lastUpdated = new Date().toISOString();
      this.logActivity('RESERVE', 'IP', existing.id, `Reserved IP ${existing.ipAddress}`, `Assigned to ${existing.assignedDevice || 'Reserved Pool'}`);
      this.persist();
      this.track(mysqlEngine.saveIP(existing));
      return existing;
    }

    // Create new reserved record
    const newIp: IPAddress = {
      id: `ip-${availableIP.replace(/[\.\:]/g, '-')}-${Date.now().toString(36)}`,
      ipAddress: availableIP,
      ipVersion: version === 'IPv6' ? 'IPv6' : 'IPv4',
      subnetId,
      status: 'Reserved',
      assignedDevice: data.assignedDevice?.trim() || '',
      description: data.description?.trim() || 'Reserved via Next Available API',
      lastUpdated: new Date().toISOString(),
    };
    this.ips.push(newIp);
    this.logActivity('RESERVE', 'IP', newIp.id, `Reserved IP ${newIp.ipAddress}`, `Assigned to ${newIp.assignedDevice || 'Reserved Pool'}`);
    this.persist();
    this.track(mysqlEngine.saveIP(newIp));
    return newIp;
  }

  // --- STATS & AGGREGATIONS ---
  public getStats(): IPAMStats {
    const totalDatacenters = this.datacenters.length;
    const totalVlans = this.vlans.length;
    const totalSubnets = this.subnets.length;
    const totalTrackedIPs = this.ips.length;

    let availableCount = 0;
    let reservedCount = 0;
    let activeCount = 0;
    let ipv4Count = 0;
    let ipv6Count = 0;

    for (const ip of this.ips) {
      if (ip.status === 'Active') activeCount++;
      else if (ip.status === 'Reserved') reservedCount++;
      else availableCount++;

      const v = ip.ipVersion || getIPVersion(ip.ipAddress);
      if (v === 'IPv6') ipv6Count++;
      else ipv4Count++;
    }

    let privateSubnetCount = 0;
    let publicSubnetCount = 0;
    let ipv4SubnetCount = 0;
    let ipv6SubnetCount = 0;

    for (const s of this.subnets) {
      if (s.segmentType === 'Private') privateSubnetCount++;
      else publicSubnetCount++;

      const v = s.ipVersion || getIPVersion(s.cidr);
      if (v === 'IPv6') ipv6SubnetCount++;
      else ipv4SubnetCount++;
    }

    // Datacenter utilization
    const datacenterUtilization = this.datacenters.map(dc => {
      const dcSubnets = this.subnets.filter(s => s.datacenterId === dc.id);
      const dcSubnetIds = new Set(dcSubnets.map(s => s.id));
      const dcIPs = this.ips.filter(ip => dcSubnetIds.has(ip.subnetId));

      const active = dcIPs.filter(i => i.status === 'Active').length;
      const reserved = dcIPs.filter(i => i.status === 'Reserved').length;
      const available = dcIPs.filter(i => i.status === 'Available').length;

      let totalUsableCapacity = 0;
      for (const sub of dcSubnets) {
        try {
          const c = parseCIDR(sub.cidr);
          totalUsableCapacity += (c.ipVersion === 'IPv6' ? 1000 : c.usableHosts);
        } catch {}
      }

      const allocated = active + reserved;
      const utilPercent = totalUsableCapacity > 0 ? Math.min(100, Math.round((allocated / totalUsableCapacity) * 100)) : (dcIPs.length > 0 ? 100 : 0);

      return {
        datacenterId: dc.id,
        name: dc.name,
        location: dc.location,
        totalSubnets: dcSubnets.length,
        totalTrackedIPs: dcIPs.length,
        activeIPs: active,
        reservedIPs: reserved,
        availableIPs: available,
        utilizationPercent: utilPercent,
      };
    });

    // Subnet utilization
    const subnetUtilization = this.subnets.map(sub => {
      const dc = this.datacenters.find(d => d.id === sub.datacenterId);
      const vlan = sub.vlanId ? this.vlans.find(v => v.id === sub.vlanId) : null;
      const subIPs = this.ips.filter(ip => ip.subnetId === sub.id);

      const active = subIPs.filter(i => i.status === 'Active').length;
      const reserved = subIPs.filter(i => i.status === 'Reserved').length;
      const available = subIPs.filter(i => i.status === 'Available').length;

      let usableCapacity = 0;
      let totalHosts = 0;
      let totalHostsFormatted = '0';
      let usableCapacityFormatted = '0';
      let ipVer: IPVersion = 'IPv4';

      try {
        const c = parseCIDR(sub.cidr);
        usableCapacity = c.usableHosts;
        totalHosts = c.totalHosts;
        totalHostsFormatted = c.totalHostsFormatted || totalHosts.toLocaleString();
        usableCapacityFormatted = c.usableHostsFormatted || usableCapacity.toLocaleString();
        ipVer = c.ipVersion;
      } catch {}

      const allocated = active + reserved;
      const utilPercent = usableCapacity > 0 ? Math.min(100, Math.round((allocated / (ipVer === 'IPv6' ? Math.max(allocated, 100) : usableCapacity)) * 100)) : 0;

      return {
        subnetId: sub.id,
        cidr: sub.cidr,
        ipVersion: ipVer,
        datacenterName: dc?.name || 'Unknown',
        vlanName: vlan?.name || null,
        vlanId: vlan?.vlanId || null,
        segmentType: sub.segmentType,
        totalHosts,
        usableCapacity,
        totalHostsFormatted,
        usableCapacityFormatted,
        trackedIPs: subIPs.length,
        activeIPs: active,
        reservedIPs: reserved,
        availableIPs: available,
        utilizationPercent: utilPercent,
      };
    });

    return {
      totalDatacenters,
      totalVlans,
      totalSubnets,
      totalTrackedIPs,
      statusCounts: {
        available: availableCount,
        reserved: reservedCount,
        active: activeCount,
      },
      segmentCounts: {
        private: privateSubnetCount,
        public: publicSubnetCount,
      },
      ipVersionCounts: {
        ipv4: ipv4Count,
        ipv6: ipv6Count,
      },
      ipVersionSubnetCounts: {
        ipv4: ipv4SubnetCount,
        ipv6: ipv6SubnetCount,
      },
      datacenterUtilization,
      subnetUtilization,
    };
  }

  // Multi-entity search
  public search(query: string) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      return {
        datacenters: [],
        vlans: [],
        subnets: [],
        ips: [],
      };
    }

    const matchedDCs = this.datacenters.filter(d => 
      d.name.toLowerCase().includes(q) ||
      d.location.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q)
    );

    const matchedVlans = this.vlans.filter(v => 
      v.name.toLowerCase().includes(q) ||
      v.vlanId.toString().includes(q) ||
      v.description.toLowerCase().includes(q)
    );

    const matchedSubnets = this.subnets.filter(s => 
      s.cidr.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.segmentType.toLowerCase().includes(q)
    );

    const matchedIPs = this.ips.filter(i => 
      i.ipAddress.toLowerCase().includes(q) ||
      i.assignedDevice.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.status.toLowerCase().includes(q)
    );

    return {
      datacenters: matchedDCs,
      vlans: matchedVlans,
      subnets: matchedSubnets,
      ips: matchedIPs,
    };
  }

  // --- USER PROFILE & AUTHENTICATION CRUD (PASSWORDS HASHED WITH BCRYPT, COOKIE SESSIONS) ---
  public getUsers(): UserProfile[] {
    return [...this.users];
  }

  public getUserById(id: string): UserProfile | undefined {
    return this.users.find(u => u.id === id);
  }

  public createSession(userId: string): { token: string; expiresAt: Date } {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days validity
    const sessionObj: UserSession = {
      token,
      userId,
      expiresAt: expiresAt.getTime(),
    };
    this.sessions.set(token, sessionObj);
    this.persist();
    this.track(mysqlEngine.saveSession(token, userId, expiresAt));
    return { token, expiresAt };
  }

  public getUserBySession(token?: string): UserProfile | null {
    if (!token || typeof token !== 'string') return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      this.track(mysqlEngine.deleteSession(token));
      return null;
    }
    const user = this.getUserById(session.userId);
    return user?.status === 'active' ? user : null;
  }

  public deleteSession(token?: string): void {
    if (!token) return;
    this.sessions.delete(token);
    this.persist();
    this.track(mysqlEngine.deleteSession(token));
  }

  public updateUserProfile(id: string, data: Partial<UserProfile>): UserProfile {
    const index = this.users.findIndex(u => u.id === id);
    if (index === -1) throw new Error(`User account with ID ${id} not found`);

    const current = this.users[index];

    if (data.email && data.email.trim()) {
      const email = data.email.trim().toLowerCase();
      // Check duplicate email
      const duplicate = this.users.find(u => u.id !== id && u.email.toLowerCase() === email);
      if (duplicate) {
        throw new Error(`Email address "${data.email}" is already in use by another engineer account.`);
      }
      current.email = email;
    }

    if (data.name !== undefined && data.name.trim()) current.name = data.name.trim();
    if (data.role !== undefined && data.role.trim()) current.role = data.role.trim();
    if (data.department !== undefined) current.department = data.department.trim();
    if (data.organization !== undefined) current.organization = data.organization.trim();
    if (data.location !== undefined) current.location = data.location.trim();
    if (data.phone !== undefined) current.phone = data.phone.trim();
    if (data.bio !== undefined) current.bio = data.bio.trim();
    if (data.primaryDatacenterId !== undefined) current.primaryDatacenterId = data.primaryDatacenterId;
    if (data.twoFactorEnabled !== undefined) current.twoFactorEnabled = Boolean(data.twoFactorEnabled);
    if (data.emailNotifications !== undefined) current.emailNotifications = Boolean(data.emailNotifications);
    if (data.collisionAlerts !== undefined) current.collisionAlerts = Boolean(data.collisionAlerts);
    if (data.exhaustionAlerts !== undefined) current.exhaustionAlerts = Boolean(data.exhaustionAlerts);
    if (data.themePreference !== undefined) current.themePreference = data.themePreference;

    this.logActivity('UPDATE', 'User', current.id, `Profile Updated: ${current.name}`, `Updated contact & preferences for ${current.email}`);
    this.persist();
    const hash = this.passwordHashes.get(current.id) ?? '';
    this.track(mysqlEngine.saveUser(current, hash, this.apiKeyHashes.get(current.id) ?? null));
    return current;
  }

  public createUser(data: {
    name: string;
    email: string;
    role?: string;
    department?: string;
    organization?: string;
    location?: string;
    phone?: string;
    bio?: string;
    primaryDatacenterId?: string;
    password?: string;
  }): UserProfile {
    if (!data.name?.trim()) throw new Error('Full Name is required');
    if (!data.email?.trim()) throw new Error('Email address is required');

    const email = data.email.trim().toLowerCase();
    const existing = this.users.find(u => u.email.toLowerCase() === email);
    if (existing) {
      throw new Error(`An account with email "${email}" already exists. Please sign in or use another email.`);
    }

    const id = `user-${email.split('@')[0].replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36)}`;
    const newUser: UserProfile = {
      id,
      name: data.name.trim(),
      email,
      role: data.role?.trim() || 'Senior Network Engineer',
      access: 'member',
      status: 'pending',
      datacenterIds: [],
      department: data.department?.trim() || 'Infrastructure Engineering',
      organization: data.organization?.trim() || 'BeyondIP Enterprise',
      location: data.location?.trim() || 'Corporate Headquarters',
      phone: data.phone?.trim() || '',
      bio: data.bio?.trim() || `Infrastructure engineer managing multi-region network segments and IP allocations.`,
      primaryDatacenterId: data.primaryDatacenterId || '',
      twoFactorEnabled: false,
      emailNotifications: true,
      collisionAlerts: true,
      exhaustionAlerts: true,
      themePreference: 'dark',
      apiKey: '',
      createdAt: new Date().toISOString(),
    };

    // SECURE CRYPTOGRAPHY: Password is salted and hashed with BCrypt
    if (!data.password || data.password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
    const bcryptHash = hashPasswordSync(data.password);
    this.passwordHashes.set(newUser.id, bcryptHash);

    this.users.push(newUser);
    this.logActivity('CREATE', 'User', newUser.id, `Account Requested: ${newUser.name}`, `${newUser.email} is waiting for admin approval`);
    this.persist();
    this.track(mysqlEngine.saveUser(newUser, bcryptHash, null));
    // No session: the request can't sign in until an admin approves it.
    return newUser;
  }

  public signIn(email: string, password: string): { user: UserProfile; session: { token: string; expiresAt: Date } } {
    if (!email?.trim()) throw new Error('Email address is required.');
    if (!password?.trim()) throw new Error('Password is required.');

    const cleanEmail = email.trim().toLowerCase();
    const user = this.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      throw new WrongPasswordError('Invalid email or password.');
    }

    const storedHash = this.passwordHashes.get(user.id);
    if (!storedHash) {
      throw new Error('User security credentials missing. Please contact your system administrator.');
    }

    // SECURE CRYPTOGRAPHY: BCrypt constant-time comparison
    const isMatch = verifyPasswordSync(password, storedHash);
    if (!isMatch) {
      throw new WrongPasswordError('Invalid email or password.');
    }
    // Checked after the password so these messages don't reveal which emails exist.
    if (user.status === 'pending') throw new Error('Your account is waiting for an admin to approve it.');
    if (user.status === 'disabled') throw new Error('This account has been disabled. Contact an admin.');

    this.logActivity('UPDATE', 'User', user.id, `Engineer Authenticated: ${user.name}`, `Logged into IPAM session as ${user.email}`);
    
    const session = this.createSession(user.id);
    return { user, session };
  }

  public signOutSession(token?: string): boolean {
    if (!token) return true;
    const user = this.getUserBySession(token);
    if (user) {
      this.logActivity('UPDATE', 'User', user.id, `Engineer Signed Out: ${user.name}`, `Session ended for ${user.email}`);
    }
    this.deleteSession(token);
    return true;
  }

  public getPendingRequestCount(): number {
    return this.users.filter(u => u.status === 'pending').length;
  }

  public canEditDatacenter(user: UserProfile, datacenterId: string | undefined): boolean {
    return user.access === 'admin' || (!!datacenterId && user.datacenterIds.includes(datacenterId));
  }

  // Admin panel: approve, (dis)able, change access level and datacenter rights.
  public updateUserAccess(
    actorId: string,
    id: string,
    data: Partial<Pick<UserProfile, 'access' | 'status' | 'datacenterIds'>>,
  ): UserProfile {
    const user = this.users.find(u => u.id === id);
    if (!user) throw new Error('User not found');
    if (id === actorId && ((data.access && data.access !== user.access) || (data.status && data.status !== user.status))) {
      throw new Error("You can't change your own access level or status.");
    }
    if (data.access !== undefined && !['admin', 'member'].includes(data.access)) throw new Error('Access must be admin or member.');
    if (data.status !== undefined && !['pending', 'active', 'disabled'].includes(data.status)) throw new Error('Unknown account status.');
    if (data.datacenterIds !== undefined) {
      if (!Array.isArray(data.datacenterIds)) throw new Error('datacenterIds must be a list.');
      const unknown = data.datacenterIds.find(dcId => !this.getDatacenterById(dcId));
      if (unknown) throw new Error(`Datacenter ${unknown} does not exist.`);
    }
    const losesAdmin = user.access === 'admin' && user.status === 'active' && (data.access === 'member' || (data.status && data.status !== 'active'));
    if (losesAdmin && this.users.filter(u => u.access === 'admin' && u.status === 'active').length === 1) {
      throw new Error('There must be at least one active admin.');
    }

    const wasPending = user.status === 'pending';
    if (data.access !== undefined) user.access = data.access;
    if (data.status !== undefined) user.status = data.status;
    if (data.datacenterIds !== undefined) user.datacenterIds = [...new Set(data.datacenterIds.map(String))];
    if (user.status !== 'active') this.deleteSessionsFor(user.id);

    const what = wasPending && user.status === 'active' ? 'Account Approved' : 'Access Updated';
    this.logActivity('UPDATE', 'User', user.id, `${what}: ${user.name}`, `${user.access}, ${user.status}, ${user.datacenterIds.length} datacenter(s)`);
    this.persist();
    this.track(mysqlEngine.saveUser(user, this.passwordHashes.get(user.id) ?? '', this.apiKeyHashes.get(user.id) ?? null));
    return user;
  }

  public deleteUser(actorId: string, id: string): void {
    const user = this.users.find(u => u.id === id);
    if (!user) throw new Error('User not found');
    if (id === actorId) throw new Error("You can't delete your own account.");
    if (user.access === 'admin' && user.status === 'active' && this.users.filter(u => u.access === 'admin' && u.status === 'active').length === 1) {
      throw new Error('There must be at least one active admin.');
    }
    this.users = this.users.filter(u => u.id !== id);
    this.passwordHashes.delete(id);
    this.apiKeyHashes.delete(id);
    this.deleteSessionsFor(id);
    this.logActivity('DELETE', 'User', id, `Account Deleted: ${user.name}`, `Removed ${user.email}`);
    this.persist();
    this.track(mysqlEngine.deleteUser(id));
  }

  private deleteSessionsFor(userId: string, keepToken?: string): void {
    for (const [token, session] of this.sessions) {
      if (session.userId === userId && token !== keepToken) this.sessions.delete(token);
    }
    this.track(mysqlEngine.deleteUserSessions(userId, keepToken));
  }

  // Signs the user out everywhere except the session they changed it from.
  public changePassword(userId: string, currentPassword: string, newPassword: string, keepToken: string): void {
    const user = this.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found');
    if (!verifyPasswordSync(currentPassword ?? '', this.passwordHashes.get(userId) ?? '')) throw new WrongPasswordError('Your current password is wrong.');
    this.setPassword(user, newPassword, keepToken);
    this.logActivity('UPDATE', 'User', user.id, `Password Changed: ${user.name}`, `${user.email} changed their password`);
  }

  // For forgotten passwords: the admin hands over a temporary one, which signs the user out everywhere.
  public resetPassword(actorId: string, id: string, newPassword: string): void {
    const user = this.users.find(u => u.id === id);
    if (!user) throw new Error('User not found');
    if (id === actorId) throw new Error('Change your own password on your profile.');
    this.setPassword(user, newPassword);
    this.logActivity('UPDATE', 'User', user.id, `Password Reset: ${user.name}`, `An admin set a temporary password for ${user.email}`);
  }

  private setPassword(user: UserProfile, newPassword: string, keepToken?: string): void {
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD) {
      throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
    }
    const hash = hashPasswordSync(newPassword);
    this.passwordHashes.set(user.id, hash);
    this.deleteSessionsFor(user.id, keepToken);
    this.persist();
    this.track(mysqlEngine.saveUser(user, hash, this.apiKeyHashes.get(user.id) ?? null));
  }

  public generateApiKey(userId: string): string {
    const user = this.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found');
    
    // Replaces any previous key, which stops working immediately.
    const { rawKey, keyHash, maskedKey } = generateSecureApiKey();
    user.apiKey = maskedKey;
    this.apiKeyHashes.set(user.id, keyHash);
    this.logActivity('UPDATE', 'User', user.id, `API Key Regenerated`, `New token issued for ${user.email}`);
    this.persist();

    const hash = this.passwordHashes.get(user.id) ?? '';
    this.track(mysqlEngine.saveUser(user, hash, keyHash));
    return rawKey;
  }

  public getUserByApiKey(key?: string): UserProfile | null {
    if (!key?.startsWith(API_KEY_PREFIX)) return null;
    const keyHash = hashSensitiveData(key);
    for (const [userId, stored] of this.apiKeyHashes) {
      if (stored === keyHash) {
        const user = this.getUserById(userId);
        return user?.status === 'active' ? user : null;
      }
    }
    return null;
  }
}

// Thrown only for a wrong email or password, so the routes can count failed attempts.
export class WrongPasswordError extends Error {}

export class DatabaseWriteError extends Error {
  status = 503;
}

export const db = new IPAMDatabase();
