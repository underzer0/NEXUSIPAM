import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { 
  Building2, 
  Layers, 
  Network, 
  Hash, 
  ShieldCheck, 
  Globe, 
  Lock, 
  Activity, 
  ArrowUpRight, 
  Eye, 
  Zap, 
  Server, 
  Sparkles,
  Info,
  SlidersHorizontal,
  CheckCircle2
} from 'lucide-react';
import { Subnet, IPVersion } from '../types/ipam';
import { parseCIDR, getIPVersion, formatCapacityCompact, formatCapacityDetailed } from '../utils/ipCalculator';

interface DashboardViewProps {
  onOpenSubnetVisualizer: (subnet: Subnet) => void;
  onOpenNewDatacenterModal: () => void;
  onOpenNewSubnetModal: () => void;
  onOpenReserveNextModal: (subnetId?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenSubnetVisualizer,
  onOpenNewDatacenterModal,
  onOpenNewSubnetModal,
  onOpenReserveNextModal,
}) => {
  const { 
    stats, 
    datacenters, 
    subnets, 
    ips, 
    vlans,
    activityLogs, 
    setActiveTab, 
    setFilters,
    isDark 
  } = useIPAM();

  // Active protocol tab: 'IPv4' or 'IPv6'
  const [selectedProtocol, setSelectedProtocol] = useState<IPVersion>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ipam_dashboard_protocol');
      if (saved === 'IPv6' || saved === 'IPv4') return saved;
    }
    return 'IPv4';
  });

  const [activeDCFilter, setActiveDCFilter] = useState<string>('all');

  const handleProtocolChange = (ver: IPVersion) => {
    setSelectedProtocol(ver);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ipam_dashboard_protocol', ver);
    }
    // Also reset DC filter to 'all' to avoid empty view if DC has no subnets of this protocol
    setActiveDCFilter('all');
  };

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <span className="text-xs font-mono text-slate-400">Loading Telemetry & Stats...</span>
        </div>
      </div>
    );
  }

  const isV6 = selectedProtocol === 'IPv6';

  // 1. Filter Subnets strictly by active protocol
  const protocolSubnets = subnets.filter((s) => {
    const ver = s.ipVersion || getIPVersion(s.cidr);
    return ver === selectedProtocol;
  });

  const protocolSubnetIds = new Set(protocolSubnets.map((s) => s.id));

  // 2. Filter IPs strictly by active protocol
  const protocolIPs = ips.filter((ip) => {
    const ver = ip.ipVersion || (ip.ipAddress.includes(':') ? 'IPv6' : 'IPv4');
    return ver === selectedProtocol;
  });

  // Calculate Protocol Metrics
  const activeCount = protocolIPs.filter((i) => i.status === 'Active').length;
  const reservedCount = protocolIPs.filter((i) => i.status === 'Reserved').length;
  const availableTrackedCount = protocolIPs.filter((i) => i.status === 'Available').length;
  const totalAllocated = activeCount + reservedCount;

  // Calculate Total Capacity for Active Protocol
  let totalCapacityRaw = 0;
  for (const s of protocolSubnets) {
    try {
      const calc = parseCIDR(s.cidr);
      if (isV6) {
        // Each /64 is 2^64 addresses
        totalCapacityRaw += 1; // Count prefix units for BigInt scaling
      } else {
        totalCapacityRaw += calc.usableHosts;
      }
    } catch {}
  }

  // Format Total Capacity box in K / 10^ notation
  let formattedCapacity = '';
  let capacitySubtitle = '';
  let capacityTooltip = '';

  if (isV6) {
    // 1 IPv6 /64 prefix = ~1.844 x 10^19 addresses
    const prefixCount = protocolSubnets.length;
    if (prefixCount === 0) {
      formattedCapacity = '0';
      capacitySubtitle = 'No IPv6 Prefixes Allocated';
      capacityTooltip = '0 Addresses';
    } else {
      const totalSci = (prefixCount * 1.844).toFixed(2);
      formattedCapacity = `${totalSci} × 10¹⁹`;
      capacitySubtitle = `10¹⁹ Notation (2⁶⁴/block) • ${prefixCount} Prefixes`;
      capacityTooltip = `Total Capacity: ~${(prefixCount * 1.8446744).toFixed(4)} × 10¹⁹ unique 128-bit addresses across ${prefixCount} IPv6 subnets`;
    }
  } else {
    formattedCapacity = formatCapacityCompact(totalCapacityRaw, false);
    capacitySubtitle = totalCapacityRaw >= 1000 
      ? `Compact Notation (${totalCapacityRaw.toLocaleString()} hosts) • ${protocolSubnets.length} Subnets`
      : `Across ${protocolSubnets.length} IPv4 CIDR blocks`;
    capacityTooltip = `Total Usable IPv4 Hosts: ${totalCapacityRaw.toLocaleString()} across ${protocolSubnets.length} subnets`;
  }

  // Segment metrics
  const totalPublicSubnets = protocolSubnets.filter((s) => s.segmentType === 'Public').length;
  const totalPrivateSubnets = protocolSubnets.filter((s) => s.segmentType === 'Private').length;
  const totalSubnetCount = protocolSubnets.length || 1;
  const privatePercent = Math.round((totalPrivateSubnets / totalSubnetCount) * 100);
  const publicPercent = 100 - privatePercent;

  // Active protocol utilization percentage
  const protocolUtilPercent = isV6
    ? (protocolSubnets.length > 0 ? Math.min(100, Math.round((totalAllocated / (protocolSubnets.length * 100)) * 100)) : 0)
    : (totalCapacityRaw > 0 ? Math.min(100, Math.round((totalAllocated / totalCapacityRaw) * 100)) : 0);

  // Filter Active IP Leases for the Bento widget
  const filteredIPs = activeDCFilter === 'all'
    ? protocolIPs
    : protocolIPs.filter((ip) => {
        const sub = subnets.find((s) => s.id === ip.subnetId);
        return sub && sub.datacenterId === activeDCFilter;
      });

  // Datacenter scope utilization for the active protocol
  const dcProtocolUtilization = datacenters.map((dc) => {
    const dcSubs = protocolSubnets.filter((s) => s.datacenterId === dc.id);
    const dcSubIds = new Set(dcSubs.map((s) => s.id));
    const dcIps = protocolIPs.filter((i) => dcSubIds.has(i.subnetId));
    const dcActive = dcIps.filter((i) => i.status === 'Active').length;
    const dcReserved = dcIps.filter((i) => i.status === 'Reserved').length;
    
    let dcCap = 0;
    for (const sub of dcSubs) {
      try {
        const c = parseCIDR(sub.cidr);
        dcCap += isV6 ? 100 : c.usableHosts;
      } catch {}
    }

    const dcAlloc = dcActive + dcReserved;
    const util = dcCap > 0 ? Math.min(100, Math.round((dcAlloc / dcCap) * 100)) : (dcIps.length > 0 ? 100 : 0);

    return {
      dc,
      subnetsCount: dcSubs.length,
      trackedIPsCount: dcIps.length,
      activeCount: dcActive,
      reservedCount: dcReserved,
      utilizationPercent: util,
    };
  });

  // Protocol count badges
  const ipv4SubnetList = subnets.filter((s) => (s.ipVersion || getIPVersion(s.cidr)) === 'IPv4');
  const ipv6SubnetList = subnets.filter((s) => (s.ipVersion || getIPVersion(s.cidr)) === 'IPv6');
  const ipv4IPList = ips.filter((i) => (i.ipVersion || (i.ipAddress.includes(':') ? 'IPv6' : 'IPv4')) === 'IPv4');
  const ipv6IPList = ips.filter((i) => (i.ipVersion || (i.ipAddress.includes(':') ? 'IPv6' : 'IPv4')) === 'IPv6');

  return (
    <div className="p-3.5 sm:p-6 md:p-8 max-w-[1400px] mx-auto space-y-4 sm:space-y-6">
      {/* Top Protocol Switcher & View Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white dark:text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-indigo-400" />
              Network Topology & IPAM Dashboard
            </h1>
            <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase tracking-wider border ${
              isV6 ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
            }`}>
              {selectedProtocol} Scope Active
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-1 font-mono">
            {isV6 
              ? 'IPv6 128-Bit Prefixes • Global Unicast (GUA) & Unique Local (ULA) • SLAAC Host Pool' 
              : 'IPv4 32-Bit Subnets • RFC 1918 Private & Public BGP • ARP / DHCP Inventory'}
          </p>
        </div>

        {/* Prominent Protocol Tabs Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div 
            id="protocol-dashboard-switcher"
            className="flex items-center p-1 bg-slate-900 rounded-xl border border-slate-700/80 font-mono shadow-inner"
          >
            <button
              id="btn-switch-ipv4"
              onClick={() => handleProtocolChange('IPv4')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                !isV6
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${!isV6 ? 'bg-white animate-pulse' : 'bg-indigo-400'}`}></span>
              IPv4 Dashboard
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                !isV6 ? 'bg-indigo-950/80 border border-indigo-400/40 text-indigo-200' : 'bg-slate-800 text-slate-400'
              }`}>
                {ipv4SubnetList.length} Prefixes
              </span>
            </button>

            <button
              id="btn-switch-ipv6"
              onClick={() => handleProtocolChange('IPv6')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isV6
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isV6 ? 'bg-white animate-pulse' : 'bg-cyan-400'}`}></span>
              IPv6 Dashboard
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                isV6 ? 'bg-cyan-950/80 border border-cyan-400/40 text-cyan-200' : 'bg-slate-800 text-slate-400'
              }`}>
                {ipv6SubnetList.length} Prefixes
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenReserveNextModal()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Zap className="w-3.5 h-3.5" /> Reserve IP
            </button>
            <button
              onClick={onOpenNewSubnetModal}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Network className="w-3.5 h-3.5" /> Allocate Subnet
            </button>
          </div>
        </div>
      </div>

      {/* Row 1: 4 High-Level Bento Cards for the Active Protocol */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
        {/* Bento 1: TOTAL CAPACITY BOX (High Visibility + K / 10^ Notation + No Overflow) */}
        <div 
          id="bento-total-capacity"
          onClick={() => {
            setFilters(prev => ({ ...prev, ipVersion: selectedProtocol }));
            setActiveTab('subnets');
          }}
          title={capacityTooltip}
          className={`lg:col-span-3 p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group ${
            isV6 
              ? 'bg-gradient-to-br from-cyan-950/40 via-slate-900/80 to-slate-900/60 border-cyan-500/30 hover:border-cyan-400/60 shadow-lg shadow-cyan-950/20' 
              : 'bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-slate-900/60 border-indigo-500/30 hover:border-indigo-400/60 shadow-lg shadow-indigo-950/20'
          }`}
        >
          {/* Subtle decorative glow */}
          <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-40 ${
            isV6 ? 'bg-cyan-500/20' : 'bg-indigo-500/20'
          }`} />

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Layers className={`w-3.5 h-3.5 ${isV6 ? 'text-cyan-400' : 'text-indigo-400'}`} />
                {selectedProtocol} Capacity
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                isV6 
                  ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' 
                  : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
              }`}>
                {isV6 ? '10¹⁹ Notation' : 'K / M Notation'}
              </span>
            </div>

            {/* Formatted Capacity Value (Guaranteed not to overflow) */}
            <div className="mt-2 min-w-0">
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white dark:text-white truncate" title={capacityTooltip}>
                {formattedCapacity}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-mono leading-tight truncate">
                {capacitySubtitle}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/40">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
              <span>Allocated Load</span>
              <span className="font-bold text-slate-200">{totalAllocated} Tracked</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isV6 ? 'bg-cyan-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(8, protocolUtilPercent))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Bento 2: Public vs Private Subnets */}
        <div 
          onClick={() => {
            setFilters(prev => ({ ...prev, ipVersion: selectedProtocol }));
            setActiveTab('subnets');
          }}
          className={`lg:col-span-3 p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer hover:border-purple-500/50 flex flex-col justify-between ${
            isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Globe className="w-3.5 h-3.5 text-purple-400" />
                {selectedProtocol} Public Blocks
              </span>
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-bold rounded uppercase font-mono">
                {isV6 ? 'GUA (2000::/3)' : 'BGP Routable'}
              </span>
            </div>

            <div className="text-3xl font-bold font-mono text-white dark:text-white mt-1">
              {totalPublicSubnets}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              {isV6 ? 'Global Unicast IPv6 prefixes' : 'Internet-facing IPv4 prefixes'}
            </p>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-3 pt-2.5 border-t border-slate-700/30">
            <span>Private: <strong className="text-slate-200">{totalPrivateSubnets}</strong></span>
            <span className="text-purple-400 font-semibold">{totalPublicSubnets} Public</span>
          </div>
        </div>

        {/* Bento 3: Active Host Assignments */}
        <div 
          onClick={() => {
            setFilters(prev => ({ ...prev, ipVersion: selectedProtocol }));
            setActiveTab('ips');
          }}
          className={`lg:col-span-3 p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer hover:border-indigo-500/50 flex flex-col justify-between ${
            isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1 font-mono flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-indigo-400" />
              Active {selectedProtocol} Hosts
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-bold font-mono text-white dark:text-white">
                {activeCount}
              </span>
              <span className="text-slate-400 text-xs font-mono font-medium">
                {reservedCount} Reserved
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              {protocolIPs.length} total tracked {selectedProtocol} hosts
            </p>
          </div>

          {/* Segmented meter */}
          <div className="flex gap-1 mt-3">
            {[1, 2, 3, 4, 5, 6].map((bar) => {
              const fillThreshold = Math.ceil((Math.min(100, Math.max(10, protocolUtilPercent)) / 100) * 6);
              return (
                <div 
                  key={bar} 
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    bar <= fillThreshold 
                      ? (isV6 ? 'bg-cyan-500' : 'bg-indigo-500') 
                      : 'bg-slate-700/60'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Bento 4: Protocol Health Accent Card */}
        <div className={`lg:col-span-3 rounded-2xl p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between shadow-lg text-white ${
          isV6 
            ? 'bg-gradient-to-br from-cyan-600 to-teal-700 shadow-cyan-600/20' 
            : 'bg-gradient-to-br from-indigo-600 to-blue-700 shadow-indigo-600/20'
        }`}>
          <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/80 text-xs font-semibold uppercase tracking-wider font-mono">
                {selectedProtocol} Fabric
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
            </div>
            <div className="text-lg sm:text-xl font-bold tracking-tight mt-1">
              {isV6 ? 'NDP / SLAAC Healthy' : 'ARP & Subnets Green'}
            </div>
            <p className="text-[11px] text-white/80 mt-1 font-mono">
              {isV6 
                ? 'Zero IPv6 prefix overlap collisions' 
                : 'All RFC 1918 subnets validated'}
            </p>
          </div>
          <button 
            onClick={() => onOpenReserveNextModal()}
            className={`mt-3 w-full py-1.5 bg-white font-semibold text-xs rounded-lg shadow hover:bg-slate-50 transition-colors active:scale-95 text-center ${
              isV6 ? 'text-cyan-800' : 'text-indigo-700'
            }`}
          >
            Allocate Next {selectedProtocol} IP
          </button>
        </div>
      </div>

      {/* Row 2: Mid Bento Section (8-col Protocol IP Leases + 4-col DC Scopes) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Mid Bento Left (8 cols): Active Protocol IP Leases */}
        <div className={`lg:col-span-8 p-4 sm:p-5 rounded-2xl border flex flex-col justify-between ${
          isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-white dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Hash className={`w-4 h-4 ${isV6 ? 'text-cyan-400' : 'text-indigo-400'}`} />
                  Active {selectedProtocol} Leases & Assignments
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  {isV6 ? 'Dual-stack IPv6 endpoints and SLAAC interface bindings' : 'IPv4 DHCP and static VIP host allocations'}
                </p>
              </div>

              {/* Datacenter filter chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setActiveDCFilter('all')}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                    activeDCFilter === 'all'
                      ? (isV6 ? 'bg-cyan-600 text-white font-semibold' : 'bg-indigo-600 text-white font-semibold')
                      : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  All Scopes
                </button>
                {datacenters.map((dc) => (
                  <button
                    key={dc.id}
                    onClick={() => setActiveDCFilter(dc.id)}
                    className={`text-xs px-2.5 py-1 rounded font-medium transition-colors truncate max-w-28 ${
                      activeDCFilter === dc.id
                        ? (isV6 ? 'bg-cyan-600 text-white font-semibold' : 'bg-indigo-600 text-white font-semibold')
                        : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {dc.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Card View for Active IP Leases (< sm) */}
            <div className="block sm:hidden space-y-2.5">
              {filteredIPs.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs font-mono">
                  No {selectedProtocol} allocations registered for this scope
                </div>
              ) : (
                filteredIPs.slice(0, 5).map((ip) => {
                  const sub = subnets.find((s) => s.id === ip.subnetId);
                  return (
                    <div 
                      key={ip.id}
                      onClick={() => {
                        setFilters(prev => ({ ...prev, ipVersion: selectedProtocol }));
                        setActiveTab('ips');
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isDark ? 'bg-slate-900/60 border-slate-700/40 hover:border-slate-600' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`font-mono font-bold text-xs break-all ${isV6 ? 'text-cyan-400' : 'text-indigo-400'}`}>
                          {ip.ipAddress}
                        </span>
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase font-mono ${
                          ip.status === 'Active'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : ip.status === 'Reserved'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {ip.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-300">
                        <span className="truncate max-w-[180px] font-medium">{ip.assignedDevice || 'Unassigned Host'}</span>
                        <span className="font-mono text-slate-400">{sub ? sub.cidr : '—'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View (sm and up) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400 uppercase text-[10px] font-semibold tracking-wider font-mono">
                    <th className="pb-2.5 px-2">{selectedProtocol} Address</th>
                    <th className="pb-2.5 px-2">Subnet / VLAN</th>
                    <th className="pb-2.5 px-2">Assigned Device / Host</th>
                    <th className="pb-2.5 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30 font-mono">
                  {filteredIPs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500 text-xs">
                        No {selectedProtocol} allocations registered for this datacenter scope
                      </td>
                    </tr>
                  ) : (
                    filteredIPs.slice(0, 5).map((ip) => {
                      const sub = subnets.find((s) => s.id === ip.subnetId);
                      const vlan = sub?.vlanId ? vlans.find((v) => v.id === sub.vlanId) : null;
                      return (
                        <tr key={ip.id} className="hover:bg-slate-700/20 transition-colors">
                          <td className={`py-2.5 px-2 font-bold break-all ${isV6 ? 'text-cyan-400' : 'text-indigo-400'}`}>
                            {ip.ipAddress}
                          </td>
                          <td className="py-2.5 px-2 text-slate-300 text-[11px]">
                            {sub ? (
                              <span>
                                {sub.cidr}
                                {vlan && <span className="text-purple-400 ml-1.5">• VLAN {vlan.vlanId}</span>}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-2.5 px-2 text-slate-300">
                            <span className="font-sans font-medium text-xs">{ip.assignedDevice || 'Unassigned Host'}</span>
                            {ip.description && (
                              <span className="block text-[10px] text-slate-500 truncate max-w-xs font-sans">{ip.description}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                              ip.status === 'Active'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : ip.status === 'Reserved'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {ip.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-700/40 flex items-center justify-between text-xs text-slate-400 mt-3 font-mono">
            <span>Showing {Math.min(5, filteredIPs.length)} of {filteredIPs.length} {selectedProtocol} host records</span>
            <button
              onClick={() => {
                setFilters(prev => ({ ...prev, ipVersion: selectedProtocol }));
                setActiveTab('ips');
              }}
              className={`${isV6 ? 'text-cyan-400 hover:text-cyan-300' : 'text-indigo-400 hover:text-indigo-300'} font-semibold flex items-center gap-1`}
            >
              Open {selectedProtocol} Directory <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mid Bento Right (4 cols): Datacenter Scopes for Active Protocol */}
        <div className={`lg:col-span-4 p-4 sm:p-5 rounded-2xl border flex flex-col justify-between ${
          isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className={`w-4 h-4 ${isV6 ? 'text-cyan-400' : 'text-indigo-400'}`} />
                {selectedProtocol} Datacenter Scopes
              </h2>
              <span className={`text-xs font-mono font-semibold ${isV6 ? 'text-cyan-400' : 'text-indigo-400'}`}>
                {datacenters.length} Sites
              </span>
            </div>
            
            <div className="space-y-2.5">
              {dcProtocolUtilization.map(({ dc, subnetsCount, trackedIPsCount, activeCount, utilizationPercent }) => (
                <div 
                  key={dc.id}
                  onClick={() => setActiveTab('datacenters')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isDark 
                      ? 'bg-slate-900/50 border-slate-700/30 hover:border-slate-600' 
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-white dark:text-white">{dc.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700/40">
                      {subnetsCount} {selectedProtocol} blocks
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
                    <span>{dc.location}</span>
                    <span className="font-mono font-semibold text-slate-300">{activeCount} Active IPs</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        utilizationPercent > 80 ? 'bg-rose-500' :
                        utilizationPercent > 50 ? 'bg-amber-500' :
                        (isV6 ? 'bg-cyan-500' : 'bg-emerald-500')
                      }`}
                      style={{ width: `${Math.max(5, utilizationPercent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('datacenters')}
            className="mt-3 w-full py-1.5 rounded-lg border border-slate-700/50 text-xs font-semibold text-slate-300 hover:bg-slate-700/40 transition-colors text-center font-mono"
          >
            Manage Datacenters
          </button>
        </div>
      </div>

      {/* Row 3: Lower Bento Section (4-col Protocol Type Breakdown + 8-col Network Alerts) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Lower Left (4 cols): Protocol Type Breakdown */}
        <div className={`lg:col-span-4 p-4 sm:p-5 rounded-2xl border flex flex-col justify-between ${
          isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <h2 className="text-sm font-bold text-white dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShieldCheck className={`w-4 h-4 ${isV6 ? 'text-cyan-400' : 'text-indigo-400'}`} />
              {selectedProtocol} Scope Breakdown
            </h2>

            {/* Donut Representation */}
            <div className="flex items-center justify-center my-4">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-700"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={isV6 ? 'text-cyan-500' : 'text-indigo-500'}
                    strokeDasharray={`${privatePercent}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold font-mono text-white dark:text-white">{privatePercent}%</span>
                  <span className="text-[9px] text-slate-400 uppercase font-mono">{isV6 ? 'ULA' : 'Private'}</span>
                </div>
              </div>
            </div>

            {/* Legend breakdown */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className={`w-2.5 h-2.5 rounded-full ${isV6 ? 'bg-cyan-500' : 'bg-indigo-500'}`}></span>
                  {isV6 ? 'Unique Local (ULA fc00::/7)' : 'Private (RFC 1918)'}
                </span>
                <span className="text-slate-400 font-semibold">{totalPrivateSubnets} Blocks</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                  {isV6 ? 'Global Unicast (2000::/3)' : 'Public Routable BGP'}
                </span>
                <span className="text-slate-400 font-semibold">{totalPublicSubnets} Blocks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lower Right (8 cols): Network Alerts & Live Audit */}
        <div className={`lg:col-span-8 p-4 sm:p-5 rounded-2xl border flex flex-col justify-between ${
          isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" /> Network Alerts & Audit Stream
              </h2>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Synchronized
              </span>
            </div>

            <div className="space-y-2.5">
              {activityLogs.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 font-mono">
                  No network collision or allocation events logged
                </div>
              ) : (
                activityLogs.slice(0, 4).map((log) => {
                  const isReserve = log.action === 'RESERVE';
                  const isCreate = log.action === 'CREATE';
                  const isDelete = log.action === 'DELETE';

                  return (
                    <div 
                      key={log.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                        isDark ? 'bg-slate-900/50 border-slate-700/30' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          isReserve ? 'bg-amber-400' : isCreate ? 'bg-blue-400' : isDelete ? 'bg-rose-400' : 'bg-emerald-400'
                        }`} />
                        <div className="truncate">
                          <span className="font-semibold text-white dark:text-white mr-2">{log.title}</span>
                          <span className="text-slate-400 text-[11px] truncate">{log.detail}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-700/40 flex items-center justify-between text-xs text-slate-400 mt-3 font-mono">
            <span>Dual-Stack Audit log history stored securely</span>
            <button
              onClick={() => setActiveTab('ips')}
              className={`${isV6 ? 'text-cyan-400 hover:text-cyan-300' : 'text-indigo-400 hover:text-indigo-300'} font-semibold`}
            >
              Full Host History →
            </button>
          </div>
        </div>
      </div>

      {/* Row 4: Subnet Blocks & Interactive Visual Matrix for Active Protocol */}
      <div className={`p-4 sm:p-5 rounded-2xl border ${
        isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-white dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Network className={`w-4 h-4 ${isV6 ? 'text-cyan-400' : 'text-indigo-400'}`} />
              Active {selectedProtocol} Subnet Blocks & Capacity
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              {isV6 
                ? 'IPv6 CIDR prefixes with 10¹⁹ mathematical capacity limits & SLAAC allocation metrics' 
                : 'IPv4 CIDR network ranges with K-formatted usable hosts & VLAN mappings'}
            </p>
          </div>
          <button
            onClick={() => {
              setFilters(prev => ({ ...prev, ipVersion: selectedProtocol }));
              setActiveTab('subnets');
            }}
            className={`text-xs font-semibold ${isV6 ? 'text-cyan-400 hover:text-cyan-300' : 'text-indigo-400 hover:text-indigo-300'} flex items-center gap-1 font-mono`}
          >
            Manage All {selectedProtocol} Subnets <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-700/50 text-slate-400 uppercase text-[10px] font-semibold tracking-wider font-mono">
                <th className="py-2.5 px-3">{selectedProtocol} Prefix</th>
                <th className="py-2.5 px-3">Datacenter</th>
                <th className="py-2.5 px-3">VLAN</th>
                <th className="py-2.5 px-3">Segment</th>
                <th className="py-2.5 px-3">Usable Capacity</th>
                <th className="py-2.5 px-3">Allocated Load</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30 font-mono">
              {protocolSubnets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No {selectedProtocol} subnets currently allocated. Click "Allocate Subnet" above to create one.
                  </td>
                </tr>
              ) : (
                protocolSubnets.map((sub) => {
                  const dc = datacenters.find((d) => d.id === sub.datacenterId);
                  const vlan = sub.vlanId ? vlans.find((v) => v.id === sub.vlanId) : null;
                  const isPublic = sub.segmentType === 'Public';
                  const subIPs = ips.filter((i) => i.subnetId === sub.id);
                  const activeSubIPs = subIPs.filter((i) => i.status === 'Active').length;
                  const reservedSubIPs = subIPs.filter((i) => i.status === 'Reserved').length;
                  const totalSubAlloc = activeSubIPs + reservedSubIPs;

                  let calc;
                  try {
                    calc = parseCIDR(sub.cidr);
                  } catch {
                    calc = null;
                  }

                  const totalCapDisplay = isV6 
                    ? '1.84 × 10¹⁹ Usable' 
                    : (calc ? `${formatCapacityCompact(calc.usableHosts, false)} Usable` : '254 Usable');

                  const utilSubPercent = isV6 
                    ? Math.min(100, Math.round((totalSubAlloc / Math.max(10, totalSubAlloc)) * 100))
                    : (calc && calc.usableHosts > 0 ? Math.min(100, Math.round((totalSubAlloc / calc.usableHosts) * 100)) : 0);

                  return (
                    <tr 
                      key={sub.id}
                      className="hover:bg-slate-700/20 transition-colors"
                    >
                      <td className="py-3 px-3 font-bold text-sm break-all">
                        <span className={isV6 ? 'text-cyan-400' : 'text-indigo-400'}>{sub.cidr}</span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-200 font-sans">
                        {dc?.name || 'Unknown Datacenter'}
                      </td>
                      <td className="py-3 px-3">
                        {vlan ? (
                          <span className="px-2 py-0.5 rounded font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 text-[11px]">
                            VLAN {vlan.vlanId}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Un-tagged</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          isPublic 
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                            : 'bg-slate-700/60 text-slate-300 border border-slate-600/40'
                        }`}>
                          {sub.segmentType}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 whitespace-nowrap" title={calc?.usableHostsFormatted || totalCapDisplay}>
                        <span className="font-bold text-slate-200">{totalCapDisplay}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="w-32">
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-400">{totalSubAlloc} Alloc</span>
                            <span className="font-bold text-slate-200">{activeSubIPs} Active</span>
                          </div>
                          <div className="w-full bg-slate-700/60 h-1.5 rounded-full overflow-hidden flex">
                            <div 
                              className={isV6 ? 'bg-cyan-500 h-full' : 'bg-indigo-500 h-full'}
                              style={{ width: `${Math.min(100, Math.max(10, utilSubPercent))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => onOpenSubnetVisualizer(sub)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center gap-1 active:scale-95 ${
                            isV6 
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20' 
                              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20'
                          }`}
                          title="Open Interactive IP Matrix"
                        >
                          <Eye className="w-3.5 h-3.5" /> Visual Grid
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
