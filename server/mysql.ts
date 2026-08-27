import mysql, { Pool, PoolOptions, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { Datacenter, VLAN, Subnet, IPAddress, ActivityLog, UserProfile } from '../src/types/ipam';
import { hashPasswordSync, verifyPasswordSync, encryptSensitive, decryptSensitive, hashSensitiveData } from './crypto';

export interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean | any;
  connectionLimit?: number;
  connectTimeout?: number;
  uri?: string;
}

export interface MySQLStatus {
  enabled: boolean;
  connected: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  latencyMs?: number;
  tablesVerified: boolean;
  lastChecked: string;
  error?: string;
}

class MySQLEngine {
  private pool: Pool | null = null;
  private config: MySQLConfig | null = null;
  private isConnected: boolean = false;
  private schemaReady: boolean = false;
  private lastError: string | null = null;

  constructor() {
    this.loadConfig();
  }

  /**
   * Loads MySQL connection configuration from /config/mysql.config.json or environment variables
   */
  public loadConfig(): MySQLConfig | null {
    // 1. Check JSON config file in /config/mysql.config.json (Highest Priority)
    try {
      const configPath = path.join(process.cwd(), 'config', 'mysql.config.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf8');
        const json = JSON.parse(raw);
        if (json.host && json.database) {
          this.config = {
            host: json.host,
            port: Number(json.port) || 3306,
            user: json.user || 'root',
            password: json.password !== undefined ? String(json.password) : '',
            database: json.database,
            ssl: Boolean(json.ssl),
            connectionLimit: Number(json.connectionLimit) || 10,
            connectTimeout: Number(json.connectTimeout) || 8000,
          };
          return this.config;
        }
      }
    } catch (err) {
      console.warn('[MySQL] Failed to read config/mysql.config.json:', err);
    }

    // 2. Check URI / URL connection string
    const dbUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
    if (dbUrl && dbUrl.startsWith('mysql')) {
      try {
        const parsed = new URL(dbUrl);
        this.config = {
          host: parsed.hostname || 'localhost',
          port: parseInt(parsed.port || '3306', 10),
          user: decodeURIComponent(parsed.username || 'root'),
          password: decodeURIComponent(parsed.password || ''),
          database: parsed.pathname.replace(/^\//, '') || 'ipam_db',
          ssl: process.env.MYSQL_SSL === 'true',
          connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT || '10', 10),
          uri: dbUrl,
        };
        return this.config;
      } catch (err) {
        console.warn('[MySQL] Failed to parse MYSQL_URL string:', err);
      }
    }

    // 3. Check individual environment variables
    if (process.env.MYSQL_HOST || process.env.MYSQL_DATABASE || process.env.MYSQL_USER) {
      this.config = {
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        user: process.env.MYSQL_USER || 'ipam_user',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'ipam_db',
        ssl: process.env.MYSQL_SSL === 'true',
        connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT || '10', 10),
      };
      return this.config;
    }

    // Default configuration for standard local MySQL
    this.config = {
      host: 'localhost',
      port: 3306,
      user: 'ipam_user',
      password: '',
      database: 'ipam_db',
      ssl: false,
      connectionLimit: 10,
    };

    return this.config;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getConfig(): MySQLConfig | null {
    return this.config || this.loadConfig();
  }

  /**
   * Reloads /config/mysql.config.json and re-establishes connection
   */
  public async reloadConfigAndReconnect(): Promise<{ success: boolean; error?: string; latencyMs?: number }> {
    try {
      if (this.pool) {
        try {
          await this.pool.end();
        } catch {}
        this.pool = null;
      }
      this.isConnected = false;
      this.schemaReady = false;
      this.loadConfig();
      const connected = await this.initialize();
      if (connected) {
        return { success: true };
      } else {
        return { success: false, error: this.lastError || 'Could not connect to MySQL' };
      }
    } catch (err: any) {
      this.isConnected = false;
      this.lastError = err.message || String(err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Connects to MySQL and establishes connection pool
   */
  public async initialize(): Promise<boolean> {
    if (!this.config) {
      this.loadConfig();
    }

    try {
      const poolOptions: PoolOptions = {
        host: this.config!.host,
        port: this.config!.port,
        user: this.config!.user,
        password: this.config!.password,
        database: this.config!.database,
        waitForConnections: true,
        connectionLimit: this.config!.connectionLimit || 10,
        queueLimit: 0,
        connectTimeout: 8000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        ssl: this.config!.ssl ? { rejectUnauthorized: false } : undefined,
      };

      this.pool = mysql.createPool(poolOptions);
      
      // Test ping connection
      const start = Date.now();
      const [res] = await this.pool.query<RowDataPacket[]>('SELECT 1 as ping');
      const latency = Date.now() - start;

      this.isConnected = true;
      this.lastError = null;
      console.log(`[MySQL] Connection established to ${this.config!.user}@${this.config!.host}:${this.config!.port}/${this.config!.database} (${latency}ms)`);

      // Initialize database schema tables
      await this.ensureSchema();
      return true;
    } catch (err: any) {
      this.isConnected = false;
      this.lastError = err.message || String(err);
      console.warn(`[MySQL Notice] Could not connect to MySQL server (${this.config?.host}:${this.config?.port}/${this.config?.database}): ${err.message}. Ready to connect when MySQL is online.`);
      return false;
    }
  }

  /**
   * Initializes all required relational tables with constraints and indexes
   */
  public async ensureSchema(): Promise<void> {
    if (!this.pool) return;

    try {
      // 1. Datacenters
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS datacenters (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(128) NOT NULL UNIQUE,
          location VARCHAR(128) NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_dc_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // 2. VLANs
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS vlans (
          id VARCHAR(64) PRIMARY KEY,
          vlan_id INT NOT NULL,
          name VARCHAR(128) NOT NULL,
          description TEXT,
          datacenter_id VARCHAR(64) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_dc_vlan (datacenter_id, vlan_id),
          INDEX idx_vlan_dc (datacenter_id),
          INDEX idx_vlan_number (vlan_id),
          CONSTRAINT fk_vlan_datacenter FOREIGN KEY (datacenter_id) REFERENCES datacenters(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // 3. Subnets
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS subnets (
          id VARCHAR(64) PRIMARY KEY,
          cidr VARCHAR(64) NOT NULL,
          ip_version VARCHAR(8) NOT NULL DEFAULT 'IPv4',
          segment_type VARCHAR(16) NOT NULL DEFAULT 'Private',
          datacenter_id VARCHAR(64) NOT NULL,
          vlan_id VARCHAR(64) NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_dc_cidr (datacenter_id, cidr),
          INDEX idx_subnet_dc (datacenter_id),
          INDEX idx_subnet_vlan (vlan_id),
          INDEX idx_subnet_cidr (cidr),
          CONSTRAINT fk_subnet_datacenter FOREIGN KEY (datacenter_id) REFERENCES datacenters(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // 4. IP Addresses
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ip_addresses (
          id VARCHAR(64) PRIMARY KEY,
          ip_address VARCHAR(64) NOT NULL,
          ip_version VARCHAR(8) NOT NULL DEFAULT 'IPv4',
          subnet_id VARCHAR(64) NOT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'Active',
          assigned_device VARCHAR(255) DEFAULT '',
          description TEXT,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_subnet_ip (subnet_id, ip_address),
          INDEX idx_ip_addr (ip_address),
          INDEX idx_ip_subnet (subnet_id),
          INDEX idx_ip_status (status),
          CONSTRAINT fk_ip_subnet FOREIGN KEY (subnet_id) REFERENCES subnets(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // 5. Activity Logs
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id VARCHAR(64) PRIMARY KEY,
          action VARCHAR(16) NOT NULL,
          entity_type VARCHAR(32) NOT NULL,
          entity_id VARCHAR(64) NOT NULL,
          title VARCHAR(255) NOT NULL,
          detail TEXT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_log_action (action),
          INDEX idx_log_entity (entity_type),
          INDEX idx_log_time (timestamp DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // 6. Users (with salted bcrypt password_hash and encrypted/hashed API keys)
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(128) NOT NULL,
          email VARCHAR(128) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(128) NOT NULL DEFAULT 'Principal Network Architect',
          department VARCHAR(128) DEFAULT 'Infrastructure & Network Engineering',
          organization VARCHAR(128) DEFAULT 'BeyondIP Enterprise',
          location VARCHAR(128) DEFAULT 'Corporate Headquarters',
          phone VARCHAR(32) DEFAULT '',
          bio TEXT,
          primary_datacenter_id VARCHAR(64) DEFAULT '',
          two_factor_enabled BOOLEAN DEFAULT FALSE,
          email_notifications BOOLEAN DEFAULT TRUE,
          collision_alerts BOOLEAN DEFAULT TRUE,
          exhaustion_alerts BOOLEAN DEFAULT TRUE,
          theme_preference VARCHAR(16) DEFAULT 'dark',
          api_key_hash VARCHAR(255) NULL,
          api_key_encrypted TEXT NULL,
          api_key_masked VARCHAR(64) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // 7. System Config
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS system_config (
          config_key VARCHAR(64) PRIMARY KEY,
          config_value TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      this.schemaReady = true;
      console.log('[MySQL] All 7 relational tables and foreign keys successfully verified.');
    } catch (err: any) {
      console.error('[MySQL] Error creating schema tables:', err);
      this.lastError = err.message || String(err);
    }
  }

  /**
   * Reconfigures MySQL with dynamic parameters and tests connection
   */
  public async reconfigureAndConnect(newConfig: Partial<MySQLConfig>): Promise<{ success: boolean; error?: string; latencyMs?: number }> {
    try {
      if (this.pool) {
        try {
          await this.pool.end();
        } catch {}
        this.pool = null;
      }

      this.config = {
        host: newConfig.host || this.config?.host || 'localhost',
        port: newConfig.port || this.config?.port || 3306,
        user: newConfig.user || this.config?.user || 'root',
        password: newConfig.password !== undefined ? newConfig.password : (this.config?.password || ''),
        database: newConfig.database || this.config?.database || 'ipam_db',
        ssl: newConfig.ssl !== undefined ? newConfig.ssl : Boolean(this.config?.ssl),
        connectionLimit: newConfig.connectionLimit || 10,
        uri: newConfig.uri,
      };

      // Save to config/mysql.config.json if possible
      try {
        const configDir = path.join(process.cwd(), 'config');
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        const configPath = path.join(configDir, 'mysql.config.json');
        fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      } catch (err) {
        console.warn('[MySQL] Could not save config/mysql.config.json:', err);
      }

      const connected = await this.initialize();
      if (connected) {
        return { success: true };
      } else {
        return { success: false, error: this.lastError || 'Could not connect to MySQL' };
      }
    } catch (err: any) {
      this.isConnected = false;
      this.lastError = err.message || String(err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Test a prospective configuration without overriding active pool if it fails
   */
  public async testRawConfig(testCfg: MySQLConfig): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
    let testPool: Pool | null = null;
    try {
      const poolOptions: PoolOptions = {
        host: testCfg.host,
        port: testCfg.port || 3306,
        user: testCfg.user,
        password: testCfg.password || '',
        database: testCfg.database,
        waitForConnections: false,
        connectionLimit: 1,
        connectTimeout: 7000,
        ssl: testCfg.ssl ? { rejectUnauthorized: false } : undefined,
      };

      testPool = mysql.createPool(poolOptions);
      const start = Date.now();
      await testPool.query('SELECT 1 as ping');
      const latencyMs = Date.now() - start;
      await testPool.end();
      return { success: true, latencyMs };
    } catch (err: any) {
      if (testPool) {
        try { await testPool.end(); } catch {}
      }
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Health diagnostic status
   */
  public async getStatus(): Promise<MySQLStatus> {
    const config = this.config || this.loadConfig()!;
    const status: MySQLStatus = {
      enabled: true,
      connected: false,
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      ssl: Boolean(config.ssl),
      tablesVerified: this.schemaReady,
      lastChecked: new Date().toISOString(),
      error: this.lastError || undefined,
    };

    if (this.pool) {
      try {
        const start = Date.now();
        await this.pool.query('SELECT 1 as ping');
        status.latencyMs = Date.now() - start;
        status.connected = true;
        status.error = undefined;
      } catch (err: any) {
        status.connected = false;
        status.error = err.message;
      }
    }

    return status;
  }

  // --- CRUD SYNCHRONIZATION WITH MYSQL ---

  public async loadAll(): Promise<{
    datacenters: Datacenter[];
    vlans: VLAN[];
    subnets: Subnet[];
    ips: IPAddress[];
    activityLogs: ActivityLog[];
    users: UserProfile[];
    passwords: Map<string, string>;
    currentUserId: string;
  } | null> {
    if (!this.pool || !this.isConnected) return null;

    try {
      // 1. Datacenters
      const [dcRows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM datacenters ORDER BY created_at ASC');
      const datacenters: Datacenter[] = dcRows.map(r => ({
        id: r.id,
        name: r.name,
        location: r.location,
        description: r.description || '',
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      }));

      // 2. VLANs
      const [vlanRows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM vlans ORDER BY vlan_id ASC');
      const vlans: VLAN[] = vlanRows.map(r => ({
        id: r.id,
        vlanId: Number(r.vlan_id),
        name: r.name,
        description: r.description || '',
        datacenterId: r.datacenter_id,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      }));

      // 3. Subnets
      const [subnetRows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM subnets ORDER BY created_at ASC');
      const subnets: Subnet[] = subnetRows.map(r => ({
        id: r.id,
        cidr: r.cidr,
        ipVersion: r.ip_version,
        segmentType: r.segment_type,
        datacenterId: r.datacenter_id,
        vlanId: r.vlan_id || null,
        description: r.description || '',
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      }));

      // 4. IPs
      const [ipRows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM ip_addresses ORDER BY last_updated DESC');
      const ips: IPAddress[] = ipRows.map(r => ({
        id: r.id,
        ipAddress: r.ip_address,
        ipVersion: r.ip_version,
        subnetId: r.subnet_id,
        status: r.status,
        assignedDevice: r.assigned_device || '',
        description: r.description || '',
        lastUpdated: r.last_updated ? new Date(r.last_updated).toISOString() : new Date().toISOString(),
      }));

      // 5. Activity Logs
      const [logRows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 200');
      const activityLogs: ActivityLog[] = logRows.map(r => ({
        id: r.id,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        title: r.title,
        detail: r.detail || '',
        timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
      }));

      // 6. Users
      const [userRows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM users ORDER BY created_at ASC');
      const passwords = new Map<string, string>();
      const users: UserProfile[] = userRows.map(r => {
        // Store password hash in memory map for auth verification
        passwords.set(r.id, r.password_hash);
        
        let apiKey = r.api_key_masked || '';
        if (r.api_key_encrypted) {
          try {
            apiKey = decryptSensitive(r.api_key_encrypted);
          } catch {}
        }

        return {
          id: r.id,
          name: r.name,
          email: r.email,
          role: r.role,
          department: r.department || '',
          organization: r.organization || '',
          location: r.location || '',
          phone: r.phone || '',
          bio: r.bio || '',
          primaryDatacenterId: r.primary_datacenter_id || '',
          twoFactorEnabled: Boolean(r.two_factor_enabled),
          emailNotifications: Boolean(r.email_notifications),
          collisionAlerts: Boolean(r.collision_alerts),
          exhaustionAlerts: Boolean(r.exhaustion_alerts),
          themePreference: r.theme_preference || 'dark',
          apiKey: apiKey || `nx_live_${r.id.substring(0, 8)}`,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        };
      });

      // 7. System config for active session
      let currentUserId = users[0]?.id || '';
      try {
        const [cfgRows] = await this.pool.query<RowDataPacket[]>('SELECT config_value FROM system_config WHERE config_key = ?', ['current_user_id']);
        if (cfgRows.length > 0 && cfgRows[0].config_value) {
          currentUserId = cfgRows[0].config_value;
        }
      } catch {}

      console.log(`[MySQL] Loaded ${datacenters.length} DCs, ${vlans.length} VLANs, ${subnets.length} Subnets, ${ips.length} IPs, ${users.length} Users from MySQL.`);
      return {
        datacenters,
        vlans,
        subnets,
        ips,
        activityLogs,
        users,
        passwords,
        currentUserId,
      };
    } catch (err: any) {
      console.error('[MySQL] Error loading data from MySQL database:', err);
      return null;
    }
  }

  // --- WRITE OPERATORS ---

  public async saveDatacenter(dc: Datacenter): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `INSERT INTO datacenters (id, name, location, description, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), location = VALUES(location), description = VALUES(description)`,
        [dc.id, dc.name, dc.location, dc.description, new Date(dc.createdAt)]
      );
    } catch (err) {
      console.error('[MySQL Error] saveDatacenter:', err);
    }
  }

  public async deleteDatacenter(id: string): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query('DELETE FROM datacenters WHERE id = ?', [id]);
    } catch (err) {
      console.error('[MySQL Error] deleteDatacenter:', err);
    }
  }

  public async saveVlan(vlan: VLAN): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `INSERT INTO vlans (id, vlan_id, name, description, datacenter_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE vlan_id = VALUES(vlan_id), name = VALUES(name), description = VALUES(description), datacenter_id = VALUES(datacenter_id)`,
        [vlan.id, vlan.vlanId, vlan.name, vlan.description, vlan.datacenterId, new Date(vlan.createdAt)]
      );
    } catch (err) {
      console.error('[MySQL Error] saveVlan:', err);
    }
  }

  public async deleteVlan(id: string): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query('DELETE FROM vlans WHERE id = ?', [id]);
    } catch (err) {
      console.error('[MySQL Error] deleteVlan:', err);
    }
  }

  public async saveSubnet(subnet: Subnet): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `INSERT INTO subnets (id, cidr, ip_version, segment_type, datacenter_id, vlan_id, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE cidr = VALUES(cidr), ip_version = VALUES(ip_version), segment_type = VALUES(segment_type), datacenter_id = VALUES(datacenter_id), vlan_id = VALUES(vlan_id), description = VALUES(description)`,
        [subnet.id, subnet.cidr, subnet.ipVersion, subnet.segmentType, subnet.datacenterId, subnet.vlanId, subnet.description, new Date(subnet.createdAt)]
      );
    } catch (err) {
      console.error('[MySQL Error] saveSubnet:', err);
    }
  }

  public async deleteSubnet(id: string): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query('DELETE FROM subnets WHERE id = ?', [id]);
    } catch (err) {
      console.error('[MySQL Error] deleteSubnet:', err);
    }
  }

  public async saveIP(ip: IPAddress): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `INSERT INTO ip_addresses (id, ip_address, ip_version, subnet_id, status, assigned_device, description, last_updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE ip_address = VALUES(ip_address), ip_version = VALUES(ip_version), subnet_id = VALUES(subnet_id), status = VALUES(status), assigned_device = VALUES(assigned_device), description = VALUES(description), last_updated = VALUES(last_updated)`,
        [ip.id, ip.ipAddress, ip.ipVersion, ip.subnetId, ip.status, ip.assignedDevice || '', ip.description || '', new Date(ip.lastUpdated)]
      );
    } catch (err) {
      console.error('[MySQL Error] saveIP:', err);
    }
  }

  public async deleteIP(id: string): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query('DELETE FROM ip_addresses WHERE id = ?', [id]);
    } catch (err) {
      console.error('[MySQL Error] deleteIP:', err);
    }
  }

  public async saveActivityLog(log: ActivityLog): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `INSERT INTO activity_logs (id, action, entity_type, entity_id, title, detail, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [log.id, log.action, log.entityType, log.entityId, log.title, log.detail, new Date(log.timestamp)]
      );
    } catch (err) {
      console.error('[MySQL Error] saveActivityLog:', err);
    }
  }

  public async saveUser(user: UserProfile, passwordHashOrPlain: string): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      // Ensure password is safe bcrypt hash
      let passwordHash = passwordHashOrPlain;
      if (!passwordHash.startsWith('$2a$') && !passwordHash.startsWith('$2b$')) {
        passwordHash = hashPasswordSync(passwordHash);
      }

      // API key security
      let apiKeyHash: string | null = null;
      let apiKeyEncrypted: string | null = null;
      let apiKeyMasked: string | null = null;

      if (user.apiKey) {
        apiKeyHash = hashSensitiveData(user.apiKey);
        apiKeyEncrypted = encryptSensitive(user.apiKey);
        apiKeyMasked = user.apiKey.length > 8 
          ? `${user.apiKey.substring(0, 8)}...${user.apiKey.substring(user.apiKey.length - 4)}` 
          : user.apiKey;
      }

      await this.pool.query(
        `INSERT INTO users (
           id, name, email, password_hash, role, department, organization, location, phone, bio,
           primary_datacenter_id, two_factor_enabled, email_notifications, collision_alerts, exhaustion_alerts,
           theme_preference, api_key_hash, api_key_encrypted, api_key_masked, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), email = VALUES(email), password_hash = VALUES(password_hash),
           role = VALUES(role), department = VALUES(department), organization = VALUES(organization),
           location = VALUES(location), phone = VALUES(phone), bio = VALUES(bio),
           primary_datacenter_id = VALUES(primary_datacenter_id), two_factor_enabled = VALUES(two_factor_enabled),
           email_notifications = VALUES(email_notifications), collision_alerts = VALUES(collision_alerts),
           exhaustion_alerts = VALUES(exhaustion_alerts), theme_preference = VALUES(theme_preference),
           api_key_hash = VALUES(api_key_hash), api_key_encrypted = VALUES(api_key_encrypted),
           api_key_masked = VALUES(api_key_masked)`,
        [
          user.id,
          user.name,
          user.email.toLowerCase(),
          passwordHash,
          user.role,
          user.department,
          user.organization,
          user.location,
          user.phone,
          user.bio,
          user.primaryDatacenterId || '',
          user.twoFactorEnabled ? 1 : 0,
          user.emailNotifications ? 1 : 0,
          user.collisionAlerts ? 1 : 0,
          user.exhaustionAlerts ? 1 : 0,
          user.themePreference || 'dark',
          apiKeyHash,
          apiKeyEncrypted,
          apiKeyMasked,
          new Date(user.createdAt),
        ]
      );
    } catch (err) {
      console.error('[MySQL Error] saveUser:', err);
    }
  }

  public async saveSystemConfig(key: string, value: string): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    try {
      await this.pool.query(
        `INSERT INTO system_config (config_key, config_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
        [key, value]
      );
    } catch (err) {
      console.error('[MySQL Error] saveSystemConfig:', err);
    }
  }
}

export const mysqlEngine = new MySQLEngine();
