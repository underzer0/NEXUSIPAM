import fs from 'fs';
import path from 'path';
import { Datacenter, VLAN, Subnet, IPAddress, ActivityLog, IPAMStats, SegmentType, IPStatus, UserProfile, IPVersion } from '../src/types/ipam';
import { isIPInCIDR, isValidCIDR, isValidIP, isValidIPv4, isValidIPv6, parseCIDR, isPrivateRFC1918, ipToInt, intToIp, getIPVersion, compressIPv6, generateIPRange } from '../src/utils/ipCalculator';

class IPAMDatabase {
  private datacenters: Datacenter[] = [];
  private vlans: VLAN[] = [];
  private subnets: Subnet[] = [];
  private ips: IPAddress[] = [];
  private activityLogs: ActivityLog[] = [];
  private users: UserProfile[] = [];
  private passwords: Map<string, string> = new Map();
  private currentUserId: string = '';
  private dataDir: string;
  private dbFilePath: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.dbFilePath = path.join(this.dataDir, 'ipam-database.json');
    this.initializeStore();
  }

  private initializeStore(): void {
    const loaded = this.loadFromFile();
    if (!loaded) {
      console.log('[IPAM Storage] Initializing fresh clean database with disk persistence enabled.');
      this.datacenters = [];
      this.vlans = [];
      this.subnets = [];
      this.ips = [];
      this.activityLogs = [];
      this.users = [];
      this.passwords = new Map();
      this.currentUserId = '';
      this.persist();
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
          this.passwords = new Map(Object.entries(data.passwords || {}));
          this.currentUserId = typeof data.currentUserId === 'string' ? data.currentUserId : (this.users[0]?.id || '');
          console.log(`[IPAM Storage] Successfully loaded from disk (${this.dbFilePath}): ${this.datacenters.length} Datacenters, ${this.vlans.length} VLANs, ${this.subnets.length} Subnets, ${this.ips.length} IPs, ${this.users.length} Users.`);
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

      const payload = {
        version: 1,
        lastSaved: new Date().toISOString(),
        datacenters: this.datacenters,
        vlans: this.vlans,
        subnets: this.subnets,
        ips: this.ips,
        activityLogs: this.activityLogs,
        users: this.users,
        passwords: Object.fromEntries(this.passwords.entries()),
        currentUserId: this.currentUserId,
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
    this.persist();
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
    this.persist();
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
      throw new Error(`Invalid CIDR format: "${data.cidr}". Expected IPv4 (e.g. 10.10.10.0/24) or IPv6 (e.g. 2001:db8::/64, fd00:10::/64)`);
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

    const id = `sub-${normalizedCidr.replace(/[\.\:\/]/g, '-')}-${Date.now().toString(36)}`;
    const newSubnet: Subnet = {
      id,
      cidr: normalizedCidr,
      ipVersion: calc.ipVersion,
      segmentType,
      datacenterId: data.datacenterId,
      vlanId: data.vlanId || null,
      description: data.description?.trim() || `${calc.ipVersion} ${segmentType} Subnet ${normalizedCidr}`,
      createdAt: new Date().toISOString(),
    };
    this.subnets.push(newSubnet);
    this.logActivity('CREATE', 'Subnet', newSubnet.id, `Subnet ${newSubnet.cidr} (${calc.ipVersion}) Created`, `Configured as ${segmentType} in ${dc.name}`);
    this.persist();
    return newSubnet;
  }

  public updateSubnet(id: string, data: { cidr?: string; segmentType?: SegmentType; datacenterId?: string; vlanId?: string | null; description?: string }): Subnet {
    const index = this.subnets.findIndex(s => s.id === id);
    if (index === -1) throw new Error(`Subnet ${id} not found`);

    const current = this.subnets[index];
    const targetDcId = data.datacenterId || current.datacenterId;
    const targetCidr = data.cidr ? data.cidr.trim() : current.cidr;

    if (!isValidCIDR(targetCidr)) {
      throw new Error(`Invalid CIDR format: "${targetCidr}". Expected IPv4 or IPv6 CIDR (e.g. 10.10.10.0/24 or 2001:db8::/64)`);
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
    current.ipVersion = calc.ipVersion;
    current.datacenterId = targetDcId;
    if (data.segmentType) current.segmentType = data.segmentType;
    if (data.description !== undefined) current.description = data.description.trim();

    this.logActivity('UPDATE', 'Subnet', current.id, `Subnet ${current.cidr} Updated`, `Updated settings for subnet in DC.`);
    this.persist();
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
    this.persist();
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
    return current;
  }

  public deleteIP(id: string): { success: boolean; deletedId: string; ipAddress: string } {
    const ip = this.ips.find(i => i.id === id);
    if (!ip) throw new Error(`IP with ID ${id} not found`);

    this.ips = this.ips.filter(i => i.id !== id);
    this.logActivity('DELETE', 'IP', id, `IP ${ip.ipAddress} Released`, `Removed IP assignment record.`);
    this.persist();
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

  // --- USER PROFILE & AUTHENTICATION CRUD ---
  public getUsers(): UserProfile[] {
    return [...this.users];
  }

  public getCurrentUser(): UserProfile | null {
    if (this.currentUserId) {
      const user = this.users.find(u => u.id === this.currentUserId);
      if (user) return user;
    }
    if (this.users.length > 0) return this.users[0];
    return null;
  }

  public getUserById(id: string): UserProfile | undefined {
    return this.users.find(u => u.id === id);
  }

  public switchUser(id: string): UserProfile {
    const user = this.users.find(u => u.id === id);
    if (!user) throw new Error(`User account ${id} not found`);
    this.currentUserId = user.id;
    this.logActivity('UPDATE', 'Datacenter', user.id, `User Switched: ${user.name}`, `Active engineer session updated to ${user.email}`);
    this.persist();
    return user;
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

    this.logActivity('UPDATE', 'Datacenter', current.id, `Profile Updated: ${current.name}`, `Updated contact & preferences for ${current.email}`);
    this.persist();
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
    const randomHex = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    
    const newUser: UserProfile = {
      id,
      name: data.name.trim(),
      email,
      role: data.role?.trim() || 'Principal Network Architect',
      department: data.department?.trim() || 'Infrastructure & Network Engineering',
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
      apiKey: `nx_live_${randomHex}`,
      createdAt: new Date().toISOString(),
    };

    this.users.push(newUser);
    if (data.password) {
      this.passwords.set(newUser.id, data.password);
    } else {
      this.passwords.set(newUser.id, 'password123');
    }
    this.currentUserId = newUser.id;
    this.logActivity('CREATE', 'Datacenter', newUser.id, `New Account Created: ${newUser.name}`, `Registered ${newUser.email} with ${newUser.role} role`);
    this.persist();
    return newUser;
  }

  public signIn(email: string, password: string): UserProfile {
    if (!email?.trim()) throw new Error('Email address is required.');
    if (!password?.trim()) throw new Error('Password is required.');

    const cleanEmail = email.trim().toLowerCase();
    const user = this.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      throw new Error(`No account found with email "${email}". Please verify your email or create an account.`);
    }

    const storedPass = this.passwords.get(user.id) || 'password123';
    if (storedPass !== password) {
      throw new Error('Invalid credentials. Please verify your password.');
    }

    this.currentUserId = user.id;
    this.logActivity('UPDATE', 'Datacenter', user.id, `Engineer Authenticated: ${user.name}`, `Logged into IPAM session as ${user.email}`);
    this.persist();
    return user;
  }

  public signOut(): boolean {
    const user = this.getCurrentUser();
    if (user) {
      this.logActivity('UPDATE', 'Datacenter', user.id, `Engineer Signed Out: ${user.name}`, `Session ended for ${user.email}`);
    }
    this.currentUserId = '';
    this.persist();
    return true;
  }

  public generateApiKey(userId: string): string {
    const user = this.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found');
    const randomHex = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    user.apiKey = `nx_live_${randomHex}`;
    this.logActivity('UPDATE', 'Datacenter', user.id, `API Key Regenerated`, `New token issued for ${user.email}`);
    this.persist();
    return user.apiKey;
  }
}

export const db = new IPAMDatabase();
