import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Datacenter, VLAN, Subnet, IPAddress, ActivityLog, IPAMStats, FilterState, WSMessage, SegmentType, IPStatus, UserProfile } from '../types/ipam';

export type ActiveTab = 'dashboard' | 'datacenters' | 'vlans' | 'subnets' | 'ips' | 'tools' | 'admin' | 'profile' | 'signup' | 'signin';

const emptyUser: UserProfile = {
  id: '',
  name: '',
  email: '',
  role: 'Network Engineer',
  access: 'member',
  status: 'active',
  datacenterIds: [],
  department: 'Core Infrastructure',
  organization: 'BeyondIP Enterprise',
  location: 'Corporate HQ',
  phone: '',
  bio: '',
  primaryDatacenterId: '',
  twoFactorEnabled: false,
  emailNotifications: true,
  collisionAlerts: true,
  exhaustionAlerts: true,
  themePreference: 'dark',
  apiKey: '',
  createdAt: new Date().toISOString(),
};

interface IPAMContextType {
  datacenters: Datacenter[];
  vlans: VLAN[];
  subnets: Subnet[];
  ips: IPAddress[];
  stats: IPAMStats | null;
  activityLogs: ActivityLog[];
  currentUser: UserProfile;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  wsConnected: boolean;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  
  // Filtering
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  resetFilters: () => void;
  
  // Theme
  isDark: boolean;
  toggleTheme: () => void;

  // Actions
  fetchBootstrapData: () => Promise<void>;
  retryDatabaseConnection: () => Promise<boolean>;
  updateCurrentUser: (data: Partial<UserProfile>) => Promise<UserProfile>;
  signIn: (email: string, password: string) => Promise<UserProfile>;
  signOut: () => Promise<void>;
  // Sends an account request; on success the sign-in page shows authNotice.
  signUpUser: (data: { name: string; email: string; password: string }) => Promise<void>;
  authNotice: string | null;
  setAuthNotice: (notice: string | null) => void;
  isAdmin: boolean;
  // Whether the signed-in user may change subnets, VLANs and IPs in this datacenter.
  canEditDc: (datacenterId?: string) => boolean;
  // What the user may change, for pickers in dialogs; stable between renders.
  editableDatacenters: Datacenter[];
  editableSubnets: Subnet[];

  createDatacenter: (data: { name: string; location: string; description: string }) => Promise<Datacenter>;
  updateDatacenter: (id: string, data: { name?: string; location?: string; description?: string }) => Promise<Datacenter>;
  deleteDatacenter: (id: string) => Promise<void>;

  createVlan: (data: { vlanId: number; name: string; description: string; datacenterId: string }) => Promise<VLAN>;
  updateVlan: (id: string, data: { vlanId?: number; name?: string; description?: string; datacenterId?: string }) => Promise<VLAN>;
  deleteVlan: (id: string) => Promise<void>;

  createSubnet: (data: { cidr: string; segmentType?: SegmentType; datacenterId: string; vlanId?: string | null; description?: string }) => Promise<Subnet>;
  updateSubnet: (id: string, data: { cidr?: string; segmentType?: SegmentType; datacenterId?: string; vlanId?: string | null; description?: string }) => Promise<Subnet>;
  deleteSubnet: (id: string) => Promise<void>;

  createIP: (data: { ipAddress: string; subnetId: string; status: IPStatus; assignedDevice?: string; description?: string }) => Promise<IPAddress>;
  updateIP: (id: string, data: { ipAddress?: string; status?: IPStatus; assignedDevice?: string; description?: string; subnetId?: string }) => Promise<IPAddress>;
  deleteIP: (id: string) => Promise<void>;

  reserveNextIP: (subnetId: string, data: { assignedDevice?: string; description?: string }) => Promise<IPAddress>;
  bulkGenerateIPs: (subnetId: string, options: { count: number; startingOffset?: number; status?: IPStatus }) => Promise<IPAddress[]>;
  getNextAvailableIP: (subnetId: string) => Promise<{ availableIP: string | null; subnetCidr: string; totalUsable: number; allocatedCount: number }>;
}

const defaultFilters: FilterState = {
  search: '',
  datacenterId: 'All',
  vlanId: 'All',
  status: 'All',
  segmentType: 'All',
  subnetId: 'All',
};

const IPAMContext = createContext<IPAMContextType | undefined>(undefined);

export const IPAMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [datacenters, setDatacenters] = useState<Datacenter[]>([]);
  const [vlans, setVlans] = useState<VLAN[]>([]);
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [ips, setIps] = useState<IPAddress[]>([]);
  const [stats, setStats] = useState<IPAMStats | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile>(emptyUser);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ipam_theme');
      // Dark is the default look; light is opt-in.
      return saved !== 'light';
    }
    return true;
  });

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('ipam_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const resetFilters = () => setFilters(defaultFilters);

  // Fetch initial bootstrap dataset
  const fetchBootstrapData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/bootstrap');
      const json = await res.json();
      if (json.success && json.data) {
        setDatacenters(json.data.datacenters || []);
        setVlans(json.data.vlans || []);
        setSubnets(json.data.subnets || []);
        setIps(json.data.ips || []);
        setStats(json.data.stats || null);
        setActivityLogs(json.data.activityLogs || []);

        if (json.data.currentUser && json.data.currentUser.id) {
          setCurrentUser(json.data.currentUser);
          setIsAuthenticated(true);
        } else {
          setCurrentUser(emptyUser);
          setIsAuthenticated(false);
        }
        setError(null);
      } else {
        setError(json.error || 'Failed to load initial dataset');
      }
    } catch (err: any) {
      console.error('Fetch bootstrap error:', err);
      setError(err.message || 'Network error fetching data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Retry Database Connection
  const retryDatabaseConnection = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      const res = await fetch('/api/db/retry', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        await fetchBootstrapData();
        setError(null);
        return true;
      } else {
        setError(json.error || json.dbError || 'Failed to reconnect to MySQL database');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Network error attempting MySQL reconnection');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchBootstrapData]);

  // Refresh stats after mutations
  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch (err) {
      console.error('Error refreshing stats:', err);
    }
  }, []);

  // WebSocket Live Connection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let isUnmounted = false;

    const connectWs = () => {
      if (isUnmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (isUnmounted) return;
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const msg: WSMessage = JSON.parse(event.data);
            handleWsMessage(msg);
          } catch (err) {
            console.error('Failed to parse WS payload:', err);
          }
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setWsConnected(false);
          // Auto-reconnect after 3 seconds
          reconnectTimer = setTimeout(connectWs, 3000);
        };

        ws.onerror = (err) => {
          console.warn('WebSocket encountered error:', err);
          ws?.close();
        };
      } catch (err) {
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWs, 3000);
      }
    };

    const handleWsMessage = (msg: WSMessage) => {
      switch (msg.type) {
        case 'INIT_STATE':
          if (msg.payload) {
            setDatacenters(msg.payload.datacenters || []);
            setVlans(msg.payload.vlans || []);
            setSubnets(msg.payload.subnets || []);
            setIps(msg.payload.ips || []);
            setStats(msg.payload.stats || null);
            setActivityLogs(msg.payload.activityLogs || []);
            setLoading(false);
          }
          break;

        case 'USER_UPDATED':
          if (msg.payload) {
            // Broadcasts carry public fields only; keep our own private ones.
            setCurrentUser(prev => prev.id === msg.payload.id ? { ...prev, ...msg.payload } : prev);
          }
          break;

        case 'DATACENTER_CREATED':
          setDatacenters(prev => {
            if (prev.some(d => d.id === msg.payload.id)) return prev;
            return [...prev, msg.payload];
          });
          refreshStats();
          break;

        case 'DATACENTER_UPDATED':
          setDatacenters(prev => prev.map(d => d.id === msg.payload.id ? msg.payload : d));
          refreshStats();
          break;

        case 'DATACENTER_DELETED':
          setDatacenters(prev => prev.filter(d => d.id !== msg.payload.id));
          refreshStats();
          break;

        case 'VLAN_CREATED':
          setVlans(prev => {
            if (prev.some(v => v.id === msg.payload.id)) return prev;
            return [...prev, msg.payload];
          });
          refreshStats();
          break;

        case 'VLAN_UPDATED':
          setVlans(prev => prev.map(v => v.id === msg.payload.id ? msg.payload : v));
          refreshStats();
          break;

        case 'VLAN_DELETED':
          setVlans(prev => prev.filter(v => v.id !== msg.payload.id));
          refreshStats();
          break;

        case 'SUBNET_CREATED':
          setSubnets(prev => {
            if (prev.some(s => s.id === msg.payload.id)) return prev;
            return [...prev, msg.payload];
          });
          refreshStats();
          break;

        case 'SUBNET_UPDATED':
          setSubnets(prev => prev.map(s => s.id === msg.payload.id ? msg.payload : s));
          refreshStats();
          break;

        case 'SUBNET_DELETED':
          setSubnets(prev => prev.filter(s => s.id !== msg.payload.id));
          setIps(prev => prev.filter(ip => ip.subnetId !== msg.payload.id));
          refreshStats();
          break;

        case 'IP_CREATED':
          setIps(prev => {
            const idx = prev.findIndex(i => i.id === msg.payload.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = msg.payload;
              return updated;
            }
            return [msg.payload, ...prev];
          });
          refreshStats();
          break;

        case 'IP_UPDATED':
          setIps(prev => prev.map(i => i.id === msg.payload.id ? msg.payload : i));
          refreshStats();
          break;

        case 'IP_DELETED':
          setIps(prev => prev.filter(i => i.id !== msg.payload.id));
          refreshStats();
          break;

        case 'BULK_IPS_CREATED':
          if (msg.payload.created && Array.isArray(msg.payload.created)) {
            setIps(prev => {
              const newIds = new Set(msg.payload.created.map((x: any) => x.id));
              const filtered = prev.filter(i => !newIds.has(i.id));
              return [...msg.payload.created, ...filtered];
            });
            refreshStats();
          }
          break;

        case 'ACTIVITY_LOG':
          setActivityLogs(prev => [msg.payload, ...prev.slice(0, 49)]);
          break;
      }
    };

    // The server only accepts signed-in sockets; its INIT_STATE then loads the data.
    if (isAuthenticated) connectWs();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [isAuthenticated, refreshStats]);

  useEffect(() => {
    fetchBootstrapData();
  }, [fetchBootstrapData]);

  // --- ACTIONS ---

  const createDatacenter = async (data: { name: string; location: string; description: string }): Promise<Datacenter> => {
    const res = await fetch('/api/datacenters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to create Datacenter');
    setDatacenters(prev => [...prev.filter(d => d.id !== json.data.id), json.data]);
    refreshStats();
    return json.data;
  };

  const updateDatacenter = async (id: string, data: { name?: string; location?: string; description?: string }): Promise<Datacenter> => {
    const res = await fetch(`/api/datacenters/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to update Datacenter');
    setDatacenters(prev => prev.map(d => d.id === id ? json.data : d));
    refreshStats();
    return json.data;
  };

  const deleteDatacenter = async (id: string): Promise<void> => {
    const res = await fetch(`/api/datacenters/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to delete Datacenter');
    setDatacenters(prev => prev.filter(d => d.id !== id));
    refreshStats();
  };

  const createVlan = async (data: { vlanId: number; name: string; description: string; datacenterId: string }): Promise<VLAN> => {
    const res = await fetch('/api/vlans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to create VLAN');
    setVlans(prev => [...prev.filter(v => v.id !== json.data.id), json.data]);
    refreshStats();
    return json.data;
  };

  const updateVlan = async (id: string, data: { vlanId?: number; name?: string; description?: string; datacenterId?: string }): Promise<VLAN> => {
    const res = await fetch(`/api/vlans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to update VLAN');
    setVlans(prev => prev.map(v => v.id === id ? json.data : v));
    refreshStats();
    return json.data;
  };

  const deleteVlan = async (id: string): Promise<void> => {
    const res = await fetch(`/api/vlans/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to delete VLAN');
    setVlans(prev => prev.filter(v => v.id !== id));
    refreshStats();
  };

  const createSubnet = async (data: { cidr: string; segmentType?: SegmentType; datacenterId: string; vlanId?: string | null; description?: string }): Promise<Subnet> => {
    const res = await fetch('/api/subnets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to create Subnet');
    setSubnets(prev => [...prev.filter(s => s.id !== json.data.id), json.data]);
    refreshStats();
    return json.data;
  };

  const updateSubnet = async (id: string, data: { cidr?: string; segmentType?: SegmentType; datacenterId?: string; vlanId?: string | null; description?: string }): Promise<Subnet> => {
    const res = await fetch(`/api/subnets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to update Subnet');
    setSubnets(prev => prev.map(s => s.id === id ? json.data : s));
    refreshStats();
    return json.data;
  };

  const deleteSubnet = async (id: string): Promise<void> => {
    const res = await fetch(`/api/subnets/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to delete Subnet');
    setSubnets(prev => prev.filter(s => s.id !== id));
    setIps(prev => prev.filter(i => i.subnetId !== id));
    refreshStats();
  };

  const createIP = async (data: { ipAddress: string; subnetId: string; status: IPStatus; assignedDevice?: string; description?: string }): Promise<IPAddress> => {
    const res = await fetch('/api/ips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to assign IP');
    setIps(prev => [json.data, ...prev.filter(i => i.id !== json.data.id)]);
    refreshStats();
    return json.data;
  };

  const updateIP = async (id: string, data: { ipAddress?: string; status?: IPStatus; assignedDevice?: string; description?: string; subnetId?: string }): Promise<IPAddress> => {
    const res = await fetch(`/api/ips/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to update IP record');
    setIps(prev => prev.map(i => i.id === id ? json.data : i));
    refreshStats();
    return json.data;
  };

  const deleteIP = async (id: string): Promise<void> => {
    const res = await fetch(`/api/ips/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to release IP');
    setIps(prev => prev.filter(i => i.id !== id));
    refreshStats();
  };

  const reserveNextIP = async (subnetId: string, data: { assignedDevice?: string; description?: string }): Promise<IPAddress> => {
    const res = await fetch(`/api/subnets/${subnetId}/reserve-next-ip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to reserve next IP');
    setIps(prev => [json.data, ...prev.filter(i => i.id !== json.data.id)]);
    refreshStats();
    return json.data;
  };

  const bulkGenerateIPs = async (subnetId: string, options: { count: number; startingOffset?: number; status?: IPStatus }): Promise<IPAddress[]> => {
    const res = await fetch(`/api/subnets/${subnetId}/bulk-generate-ips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to generate bulk IPs');
    const created: IPAddress[] = json.data.created;
    const newIds = new Set(created.map(i => i.id));
    setIps(prev => [...created, ...prev.filter(i => !newIds.has(i.id))]);
    refreshStats();
    return created;
  };

  const fetchNextAvailableIP = async (subnetId: string) => {
    const res = await fetch(`/api/subnets/${subnetId}/next-available-ip`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch next available IP');
    return json.data;
  };

  // --- USER PROFILE & AUTH ACTIONS ---
  const updateCurrentUser = async (data: Partial<UserProfile>): Promise<UserProfile> => {
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to update profile');
      const updatedUser = json.data;
      setCurrentUser(updatedUser);
      return updatedUser;
    } catch (err: any) {
      throw err;
    }
  };

  const signIn = async (email: string, password: string): Promise<UserProfile> => {
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to authenticate');
    const user: UserProfile = json.data?.user || json.data;
    setCurrentUser(user);
    setIsAuthenticated(true);
    // Load the data over HTTP so pages work even when the live-update socket can't connect.
    await fetchBootstrapData();
    setActiveTab('dashboard');
    return user;
  };

  const signOut = async (): Promise<void> => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch (e) {
      // Ignore network error on signout
    }
    setCurrentUser(emptyUser);
    setIsAuthenticated(false);
    setActiveTab('signin');
  };

  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const signUpUser = async (data: { name: string; email: string; password: string }): Promise<void> => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to send the request');
    setAuthNotice(`Request sent for ${json.data.email}. You can sign in once an admin approves it.`);
    setActiveTab('signin');
  };

  const isAdmin = currentUser.access === 'admin';
  const canEditDc = (datacenterId?: string) => isAdmin || (!!datacenterId && currentUser.datacenterIds.includes(datacenterId));
  const editableDatacenters = useMemo(
    () => (isAdmin ? datacenters : datacenters.filter((dc) => currentUser.datacenterIds.includes(dc.id))),
    [isAdmin, datacenters, currentUser.datacenterIds],
  );
  const editableSubnets = useMemo(() => {
    if (isAdmin) return subnets;
    const ids = new Set(editableDatacenters.map((dc) => dc.id));
    return subnets.filter((s) => ids.has(s.datacenterId));
  }, [isAdmin, subnets, editableDatacenters]);

  return (
    <IPAMContext.Provider
      value={{
        datacenters,
        vlans,
        subnets,
        ips,
        stats,
        activityLogs,
        currentUser,
        isAuthenticated,
        loading,
        error,
        wsConnected,
        activeTab,
        setActiveTab,
        filters,
        setFilters,
        resetFilters,
        isDark,
        toggleTheme,
        fetchBootstrapData,
        retryDatabaseConnection,
        updateCurrentUser,
        signIn,
        signOut,
        signUpUser,
        authNotice,
        setAuthNotice,
        isAdmin,
        canEditDc,
        editableDatacenters,
        editableSubnets,
        createDatacenter,
        updateDatacenter,
        deleteDatacenter,
        createVlan,
        updateVlan,
        deleteVlan,
        createSubnet,
        updateSubnet,
        deleteSubnet,
        createIP,
        updateIP,
        deleteIP,
        reserveNextIP,
        bulkGenerateIPs,
        getNextAvailableIP: fetchNextAvailableIP,
      }}
    >
      {children}
    </IPAMContext.Provider>
  );
};

export const useIPAM = () => {
  const context = useContext(IPAMContext);
  if (!context) {
    throw new Error('useIPAM must be used within an IPAMProvider');
  }
  return context;
};
