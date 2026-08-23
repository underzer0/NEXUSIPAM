export type SegmentType = 'Private' | 'Public';
export type IPStatus = 'Available' | 'Reserved' | 'Active';
export type IPVersion = 'IPv4' | 'IPv6';

export interface Datacenter {
  id: string;
  name: string;
  location: string;
  description: string;
  createdAt: string;
}

export interface VLAN {
  id: string;
  vlanId: number; // 1 - 4094
  name: string;
  description: string;
  datacenterId: string;
  createdAt: string;
}

export interface Subnet {
  id: string;
  cidr: string; // e.g. "10.10.10.0/24" or "2001:db8:10::/64"
  ipVersion?: IPVersion;
  segmentType: SegmentType;
  datacenterId: string;
  vlanId: string | null;
  description: string;
  createdAt: string;
}

export interface IPAddress {
  id: string;
  ipAddress: string;
  ipVersion?: IPVersion;
  subnetId: string;
  status: IPStatus;
  assignedDevice: string;
  description: string;
  lastUpdated: string;
}

export interface ActivityLog {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESERVE';
  entityType: 'Datacenter' | 'VLAN' | 'Subnet' | 'IP';
  entityId: string;
  title: string;
  detail: string;
  timestamp: string;
}

export interface SubnetCalculation {
  cidr: string;
  ip: string;
  prefix: number;
  ipVersion: IPVersion;
  netmask: string;
  wildcard: string;
  networkAddress: string;
  broadcastAddress: string;
  firstUsableHost: string;
  lastUsableHost: string;
  totalHosts: number;
  usableHosts: number;
  totalHostsFormatted?: string;
  usableHostsFormatted?: string;
  isPrivate: boolean;
  binaryNetmask: string;
  expandedAddress?: string;
  compressedAddress?: string;
  prefixType?: string;
}

export interface IPAMStats {
  totalDatacenters: number;
  totalVlans: number;
  totalSubnets: number;
  totalTrackedIPs: number;
  statusCounts: {
    available: number;
    reserved: number;
    active: number;
  };
  segmentCounts: {
    private: number;
    public: number;
  };
  ipVersionCounts?: {
    ipv4: number;
    ipv6: number;
  };
  ipVersionSubnetCounts?: {
    ipv4: number;
    ipv6: number;
  };
  datacenterUtilization: Array<{
    datacenterId: string;
    name: string;
    location: string;
    totalSubnets: number;
    totalTrackedIPs: number;
    activeIPs: number;
    reservedIPs: number;
    availableIPs: number;
    utilizationPercent: number;
  }>;
  subnetUtilization: Array<{
    subnetId: string;
    cidr: string;
    ipVersion?: IPVersion;
    datacenterName: string;
    vlanName: string | null;
    vlanId: number | null;
    segmentType: SegmentType;
    totalHosts: number;
    usableCapacity: number;
    totalHostsFormatted?: string;
    usableCapacityFormatted?: string;
    trackedIPs: number;
    activeIPs: number;
    reservedIPs: number;
    availableIPs: number;
    utilizationPercent: number;
  }>;
}

export interface FilterState {
  search: string;
  datacenterId: string;
  vlanId: string;
  status: string; // 'All' | 'Available' | 'Reserved' | 'Active'
  segmentType: string; // 'All' | 'Private' | 'Public'
  ipVersion?: string; // 'All' | 'IPv4' | 'IPv6'
  subnetId: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  organization: string;
  location: string;
  phone?: string;
  bio: string;
  primaryDatacenterId?: string;
  twoFactorEnabled: boolean;
  emailNotifications: boolean;
  collisionAlerts: boolean;
  exhaustionAlerts: boolean;
  themePreference?: 'system' | 'dark' | 'light';
  apiKey?: string;
  createdAt: string;
  avatarUrl?: string;
}

export type WSAction = 
  | 'INIT_STATE'
  | 'DATACENTER_CREATED'
  | 'DATACENTER_UPDATED'
  | 'DATACENTER_DELETED'
  | 'VLAN_CREATED'
  | 'VLAN_UPDATED'
  | 'VLAN_DELETED'
  | 'SUBNET_CREATED'
  | 'SUBNET_UPDATED'
  | 'SUBNET_DELETED'
  | 'IP_CREATED'
  | 'IP_UPDATED'
  | 'IP_DELETED'
  | 'BULK_IPS_CREATED'
  | 'ACTIVITY_LOG'
  | 'USER_UPDATED'
  | 'USER_CREATED';

export interface WSMessage {
  type: WSAction;
  payload: any;
  timestamp: string;
}
