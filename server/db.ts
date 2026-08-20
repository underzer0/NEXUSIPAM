import { Datacenter, VLAN, Subnet, IPAddress, ActivityLog, IPAMStats, SegmentType, IPStatus } from '../src/types/ipam';
import { isIPInCIDR, isValidCIDR, isValidIPv4, parseCIDR, isPrivateRFC1918, ipToInt, intToIp } from '../src/utils/ipCalculator';

class IPAMDatabase {
  private datacenters: Datacenter[] = [];
  private vlans: VLAN[] = [];
  private subnets: Subnet[] = [];
  private ips: IPAddress[] = [];
  private activityLogs: ActivityLog[] = [];

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    const now = new Date().toISOString();

    // 1. Datacenters
    this.datacenters = [
      {
        id: 'dc-east',
        name: 'DC-East',
        location: 'Ashburn, VA, USA (US-East)',
        description: 'Primary Production Datacenter & Core Cloud Fabric with Tier-4 Redundancy',
        createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
      },
      {
        id: 'dc-west',
        name: 'DC-West',
        location: 'Santa Clara, CA, USA (US-West)',
        description: 'Secondary Production & Disaster Recovery Hot-Standby Site',
        createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      },
      {
        id: 'dc-eu',
        name: 'DC-EU',
        location: 'Frankfurt, Germany (EU-Central)',
        description: 'European Enterprise Hub with Strict GDPR Data Sovereignty',
        createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
      },
      {
        id: 'dc-apac',
        name: 'DC-APAC',
        location: 'Tokyo, Japan (AP-Northeast)',
        description: 'Low-latency Financial Gateway & Asia-Pacific Edge Node',
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
    ];

    // 2. VLANs (Notice: VLAN 100 and VLAN 200 are reused across different Datacenters!)
    this.vlans = [
      // DC-East VLANs
      {
        id: 'vlan-dc-east-100',
        vlanId: 100,
        name: 'Prod-App-Backend',
        description: 'Core microservices and backend application cluster',
        datacenterId: 'dc-east',
        createdAt: new Date(Date.now() - 85 * 86400000).toISOString(),
      },
      {
        id: 'vlan-dc-east-200',
        vlanId: 200,
        name: 'DB-Cluster-HA',
        description: 'PostgreSQL primary/replica and distributed cache layer',
        datacenterId: 'dc-east',
        createdAt: new Date(Date.now() - 80 * 86400000).toISOString(),
      },
      {
        id: 'vlan-dc-east-300',
        vlanId: 300,
        name: 'OOB-Management',
        description: 'Out-of-band IPMI / iLO server management network',
        datacenterId: 'dc-east',
        createdAt: new Date(Date.now() - 75 * 86400000).toISOString(),
      },

      // DC-West VLANs (Reusing VLAN 100 and VLAN 200 for distinct DC entities)
      {
        id: 'vlan-dc-west-100',
        vlanId: 100,
        name: 'DMZ-Public-Gateway',
        description: 'Public ingress routers, WAFs, and edge proxy tier in US-West',
        datacenterId: 'dc-west',
        createdAt: new Date(Date.now() - 55 * 86400000).toISOString(),
      },
      {
        id: 'vlan-dc-west-200',
        vlanId: 200,
        name: 'DR-Database-Mirror',
        description: 'Disaster recovery asynchronous snapshot replication target',
        datacenterId: 'dc-west',
        createdAt: new Date(Date.now() - 50 * 86400000).toISOString(),
      },

      // DC-EU VLANs (Reusing VLAN 100)
      {
        id: 'vlan-dc-eu-100',
        vlanId: 100,
        name: 'EU-Web-Services',
        description: 'EU sovereign customer portals and API gateways',
        datacenterId: 'dc-eu',
        createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
      },
      {
        id: 'vlan-dc-eu-500',
        vlanId: 500,
        name: 'EU-Compliance-Audit',
        description: 'Isolated audit logging & telemetry monitoring mesh',
        datacenterId: 'dc-eu',
        createdAt: new Date(Date.now() - 35 * 86400000).toISOString(),
      },

      // DC-APAC VLANs
      {
        id: 'vlan-dc-apac-888',
        vlanId: 888,
        name: 'APAC-Trading-Core',
        description: 'Ultra low-latency order routing and FIX protocol engines',
        datacenterId: 'dc-apac',
        createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
      },
    ];

    // 3. Subnets / Prefixes
    this.subnets = [
      // DC-East Subnets
      {
        id: 'sub-east-app',
        cidr: '10.10.10.0/24',
        segmentType: 'Private',
        datacenterId: 'dc-east',
        vlanId: 'vlan-dc-east-100',
        description: 'Production App Tier (10.10.10.0/24)',
        createdAt: new Date(Date.now() - 80 * 86400000).toISOString(),
      },
      {
        id: 'sub-east-db',
        cidr: '10.10.20.0/24',
        segmentType: 'Private',
        datacenterId: 'dc-east',
        vlanId: 'vlan-dc-east-200',
        description: 'Production HA Database Tier (10.10.20.0/24)',
        createdAt: new Date(Date.now() - 78 * 86400000).toISOString(),
      },
      {
        id: 'sub-east-pub',
        cidr: '198.51.100.0/24',
        segmentType: 'Public',
        datacenterId: 'dc-east',
        vlanId: null, // Routed un-tagged public block
        description: 'US-East Public BGP Anycast Prefix',
        createdAt: new Date(Date.now() - 70 * 86400000).toISOString(),
      },

      // DC-West Subnets
      {
        id: 'sub-west-dmz',
        cidr: '203.0.113.0/28',
        segmentType: 'Public',
        datacenterId: 'dc-west',
        vlanId: 'vlan-dc-west-100',
        description: 'US-West Public Edge Ingress (/28 Public VIPs)',
        createdAt: new Date(Date.now() - 50 * 86400000).toISOString(),
      },
      {
        id: 'sub-west-dr',
        cidr: '10.20.10.0/24',
        segmentType: 'Private',
        datacenterId: 'dc-west',
        vlanId: 'vlan-dc-west-200',
        description: 'US-West DR Replication Target Storage',
        createdAt: new Date(Date.now() - 48 * 86400000).toISOString(),
      },

      // DC-EU Subnets
      {
        id: 'sub-eu-web',
        cidr: '172.16.50.0/24',
        segmentType: 'Private',
        datacenterId: 'dc-eu',
        vlanId: 'vlan-dc-eu-100',
        description: 'EU Container Mesh & Microservices (172.16.50.0/24)',
        createdAt: new Date(Date.now() - 38 * 86400000).toISOString(),
      },
      {
        id: 'sub-eu-audit',
        cidr: '172.16.99.0/26',
        segmentType: 'Private',
        datacenterId: 'dc-eu',
        vlanId: 'vlan-dc-eu-500',
        description: 'EU Compliance & Telemetry (172.16.99.0/26)',
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      },

      // DC-APAC Subnets
      {
        id: 'sub-apac-core',
        cidr: '10.30.100.0/25',
        segmentType: 'Private',
        datacenterId: 'dc-apac',
        vlanId: 'vlan-dc-apac-888',
        description: 'Tokyo Financial Matching Engine Cluster',
        createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      },
    ];

    // 4. IP Addresses
    this.ips = [
      // Subnet 1: 10.10.10.0/24 (East App)
      {
        id: 'ip-10-10-10-1',
        ipAddress: '10.10.10.1',
        subnetId: 'sub-east-app',
        status: 'Active',
        assignedDevice: 'dc1-gw-core01.internal',
        description: 'Default Virtual Gateway Router (HSRP VIP)',
        lastUpdated: now,
      },
      {
        id: 'ip-10-10-10-10',
        ipAddress: '10.10.10.10',
        subnetId: 'sub-east-app',
        status: 'Active',
        assignedDevice: 'k8s-master-01.east',
        description: 'Kubernetes Control Plane Node 1',
        lastUpdated: now,
      },
      {
        id: 'ip-10-10-10-11',
        ipAddress: '10.10.10.11',
        subnetId: 'sub-east-app',
        status: 'Active',
        assignedDevice: 'k8s-master-02.east',
        description: 'Kubernetes Control Plane Node 2',
        lastUpdated: now,
      },
      {
        id: 'ip-10-10-10-12',
        ipAddress: '10.10.10.12',
        subnetId: 'sub-east-app',
        status: 'Active',
        assignedDevice: 'k8s-master-03.east',
        description: 'Kubernetes Control Plane Node 3',
        lastUpdated: now,
      },
      {
        id: 'ip-10-10-10-20',
        ipAddress: '10.10.10.20',
        subnetId: 'sub-east-app',
        status: 'Reserved',
        assignedDevice: 'ingress-controller-vip',
        description: 'Reserved for Envoy Ingress VIP rollout',
        lastUpdated: now,
      },
      {
        id: 'ip-10-10-10-21',
        ipAddress: '10.10.10.21',
        subnetId: 'sub-east-app',
        status: 'Available',
        assignedDevice: '',
        description: 'Unallocated host slot',
        lastUpdated: now,
      },
      {
        id: 'ip-10-10-10-50',
        ipAddress: '10.10.10.50',
        subnetId: 'sub-east-app',
        status: 'Active',
        assignedDevice: 'api-auth-svc-01.east',
        description: 'Authentication Microservice Cluster Worker',
        lastUpdated: now,
      },

      // Subnet 2: 10.10.20.0/24 (East DB)
      {
        id: 'ip-10-10-20-1',
        ipAddress: '10.10.20.1',
        subnetId: 'sub-east-db',
        status: 'Active',
        assignedDevice: 'dc1-db-gw.internal',
        description: 'DB VLAN Subnet Gateway Switch',
        lastUpdated: now,
      },
      {
        id: 'ip-10-10-20-5',
        ipAddress: '10.10.20.5',
        subnetId: 'sub-east-db',
        status: 'Active',
        assignedDevice: 'pg-primary-01.prod.east',
        description: 'PostgreSQL 16 High-Availability Leader',
        lastUpdated: now,
      },
      {
        id: 'ip-10-10-20-6',
        ipAddress: '10.10.20.6',
        subnetId: 'sub-east-db',
        status: 'Active',
        assignedDevice: 'pg-replica-01.prod.east',
        description: 'PostgreSQL Synchronous Standby Replica',
        lastUpdated: now,
      },
      {
        id: 'ip-10-10-20-15',
        ipAddress: '10.10.20.15',
        subnetId: 'sub-east-db',
        status: 'Reserved',
        assignedDevice: 'redis-sentinel-vip',
        description: 'Reserved for Redis Sentinel Cluster failover',
        lastUpdated: now,
      },

      // Subnet 3: 198.51.100.0/24 (East Public)
      {
        id: 'ip-198-51-100-1',
        ipAddress: '198.51.100.1',
        subnetId: 'sub-east-pub',
        status: 'Active',
        assignedDevice: 'bgp-border-router-01.east',
        description: 'Primary BGP Edge Gateway AS65001',
        lastUpdated: now,
      },
      {
        id: 'ip-198-51-100-2',
        ipAddress: '198.51.100.2',
        subnetId: 'sub-east-pub',
        status: 'Active',
        assignedDevice: 'bgp-border-router-02.east',
        description: 'Secondary BGP Edge Gateway AS65001',
        lastUpdated: now,
      },
      {
        id: 'ip-198-51-100-10',
        ipAddress: '198.51.100.10',
        subnetId: 'sub-east-pub',
        status: 'Active',
        assignedDevice: 'waf-edge-east-vip',
        description: 'Cloudflare / Akamai Ingress Shield VIP',
        lastUpdated: now,
      },
      {
        id: 'ip-198-51-100-50',
        ipAddress: '198.51.100.50',
        subnetId: 'sub-east-pub',
        status: 'Reserved',
        assignedDevice: 'vpn-ipsec-east',
        description: 'Reserved for Site-to-Site IPSec Tunnel Endpoint',
        lastUpdated: now,
      },

      // Subnet 4: 203.0.113.0/28 (West Public DMZ)
      {
        id: 'ip-203-0-113-1',
        ipAddress: '203.0.113.1',
        subnetId: 'sub-west-dmz',
        status: 'Active',
        assignedDevice: 'west-edge-fw-01',
        description: 'Palo Alto Perimeter Firewall Gateway',
        lastUpdated: now,
      },
      {
        id: 'ip-203-0-113-2',
        ipAddress: '203.0.113.2',
        subnetId: 'sub-west-dmz',
        status: 'Active',
        assignedDevice: 'west-edge-fw-02',
        description: 'Palo Alto Perimeter Firewall HA Pair',
        lastUpdated: now,
      },
      {
        id: 'ip-203-0-113-5',
        ipAddress: '203.0.113.5',
        subnetId: 'sub-west-dmz',
        status: 'Reserved',
        assignedDevice: 'west-ssl-vpn-gateway',
        description: 'Reserved for GlobalProtect Client Portal',
        lastUpdated: now,
      },

      // Subnet 5: 10.20.10.0/24 (West DR)
      {
        id: 'ip-10-20-10-1',
        ipAddress: '10.20.10.1',
        subnetId: 'sub-west-dr',
        status: 'Active',
        assignedDevice: 'west-dr-core-router',
        description: 'DR Inter-datacenter tunnel routing',
        lastUpdated: now,
      },
      {
        id: 'ip-10-20-10-50',
        ipAddress: '10.20.10.50',
        subnetId: 'sub-west-dr',
        status: 'Active',
        assignedDevice: 'dr-san-storage-target01',
        description: 'NetApp Ceph DR Storage replication target',
        lastUpdated: now,
      },

      // Subnet 6: 172.16.50.0/24 (EU Web)
      {
        id: 'ip-172-16-50-1',
        ipAddress: '172.16.50.1',
        subnetId: 'sub-eu-web',
        status: 'Active',
        assignedDevice: 'eu-gw-leaf01.fra',
        description: 'Frankfurt Leaf Switch Gateway',
        lastUpdated: now,
      },
      {
        id: 'ip-172-16-50-10',
        ipAddress: '172.16.50.10',
        subnetId: 'sub-eu-web',
        status: 'Active',
        assignedDevice: 'eu-istio-ingress.fra',
        description: 'Istio Service Mesh Gateway for EU Users',
        lastUpdated: now,
      },
      {
        id: 'ip-172-16-50-25',
        ipAddress: '172.16.50.25',
        subnetId: 'sub-eu-web',
        status: 'Reserved',
        assignedDevice: 'eu-keycloak-sso',
        description: 'Reserved for OAuth2 SSO IdP Cluster',
        lastUpdated: now,
      },

      // Subnet 7: 10.30.100.0/25 (APAC Core)
      {
        id: 'ip-10-30-100-1',
        ipAddress: '10.30.100.1',
        subnetId: 'sub-apac-core',
        status: 'Active',
        assignedDevice: 'tyo-arista-7050x.hft',
        description: 'Tokyo Ultra-low Latency L3 Switch Gateway',
        lastUpdated: now,
      },
      {
        id: 'ip-10-30-100-8',
        ipAddress: '10.30.100.8',
        subnetId: 'sub-apac-core',
        status: 'Active',
        assignedDevice: 'tyo-matching-engine-01',
        description: 'Low-latency Matching Engine Worker 1',
        lastUpdated: now,
      },
      {
        id: 'ip-10-30-100-9',
        ipAddress: '10.30.100.9',
        subnetId: 'sub-apac-core',
        status: 'Active',
        assignedDevice: 'tyo-matching-engine-02',
        description: 'Low-latency Matching Engine Worker 2',
        lastUpdated: now,
      },
    ];

    // Seed initial activity logs
    this.activityLogs = [
      {
        id: 'log-1',
        action: 'CREATE',
        entityType: 'Datacenter',
        entityId: 'dc-east',
        title: 'Datacenter Provisioned',
        detail: 'DC-East (Ashburn, VA) initialized as primary region.',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
      {
        id: 'log-2',
        action: 'CREATE',
        entityType: 'VLAN',
        entityId: 'vlan-dc-east-100',
        title: 'VLAN 100 Created',
        detail: 'VLAN 100 (Prod-App-Backend) scoped to DC-East.',
        timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
      },
      {
        id: 'log-3',
        action: 'CREATE',
        entityType: 'VLAN',
        entityId: 'vlan-dc-west-100',
        title: 'VLAN 100 Reused in DC-West',
        detail: 'VLAN 100 (DMZ-Public-Gateway) created with independent DC-West scope.',
        timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
      {
        id: 'log-4',
        action: 'CREATE',
        entityType: 'Subnet',
        entityId: 'sub-east-app',
        title: 'Subnet 10.10.10.0/24 Allocated',
        detail: 'Allocated RFC 1918 Private subnet bound to VLAN 100 in DC-East.',
        timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
      },
      {
        id: 'log-5',
        action: 'RESERVE',
        entityType: 'IP',
        entityId: 'ip-10-10-10-20',
        title: 'IP 10.10.10.20 Reserved',
        detail: 'Reserved for ingress-controller-vip in 10.10.10.0/24.',
        timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
      },
    ];
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
    if (this.activityLogs.length > 100) {
      this.activityLogs.pop();
    }
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
    return { success: true, deletedId: id };
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

  public createVlan(data: { vlanId: number; name: string; description: string; datacenterId: string }): VLAN {
    const vlanNum = Number(data.vlanId);
    if (isNaN(vlanNum) || vlanNum < 1 || vlanNum > 4094) {
      throw new Error('VLAN ID must be an integer between 1 and 4094');
    }
    if (!data.name?.trim()) throw new Error('VLAN name is required');
    if (!data.datacenterId) throw new Error('Target Datacenter is required');

    const dc = this.datacenters.find(d => d.id === data.datacenterId);
    if (!dc) throw new Error(`Datacenter with ID ${data.datacenterId} does not exist`);

    // Uniqueness constraint: (datacenterId + vlanId) must be unique
    const existing = this.vlans.find(v => v.datacenterId === data.datacenterId && v.vlanId === vlanNum);
    if (existing) {
      throw new Error(`VLAN ID ${vlanNum} already exists in Datacenter "${dc.name}". VLAN IDs must be unique within the same Datacenter.`);
    }

    const id = `vlan-${data.datacenterId}-${vlanNum}-${Date.now().toString(36)}`;
    const newVlan: VLAN = {
      id,
      vlanId: vlanNum,
      name: data.name.trim(),
      description: data.description?.trim() || '',
      datacenterId: data.datacenterId,
      createdAt: new Date().toISOString(),
    };
    this.vlans.push(newVlan);
    this.logActivity('CREATE', 'VLAN', newVlan.id, `VLAN ${vlanNum} Created`, `Assigned "${newVlan.name}" in ${dc.name}`);
    return newVlan;
  }

  public updateVlan(id: string, data: { vlanId?: number; name?: string; description?: string; datacenterId?: string }): VLAN {
    const index = this.vlans.findIndex(v => v.id === id);
    if (index === -1) throw new Error(`VLAN ${id} not found`);

    const current = this.vlans[index];
    const targetDcId = data.datacenterId || current.datacenterId;
    const targetVlanId = data.vlanId !== undefined ? Number(data.vlanId) : current.vlanId;

    if (isNaN(targetVlanId) || targetVlanId < 1 || targetVlanId > 4094) {
      throw new Error('VLAN ID must be an integer between 1 and 4094');
    }

    // Verify Datacenter exists
    const dc = this.datacenters.find(d => d.id === targetDcId);
    if (!dc) throw new Error(`Datacenter ${targetDcId} does not exist`);

    // Check duplicate in same DC
    const duplicate = this.vlans.find(v => v.id !== id && v.datacenterId === targetDcId && v.vlanId === targetVlanId);
    if (duplicate) {
      throw new Error(`VLAN ID ${targetVlanId} already exists in Datacenter "${dc.name}".`);
    }

    if (data.name) current.name = data.name.trim();
    if (data.description !== undefined) current.description = data.description.trim();
    current.datacenterId = targetDcId;
    current.vlanId = targetVlanId;

    this.logActivity('UPDATE', 'VLAN', current.id, `VLAN ${current.vlanId} Updated`, `Updated "${current.name}" in ${dc.name}`);
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

  public createSubnet(data: { cidr: string; segmentType?: SegmentType; datacenterId: string; vlanId?: string | null; description?: string }): Subnet {
    if (!data.cidr?.trim()) throw new Error('CIDR notation is required');
    if (!isValidCIDR(data.cidr.trim())) {
      throw new Error(`Invalid CIDR format: "${data.cidr}". Expected format: a.b.c.d/prefix (e.g. 10.10.10.0/24)`);
    }

    const calc = parseCIDR(data.cidr.trim());
    const normalizedCidr = calc.cidr;

    if (!data.datacenterId) throw new Error('Datacenter is required for Subnet');
    const dc = this.datacenters.find(d => d.id === data.datacenterId);
    if (!dc) throw new Error(`Datacenter with ID ${data.datacenterId} not found`);

    if (data.vlanId) {
      const vlan = this.vlans.find(v => v.id === data.vlanId);
      if (!vlan) throw new Error(`VLAN with ID ${data.vlanId} not found`);
      if (vlan.datacenterId !== data.datacenterId) {
        throw new Error(`Selected VLAN (ID: ${vlan.vlanId}) belongs to a different Datacenter! VLANs must match the Subnet's Datacenter.`);
      }
    }

    // Check duplicate CIDR in same Datacenter
    const duplicate = this.subnets.find(s => s.datacenterId === data.datacenterId && s.cidr === normalizedCidr);
    if (duplicate) {
      throw new Error(`Subnet CIDR ${normalizedCidr} is already assigned in Datacenter "${dc.name}".`);
    }

    // Determine segment type (auto-detect if not provided, or respect user selection)
    const inferredType: SegmentType = calc.isPrivate ? 'Private' : 'Public';
    const segmentType: SegmentType = data.segmentType || inferredType;

    const id = `sub-${normalizedCidr.replace(/[\.\/]/g, '-')}-${Date.now().toString(36)}`;
    const newSubnet: Subnet = {
      id,
      cidr: normalizedCidr,
      segmentType,
      datacenterId: data.datacenterId,
      vlanId: data.vlanId || null,
      description: data.description?.trim() || `${segmentType} Subnet ${normalizedCidr}`,
      createdAt: new Date().toISOString(),
    };
    this.subnets.push(newSubnet);
    this.logActivity('CREATE', 'Subnet', newSubnet.id, `Subnet ${newSubnet.cidr} Created`, `Configured as ${segmentType} in ${dc.name}`);
    return newSubnet;
  }

  public updateSubnet(id: string, data: { cidr?: string; segmentType?: SegmentType; datacenterId?: string; vlanId?: string | null; description?: string }): Subnet {
    const index = this.subnets.findIndex(s => s.id === id);
    if (index === -1) throw new Error(`Subnet ${id} not found`);

    const current = this.subnets[index];
    const targetDcId = data.datacenterId || current.datacenterId;
    const targetCidr = data.cidr ? data.cidr.trim() : current.cidr;

    if (!isValidCIDR(targetCidr)) {
      throw new Error(`Invalid CIDR format: "${targetCidr}". Expected format: a.b.c.d/prefix (e.g. 10.10.10.0/24)`);
    }

    const calc = parseCIDR(targetCidr);
    const normalizedCidr = calc.cidr;

    // Check duplicate in same DC
    const duplicate = this.subnets.find(s => s.id !== id && s.datacenterId === targetDcId && s.cidr === normalizedCidr);
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

    if (data.vlanId !== undefined) {
      if (data.vlanId) {
        const vlan = this.vlans.find(v => v.id === data.vlanId);
        if (!vlan) throw new Error(`VLAN ${data.vlanId} not found`);
        if (vlan.datacenterId !== targetDcId) {
          throw new Error(`Selected VLAN belongs to a different Datacenter.`);
        }
        current.vlanId = data.vlanId;
      } else {
        current.vlanId = null;
      }
    }

    current.cidr = normalizedCidr;
    current.datacenterId = targetDcId;
    if (data.segmentType) current.segmentType = data.segmentType;
    if (data.description !== undefined) current.description = data.description.trim();

    this.logActivity('UPDATE', 'Subnet', current.id, `Subnet ${current.cidr} Updated`, `Updated settings for subnet in DC.`);
    return current;
  }

  public deleteSubnet(id: string): { success: boolean; deletedId: string; deletedIPCount: number } {
    const subnet = this.subnets.find(s => s.id === id);
    if (!subnet) throw new Error(`Subnet ${id} not found`);

    const deletedIPCount = this.ips.filter(ip => ip.subnetId === id).length;
    // Remove all associated IPs
    this.ips = this.ips.filter(ip => ip.subnetId !== id);
    this.subnets = this.subnets.filter(s => s.id !== id);

    this.logActivity('DELETE', 'Subnet', id, `Subnet ${subnet.cidr} Deleted`, `Removed subnet and purged ${deletedIPCount} child IP assignment(s).`);
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
    const ip = data.ipAddress?.trim();
    if (!isValidIPv4(ip)) {
      throw new Error(`Invalid IPv4 address: "${ip}"`);
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
    const existing = this.ips.find(i => i.subnetId === data.subnetId && i.ipAddress === ip);
    if (existing) {
      throw new Error(`IP Address "${ip}" is already tracked in Subnet "${subnet.cidr}". Update the existing record instead.`);
    }

    const id = `ip-${ip.replace(/\./g, '-')}-${Date.now().toString(36)}`;
    const newIp: IPAddress = {
      id,
      ipAddress: ip,
      subnetId: data.subnetId,
      status: data.status || 'Active',
      assignedDevice: data.assignedDevice?.trim() || '',
      description: data.description?.trim() || '',
      lastUpdated: new Date().toISOString(),
    };
    this.ips.push(newIp);
    this.logActivity('CREATE', 'IP', newIp.id, `IP ${newIp.ipAddress} Assigned`, `Status: ${newIp.status} (Host: ${newIp.assignedDevice || 'None'})`);
    return newIp;
  }

  public updateIP(id: string, data: { ipAddress?: string; status?: IPStatus; assignedDevice?: string; description?: string; subnetId?: string }): IPAddress {
    const index = this.ips.findIndex(i => i.id === id);
    if (index === -1) throw new Error(`IP record with ID ${id} not found`);

    const current = this.ips[index];
    const targetSubnetId = data.subnetId || current.subnetId;
    const subnet = this.subnets.find(s => s.id === targetSubnetId);
    if (!subnet) throw new Error(`Target Subnet ${targetSubnetId} not found`);

    const targetIp = data.ipAddress ? data.ipAddress.trim() : current.ipAddress;
    if (!isValidIPv4(targetIp)) {
      throw new Error(`Invalid IPv4 address: "${targetIp}"`);
    }

    // Math validation
    if (!isIPInCIDR(targetIp, subnet.cidr)) {
      throw new Error(`Validation Error: IP Address "${targetIp}" mathematically falls OUTSIDE of parent Subnet CIDR block "${subnet.cidr}".`);
    }

    // Check duplicate
    const duplicate = this.ips.find(i => i.id !== id && i.subnetId === targetSubnetId && i.ipAddress === targetIp);
    if (duplicate) {
      throw new Error(`IP Address "${targetIp}" already exists in Subnet "${subnet.cidr}".`);
    }

    current.ipAddress = targetIp;
    current.subnetId = targetSubnetId;
    if (data.status) current.status = data.status;
    if (data.assignedDevice !== undefined) current.assignedDevice = data.assignedDevice.trim();
    if (data.description !== undefined) current.description = data.description.trim();
    current.lastUpdated = new Date().toISOString();

    const actionType: ActivityLog['action'] = current.status === 'Reserved' ? 'RESERVE' : 'UPDATE';
    this.logActivity(actionType, 'IP', current.id, `IP ${current.ipAddress} Updated`, `Status: ${current.status}, Host: ${current.assignedDevice || 'None'}`);
    return current;
  }

  public deleteIP(id: string): { success: boolean; deletedId: string; ipAddress: string } {
    const ip = this.ips.find(i => i.id === id);
    if (!ip) throw new Error(`IP with ID ${id} not found`);

    this.ips = this.ips.filter(i => i.id !== id);
    this.logActivity('DELETE', 'IP', id, `IP ${ip.ipAddress} Released`, `Removed IP assignment record.`);
    return { success: true, deletedId: id, ipAddress: ip.ipAddress };
  }

  // --- SPECIAL ACTIONS: Bulk Generate, Next Available, Reserve Next ---
  public bulkGenerateIPs(subnetId: string, options?: { count?: number; startingOffset?: number; status?: IPStatus }): { created: IPAddress[]; totalGenerated: number } {
    const subnet = this.subnets.find(s => s.id === subnetId);
    if (!subnet) throw new Error(`Subnet ${subnetId} not found`);

    const calc = parseCIDR(subnet.cidr);
    const existingIps = new Set(this.ips.filter(i => i.subnetId === subnetId).map(i => i.ipAddress));

    const firstInt = ipToInt(calc.firstUsableHost);
    const lastInt = ipToInt(calc.lastUsableHost);
    const totalUsable = lastInt - firstInt + 1;

    const offset = options?.startingOffset || 0;
    const requestedCount = options?.count || Math.min(totalUsable, 64);
    const status = options?.status || 'Available';

    const created: IPAddress[] = [];
    const now = new Date().toISOString();

    for (let i = offset; i < totalUsable && created.length < requestedCount; i++) {
      const currentInt = firstInt + i;
      if (currentInt > lastInt) break;

      const ipStr = intToIp(currentInt);
      if (!existingIps.has(ipStr)) {
        const newIp: IPAddress = {
          id: `ip-${ipStr.replace(/\./g, '-')}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
          ipAddress: ipStr,
          subnetId,
          status,
          assignedDevice: '',
          description: `Bulk generated ${status} pool host`,
          lastUpdated: now,
        };
        this.ips.push(newIp);
        created.push(newIp);
        existingIps.add(ipStr);
      }
    }

    this.logActivity('CREATE', 'IP', subnetId, `Bulk Generated ${created.length} IPs`, `Populated IP slots for subnet ${subnet.cidr}`);
    return { created, totalGenerated: created.length };
  }

  public getNextAvailableIP(subnetId: string): { availableIP: string | null; subnetCidr: string; totalUsable: number; allocatedCount: number } {
    const subnet = this.subnets.find(s => s.id === subnetId);
    if (!subnet) throw new Error(`Subnet ${subnetId} not found`);

    const calc = parseCIDR(subnet.cidr);
    const trackedIps = this.ips.filter(i => i.subnetId === subnetId);

    // Any IP that is Active or Reserved is considered taken. If an IP is marked 'Available' in DB, it is a candidate!
    // Also any IP in the CIDR range that is not in DB at all is available.
    const activeOrReservedSet = new Set(
      trackedIps
        .filter(i => i.status === 'Active' || i.status === 'Reserved')
        .map(i => i.ipAddress)
    );

    const firstInt = ipToInt(calc.firstUsableHost);
    const lastInt = ipToInt(calc.lastUsableHost);
    let nextAvailable: string | null = null;

    for (let cur = firstInt; cur <= lastInt; cur++) {
      const candidate = intToIp(cur);
      if (!activeOrReservedSet.has(candidate)) {
        nextAvailable = candidate;
        break;
      }
    }

    return {
      availableIP: nextAvailable,
      subnetCidr: subnet.cidr,
      totalUsable: calc.usableHosts,
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

    // Check if there is an existing 'Available' record in DB for this IP
    const existing = this.ips.find(i => i.subnetId === subnetId && i.ipAddress === availableIP);
    if (existing) {
      existing.status = 'Reserved';
      existing.assignedDevice = data.assignedDevice?.trim() || '';
      existing.description = data.description?.trim() || 'Reserved via Next Available API';
      existing.lastUpdated = new Date().toISOString();
      this.logActivity('RESERVE', 'IP', existing.id, `Reserved IP ${existing.ipAddress}`, `Assigned to ${existing.assignedDevice || 'Reserved Pool'}`);
      return existing;
    }

    // Create new reserved record
    const newIp: IPAddress = {
      id: `ip-${availableIP.replace(/\./g, '-')}-${Date.now().toString(36)}`,
      ipAddress: availableIP,
      subnetId,
      status: 'Reserved',
      assignedDevice: data.assignedDevice?.trim() || '',
      description: data.description?.trim() || 'Reserved via Next Available API',
      lastUpdated: new Date().toISOString(),
    };
    this.ips.push(newIp);
    this.logActivity('RESERVE', 'IP', newIp.id, `Reserved IP ${newIp.ipAddress}`, `Assigned to ${newIp.assignedDevice || 'Reserved Pool'}`);
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

    for (const ip of this.ips) {
      if (ip.status === 'Active') activeCount++;
      else if (ip.status === 'Reserved') reservedCount++;
      else availableCount++;
    }

    let privateSubnetCount = 0;
    let publicSubnetCount = 0;
    for (const s of this.subnets) {
      if (s.segmentType === 'Private') privateSubnetCount++;
      else publicSubnetCount++;
    }

    // Datacenter utilization
    const datacenterUtilization = this.datacenters.map(dc => {
      const dcSubnets = this.subnets.filter(s => s.datacenterId === dc.id);
      const dcSubnetIds = new Set(dcSubnets.map(s => s.id));
      const dcIPs = this.ips.filter(ip => dcSubnetIds.has(ip.subnetId));

      const active = dcIPs.filter(i => i.status === 'Active').length;
      const reserved = dcIPs.filter(i => i.status === 'Reserved').length;
      const available = dcIPs.filter(i => i.status === 'Available').length;

      // Sum of usable capacities across DC subnets
      let totalUsableCapacity = 0;
      for (const sub of dcSubnets) {
        try {
          const c = parseCIDR(sub.cidr);
          totalUsableCapacity += c.usableHosts;
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
      try {
        const c = parseCIDR(sub.cidr);
        usableCapacity = c.usableHosts;
        totalHosts = c.totalHosts;
      } catch {}

      const allocated = active + reserved;
      const utilPercent = usableCapacity > 0 ? Math.min(100, Math.round((allocated / usableCapacity) * 100)) : 0;

      return {
        subnetId: sub.id,
        cidr: sub.cidr,
        datacenterName: dc?.name || 'Unknown',
        vlanName: vlan?.name || null,
        vlanId: vlan?.vlanId || null,
        segmentType: sub.segmentType,
        totalHosts,
        usableCapacity,
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
}

export const db = new IPAMDatabase();
