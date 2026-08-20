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
  CheckCircle2,
  Zap,
  Server,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Subnet } from '../types/ipam';

interface DashboardViewProps {
  onOpenSubnetVisualizer: (subnet: Subnet) => void;
  onOpenNewDatacenterModal: () => void;
  onOpenNewSubnetModal: () => void;
  onOpenReserveNextModal: () => void;
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
    activityLogs, 
    setActiveTab, 
    setFilters,
    isDark 
  } = useIPAM();

  const [activeDCFilter, setActiveDCFilter] = useState<string>('all');

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const allocatedCount = stats.statusCounts.active + stats.statusCounts.reserved;
  const totalTracked = stats.totalTrackedIPs;
  const overallTrackedAllocPercent = totalTracked > 0 ? Math.round((allocatedCount / totalTracked) * 100) : 0;

  const totalPublicSubnets = stats.segmentCounts.public;
  const totalPrivateSubnets = stats.segmentCounts.private;
  const totalSubnetCount = totalPublicSubnets + totalPrivateSubnets || 1;
  const privatePercent = Math.round((totalPrivateSubnets / totalSubnetCount) * 100);
  const publicPercent = 100 - privatePercent;

  // Filter IPs for the Bento IP Leases widget
  const filteredIPs = activeDCFilter === 'all' 
    ? ips 
    : ips.filter(ip => {
        const sub = subnets.find(s => s.id === ip.subnetId);
        return sub && sub.datacenterId === activeDCFilter;
      });

  // Calculate total capacity
  const totalCapacityCount = stats.subnetUtilization.reduce((acc, curr) => acc + curr.usableCapacity, 0);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto space-y-5">
      {/* Top Header Controls / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white dark:text-white flex items-center gap-2">
            Network Topology & IPAM Bento
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            Datacenter Scopes • VLAN Encapsulation • CIDR Prefixes • IP Allocations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenReserveNextModal}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Zap className="w-3.5 h-3.5" /> Reserve Next IP
          </button>
          <button
            onClick={onOpenNewSubnetModal}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Network className="w-3.5 h-3.5" /> Allocate Subnet
          </button>
        </div>
      </div>

      {/* Row 1: 4 High-Level Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
        {/* Bento 1: Total Capacity */}
        <div 
          onClick={() => setActiveTab('subnets')}
          className={`lg:col-span-3 p-4 rounded-2xl border transition-all cursor-pointer hover:border-indigo-500/50 flex flex-col justify-between ${
            isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">
              Total Capacity
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-bold font-mono text-white dark:text-white">
                {totalCapacityCount > 1000 ? `${(totalCapacityCount / 1000).toFixed(1)}k` : totalCapacityCount}
              </span>
              <span className="text-emerald-400 text-xs font-mono font-medium flex items-center gap-0.5">
                +12.4% <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Available across {stats.totalSubnets} CIDR prefixes
            </p>
          </div>
          <div className="w-full bg-slate-700/60 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(15, overallTrackedAllocPercent))}%` }}
            />
          </div>
        </div>

        {/* Bento 2: Public Subnets */}
        <div 
          onClick={() => setActiveTab('subnets')}
          className={`lg:col-span-3 p-4 rounded-2xl border transition-all cursor-pointer hover:border-purple-500/50 flex flex-col justify-between ${
            isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Public Subnets
              </span>
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-bold rounded uppercase font-mono">
                Routable
              </span>
            </div>
            <div className="text-3xl font-bold font-mono text-white dark:text-white mt-1">
              {totalPublicSubnets}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Global Internet-facing prefix blocks
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-3 pt-2 border-t border-slate-700/30">
            <span>/24 & /28 Blocks</span>
            <span className="text-purple-400 font-semibold">{totalPublicSubnets} Prefixes</span>
          </div>
        </div>

        {/* Bento 3: Active Assignments */}
        <div 
          onClick={() => setActiveTab('ips')}
          className={`lg:col-span-3 p-4 rounded-2xl border transition-all cursor-pointer hover:border-indigo-500/50 flex flex-col justify-between ${
            isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">
              Active Assignments
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-bold font-mono text-white dark:text-white">
                {allocatedCount}
              </span>
              <span className="text-slate-400 text-xs font-mono font-medium">
                {overallTrackedAllocPercent}% Util.
              </span>
            </div>
          </div>
          {/* Segmented meter */}
          <div className="flex gap-1 mt-3">
            {[1, 2, 3, 4, 5, 6].map((bar) => {
              const activeCount = Math.ceil((overallTrackedAllocPercent / 100) * 6);
              return (
                <div 
                  key={bar} 
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    bar <= activeCount ? 'bg-indigo-500' : 'bg-slate-700/60'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Bento 4: System Health Accent Card */}
        <div className="lg:col-span-3 bg-indigo-600 rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between shadow-lg shadow-indigo-600/20 text-white">
          <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-indigo-400/20 rounded-full blur-xl pointer-events-none"></div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-indigo-200 text-xs font-semibold uppercase tracking-wider">
                System Health
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
            </div>
            <div className="text-xl font-bold tracking-tight mt-1">
              All Nodes Green
            </div>
            <p className="text-[11px] text-indigo-100/80 mt-1">
              No overlapping CIDR collisions detected
            </p>
          </div>
          <button 
            onClick={onOpenReserveNextModal}
            className="mt-3 w-full py-1.5 bg-white text-indigo-700 font-semibold text-xs rounded-lg shadow hover:bg-indigo-50 transition-colors active:scale-95 text-center"
          >
            Quick IP Allocation
          </button>
        </div>
      </div>

      {/* Row 2: Mid Bento Section (8-col IP Leases + 4-col DC Scopes) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Mid Bento Left (8 cols): Active IP Leases */}
        <div className={`lg:col-span-8 p-5 rounded-2xl border flex flex-col justify-between ${
          isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-white dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Hash className="w-4 h-4 text-indigo-400" /> Active IP Leases
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Assigned devices, MAC addresses, and lease status
                </p>
              </div>

              {/* Datacenter filter chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setActiveDCFilter('all')}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                    activeDCFilter === 'all'
                      ? 'bg-indigo-500 text-white font-semibold'
                      : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  All Scopes
                </button>
                {datacenters.map(dc => (
                  <button
                    key={dc.id}
                    onClick={() => setActiveDCFilter(dc.id)}
                    className={`text-xs px-2.5 py-1 rounded font-medium transition-colors truncate max-w-28 ${
                      activeDCFilter === dc.id
                        ? 'bg-indigo-500 text-white font-semibold'
                        : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {dc.name}
                  </button>
                ))}
              </div>
            </div>

            {/* IP Leases Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
                    <th className="pb-2.5 px-2">IP Address</th>
                    <th className="pb-2.5 px-2">Subnet / VLAN</th>
                    <th className="pb-2.5 px-2">Assigned Device</th>
                    <th className="pb-2.5 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {filteredIPs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500 text-xs">
                        No IP allocations registered for this scope
                      </td>
                    </tr>
                  ) : (
                    filteredIPs.slice(0, 5).map((ip) => {
                      const sub = subnets.find(s => s.id === ip.subnetId);
                      return (
                        <tr key={ip.id} className="hover:bg-slate-700/20 transition-colors">
                          <td className="py-2.5 px-2 font-mono font-bold text-indigo-400">
                            {ip.ipAddress}
                          </td>
                          <td className="py-2.5 px-2 text-slate-300 font-mono text-[11px]">
                            {sub ? sub.cidr : '—'}
                          </td>
                          <td className="py-2.5 px-2 text-slate-300">
                            <span className="font-medium">{ip.assignedDevice || 'Unassigned Host'}</span>
                            {ip.macAddress && (
                              <span className="block text-[10px] font-mono text-slate-500">{ip.macAddress}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase font-mono ${
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

          <div className="pt-3 border-t border-slate-700/40 flex items-center justify-between text-xs text-slate-400 mt-3">
            <span>Showing {Math.min(5, filteredIPs.length)} of {filteredIPs.length} entries</span>
            <button
              onClick={() => setActiveTab('ips')}
              className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
            >
              View IP Directory <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mid Bento Right (4 cols): Datacenter Scopes */}
        <div className={`lg:col-span-4 p-5 rounded-2xl border flex flex-col justify-between ${
          isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" /> Datacenter Scopes
              </h2>
              <span className="text-xs text-indigo-400 font-mono font-semibold">
                {datacenters.length} Sites
              </span>
            </div>
            
            <div className="space-y-2.5">
              {stats.datacenterUtilization.map((dc) => (
                <div 
                  key={dc.datacenterId}
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
                      {dc.totalSubnets} subnets
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
                    <span>{dc.location}</span>
                    <span className="font-mono font-semibold text-slate-300">{dc.utilizationPercent}% Load</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        dc.utilizationPercent > 80 ? 'bg-rose-500' :
                        dc.utilizationPercent > 50 ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(5, dc.utilizationPercent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setActiveTab('datacenters')}
            className="mt-3 w-full py-1.5 rounded-lg border border-slate-700/50 text-xs font-semibold text-slate-300 hover:bg-slate-700/40 transition-colors text-center"
          >
            Manage Datacenters
          </button>
        </div>
      </div>

      {/* Row 3: Lower Bento Section (4-col Global Type Breakdown + 8-col Network Alerts) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Lower Left (4 cols): Global Type Breakdown */}
        <div className={`lg:col-span-4 p-5 rounded-2xl border flex flex-col justify-between ${
          isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <h2 className="text-sm font-bold text-white dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" /> Global Type Breakdown
            </h2>

            {/* Donut / Radial Representation */}
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
                    className="text-indigo-500"
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
                  <span className="text-[9px] text-slate-400 uppercase font-mono">Private</span>
                </div>
              </div>
            </div>

            {/* Legend breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                  Private (RFC 1918)
                </span>
                <span className="font-mono text-slate-400 font-semibold">{totalPrivateSubnets} Subnets</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                  Public Routable
                </span>
                <span className="font-mono text-slate-400 font-semibold">{totalPublicSubnets} Subnets</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lower Right (8 cols): Network Alerts & Live Audit */}
        <div className={`lg:col-span-8 p-5 rounded-2xl border flex flex-col justify-between ${
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
                <div className="py-6 text-center text-xs text-slate-500">
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

          <div className="pt-3 border-t border-slate-700/40 flex items-center justify-between text-xs text-slate-400 mt-3">
            <span>Audit log history stored securely</span>
            <button
              onClick={() => setActiveTab('ips')}
              className="text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Full History →
            </button>
          </div>
        </div>
      </div>

      {/* Row 4: Subnet Blocks & Interactive Visual Matrix Launchers */}
      <div className={`p-5 rounded-2xl border ${
        isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-white dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Network className="w-4 h-4 text-indigo-400" /> Active Subnet Blocks & Utilization
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              CIDR capacity limits, assigned VLAN mappings, and direct access to interactive IP matrix grids
            </p>
          </div>
          <button
            onClick={() => setActiveTab('subnets')}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            Manage All Subnets <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-700/50 text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
                <th className="py-2.5 px-3">Subnet CIDR</th>
                <th className="py-2.5 px-3">Datacenter</th>
                <th className="py-2.5 px-3">VLAN</th>
                <th className="py-2.5 px-3">Segment</th>
                <th className="py-2.5 px-3">Capacity</th>
                <th className="py-2.5 px-3">Allocated Load</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {stats.subnetUtilization.map((sub) => {
                const originalSubnet = subnets.find(s => s.id === sub.subnetId);
                const isPublic = sub.segmentType === 'Public';

                return (
                  <tr 
                    key={sub.subnetId}
                    className="hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-sm">
                      <span className="text-indigo-400">{sub.cidr}</span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-200">
                      {sub.datacenterName}
                    </td>
                    <td className="py-3 px-3">
                      {sub.vlanId ? (
                        <span className="px-2 py-0.5 rounded font-mono font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20">
                          VLAN {sub.vlanId}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Un-tagged</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase ${
                        isPublic 
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                          : 'bg-slate-700/60 text-slate-300 border border-slate-600/40'
                      }`}>
                        {sub.segmentType}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {sub.usableCapacity.toLocaleString()} Usable
                    </td>
                    <td className="py-3 px-3">
                      <div className="w-32">
                        <div className="flex justify-between text-[11px] font-mono mb-1">
                          <span className="text-slate-400">{sub.activeIPs + sub.reservedIPs} Alloc</span>
                          <span className="font-bold text-slate-200">{sub.utilizationPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-700/60 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              sub.utilizationPercent > 80 ? 'bg-rose-500' :
                              sub.utilizationPercent > 50 ? 'bg-amber-500' :
                              'bg-indigo-500'
                            }`}
                            style={{ width: `${sub.utilizationPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {originalSubnet && (
                        <button
                          onClick={() => onOpenSubnetVisualizer(originalSubnet)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors inline-flex items-center gap-1 active:scale-95"
                          title="Open Interactive IP Matrix"
                        >
                          <Eye className="w-3.5 h-3.5" /> Visual Grid
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

