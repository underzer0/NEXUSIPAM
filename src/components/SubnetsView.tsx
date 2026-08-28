import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { 
  Network, 
  Plus, 
  Building2, 
  Layers, 
  Hash, 
  Edit, 
  Trash2, 
  Eye, 
  BookmarkCheck, 
  Zap, 
  Globe, 
  Lock, 
  SlidersHorizontal,
  ChevronRight,
  Database,
  Sparkles
} from 'lucide-react';
import { Subnet, SegmentType, IPVersion } from '../types/ipam';
import { parseCIDR, getIPVersion } from '../utils/ipCalculator';

interface SubnetsViewProps {
  onOpenNewSubnetModal: () => void;
  onOpenEditSubnetModal: (subnet: Subnet) => void;
  onOpenSubnetVisualizer: (subnet: Subnet) => void;
  onOpenReserveNextModal: (subnetId?: string) => void;
  onOpenBulkGenerateModal: (subnet: Subnet) => void;
}

export const SubnetsView: React.FC<SubnetsViewProps> = ({
  onOpenNewSubnetModal,
  onOpenEditSubnetModal,
  onOpenSubnetVisualizer,
  onOpenReserveNextModal,
  onOpenBulkGenerateModal,
}) => {
  const { 
    subnets, 
    datacenters, 
    vlans, 
    ips, 
    deleteSubnet, 
    setActiveTab, 
    setFilters,
    isDark 
  } = useIPAM();

  const [dcFilter, setDcFilter] = useState<string>('All');
  const [segmentFilter, setSegmentFilter] = useState<string>('All');
  const [versionFilter, setVersionFilter] = useState<string>('All');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredSubnets = subnets.filter((s) => {
    if (dcFilter !== 'All' && s.datacenterId !== dcFilter) return false;
    if (segmentFilter !== 'All' && s.segmentType !== segmentFilter) return false;
    const ver = s.ipVersion || getIPVersion(s.cidr);
    if (versionFilter !== 'All' && ver !== versionFilter) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      return (
        s.cidr.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleDelete = async (s: Subnet) => {
    const assignedCount = ips.filter(i => i.subnetId === s.id).length;
    const warning = assignedCount > 0 
      ? `Warning: Subnet "${s.cidr}" contains ${assignedCount} tracked IP assignments. Deleting this subnet will also purge those IP records. Proceed?`
      : `Are you sure you want to delete subnet ${s.cidr}?`;

    if (!window.confirm(warning)) return;

    try {
      setDeleteError(null);
      await deleteSubnet(s.id);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete subnet');
    }
  };

  return (
    <div className="p-3.5 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className={`text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <Network className="w-5 h-5 text-emerald-400" />
            Dual-Stack Subnet & Prefix Allocations
          </h1>
          <p className={`text-[11px] sm:text-xs mt-0.5 sm:mt-1 font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            IPv4 and IPv6 address ranges with mathematical CIDR validation, capacity calculators, and VLAN binding.
          </p>
        </div>

        <button
          id="btn-add-subnet"
          onClick={onOpenNewSubnetModal}
          className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 active:scale-95"
        >
          <Plus className="w-4 h-4" /> Allocate Subnet
        </button>
      </div>

      {deleteError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
          {deleteError}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
        isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap">
          {/* Version Filter */}
          <div className="flex items-center justify-between sm:justify-start gap-2 text-xs font-mono">
            <span className="font-semibold text-slate-400 text-[11px]">Protocol:</span>
            <select
              value={versionFilter}
              onChange={(e) => setVersionFilter(e.target.value)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              <option value="All">All Protocols (Dual-Stack)</option>
              <option value="IPv4">IPv4 Only</option>
              <option value="IPv6">IPv6 Only</option>
            </select>
          </div>

          {/* DC Filter */}
          <div className="flex items-center justify-between sm:justify-start gap-2 text-xs font-mono">
            <span className="font-semibold text-slate-400 text-[11px]">Datacenter:</span>
            <select
              value={dcFilter}
              onChange={(e) => setDcFilter(e.target.value)}
              className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              <option value="All">All Datacenters ({subnets.length})</option>
              {datacenters.map((dc) => (
                <option key={dc.id} value={dc.id}>{dc.name}</option>
              ))}
            </select>
          </div>

          {/* Segment Filter */}
          <div className="flex items-center justify-between sm:justify-start gap-2 text-xs font-mono">
            <span className="font-semibold text-slate-400 text-[11px]">Segment:</span>
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              <option value="All">All Segments</option>
              <option value="Private">Private (RFC1918 / ULA)</option>
              <option value="Public">Public Routed (Global)</option>
            </select>
          </div>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search CIDR, description..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className={`w-full px-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
              isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-200 placeholder-slate-500' : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}
          />
        </div>
      </div>

      {/* Subnets List */}
      <div className="space-y-3">
        {filteredSubnets.length === 0 ? (
          <div className={`p-12 text-center rounded-2xl border text-xs text-slate-400 font-mono ${
            isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
          }`}>
            No Subnet prefixes found matching the current filters.
          </div>
        ) : (
          filteredSubnets.map((subnet) => {
            const dc = datacenters.find(d => d.id === subnet.datacenterId);
            const vlan = subnet.vlanId ? vlans.find(v => v.id === subnet.vlanId) : null;
            const subIps = ips.filter(i => i.subnetId === subnet.id);
            const activeIps = subIps.filter(i => i.status === 'Active').length;
            const reservedIps = subIps.filter(i => i.status === 'Reserved').length;
            const availableIps = subIps.filter(i => i.status === 'Available').length;
            const ver = subnet.ipVersion || getIPVersion(subnet.cidr);
            const isV6 = ver === 'IPv6';

            let calc;
            try {
              calc = parseCIDR(subnet.cidr);
            } catch {
              calc = null;
            }

            const totalUsable = calc ? (isV6 ? 256 : calc.usableHosts) : 254;
            const totalAllocated = activeIps + reservedIps;
            const utilPercent = totalUsable > 0 ? Math.min(100, Math.round((totalAllocated / totalUsable) * 100)) : 0;
            const isPublic = subnet.segmentType === 'Public';

            return (
              <div
                key={subnet.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isDark ? 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: CIDR, Version, Segment, DC & VLAN Info */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono font-bold text-base text-emerald-400 break-all">
                        {subnet.cidr}
                      </span>

                      {/* Protocol Badge */}
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider border ${
                        isV6 
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
                          : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      }`}>
                        {ver}
                      </span>

                      {/* Segment Badge */}
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase flex items-center gap-1 ${
                        isPublic
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-slate-700/40 text-slate-300 border border-slate-600/30'
                      }`}>
                        {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {subnet.segmentType}
                      </span>

                      {/* Datacenter Badge */}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {dc?.name || 'Datacenter'}
                      </span>

                      {/* VLAN Badge */}
                      {vlan ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                          <Layers className="w-3 h-3" /> VLAN {vlan.vlanId}: {vlan.name}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] text-slate-400 bg-slate-800 border border-slate-700/50 font-mono">
                          Un-tagged / L3 Routed
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {subnet.description || 'Subnet IP block'}
                    </p>

                    {/* Calculated CIDR Range Specs */}
                    {calc && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400 pt-1">
                        <span>Netmask: <strong className="text-slate-200">{calc.netmask}</strong></span>
                        <span>•</span>
                        <span className="truncate">Range: <strong className="text-slate-200">{calc.firstUsableHost} – {calc.lastUsableHost}</strong></span>
                        <span>•</span>
                        <span>Capacity: <strong className="text-emerald-400">{calc.usableHostsFormatted || calc.usableHosts.toLocaleString()}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Right: Allocation Load & Direct Action Tools */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-700/30">
                    {/* Utilization Bar */}
                    <div className="w-full sm:w-44 space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-400">{totalAllocated} Tracked</span>
                        <span className="font-bold text-slate-200">{activeIps} Active</span>
                      </div>
                      <div className="w-full bg-slate-700/50 h-2 rounded-full overflow-hidden flex">
                        <div 
                          className="bg-indigo-500 h-full" 
                          style={{ width: `${totalUsable > 0 ? (activeIps / Math.max(activeIps + reservedIps + 1, totalUsable)) * 100 : 0}%` }}
                          title={`Active: ${activeIps}`}
                        />
                        <div 
                          className="bg-amber-500 h-full" 
                          style={{ width: `${totalUsable > 0 ? (reservedIps / Math.max(activeIps + reservedIps + 1, totalUsable)) * 100 : 0}%` }}
                          title={`Reserved: ${reservedIps}`}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => onOpenSubnetVisualizer(subnet)}
                        className="flex-1 sm:flex-initial justify-center px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95"
                        title="Interactive Visual Matrix of all IP hosts in this block"
                      >
                        <Eye className="w-3.5 h-3.5" /> Matrix
                      </button>

                      <button
                        onClick={() => onOpenReserveNextModal(subnet.id)}
                        className="flex-1 sm:flex-initial justify-center px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all flex items-center gap-1.5 active:scale-95"
                        title="Reserve Next Available IP in this Subnet"
                      >
                        <BookmarkCheck className="w-3.5 h-3.5" /> Next IP
                      </button>

                      <button
                        onClick={() => onOpenBulkGenerateModal(subnet)}
                        className="flex-1 sm:flex-initial justify-center px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center gap-1.5 active:scale-95"
                        title="Bulk Populate IP addresses for this subnet"
                      >
                        <Database className="w-3.5 h-3.5" /> Bulk
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onOpenEditSubnetModal(subnet)}
                          className="p-1.5 rounded-lg bg-slate-800 sm:bg-transparent hover:bg-slate-700/50 text-slate-400 hover:text-indigo-400 transition-colors"
                          title="Edit Subnet"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(subnet)}
                          className="p-1.5 rounded-lg bg-slate-800 sm:bg-transparent hover:bg-slate-700/50 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Delete Subnet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
