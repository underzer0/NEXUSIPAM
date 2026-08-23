import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { 
  Hash, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  BookmarkCheck, 
  Database, 
  CheckCircle2, 
  Clock, 
  Building2, 
  Layers, 
  Network, 
  Globe, 
  Lock, 
  Copy, 
  Check,
  Zap,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { IPAddress, IPStatus, SegmentType, IPVersion } from '../types/ipam';
import { getIPVersion } from '../utils/ipCalculator';

interface IPDirectoryViewProps {
  onOpenNewIPModal: () => void;
  onOpenEditIPModal: (ip: IPAddress) => void;
  onOpenReserveNextModal: (subnetId?: string) => void;
  onOpenBulkGenerateModal: () => void;
}

export const IPDirectoryView: React.FC<IPDirectoryViewProps> = ({
  onOpenNewIPModal,
  onOpenEditIPModal,
  onOpenReserveNextModal,
  onOpenBulkGenerateModal,
}) => {
  const { 
    ips, 
    subnets, 
    datacenters, 
    vlans, 
    updateIP, 
    deleteIP, 
    filters, 
    setFilters, 
    resetFilters,
    isDark 
  } = useIPAM();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<IPStatus>('Active');
  const [editDevice, setEditDevice] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  const activeFilterCount = 
    (filters.ipVersion && filters.ipVersion !== 'All' ? 1 : 0) +
    (filters.datacenterId !== 'All' ? 1 : 0) +
    (filters.vlanId !== 'All' ? 1 : 0) +
    (filters.subnetId !== 'All' ? 1 : 0) +
    (filters.status !== 'All' ? 1 : 0) +
    (filters.segmentType !== 'All' ? 1 : 0);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startInlineEdit = (ip: IPAddress) => {
    setInlineEditingId(ip.id);
    setEditStatus(ip.status);
    setEditDevice(ip.assignedDevice);
    setEditDesc(ip.description);
  };

  const saveInlineEdit = async (ip: IPAddress) => {
    try {
      await updateIP(ip.id, {
        status: editStatus,
        assignedDevice: editDevice,
        description: editDesc,
      });
      setInlineEditingId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update IP');
    }
  };

  const handleDelete = async (ip: IPAddress) => {
    if (!window.confirm(`Are you sure you want to release and remove tracking for IP ${ip.ipAddress}?`)) return;
    try {
      await deleteIP(ip.id);
    } catch (err: any) {
      alert(err.message || 'Failed to release IP');
    }
  };

  const handleQuickStatusChange = async (ip: IPAddress, newStatus: IPStatus) => {
    try {
      await updateIP(ip.id, { status: newStatus });
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  // Filter IPs
  const filteredIPs = ips.filter((ip) => {
    const subnet = subnets.find(s => s.id === ip.subnetId);
    if (!subnet) return false;

    // Protocol filter (IPv4 / IPv6)
    const ipVer = ip.ipVersion || (ip.ipAddress.includes(':') ? 'IPv6' : 'IPv4');
    if (filters.ipVersion && filters.ipVersion !== 'All' && ipVer !== filters.ipVersion) {
      return false;
    }

    // Search filter
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      const match = 
        ip.ipAddress.toLowerCase().includes(q) ||
        ip.assignedDevice.toLowerCase().includes(q) ||
        ip.description.toLowerCase().includes(q) ||
        subnet.cidr.toLowerCase().includes(q);
      if (!match) return false;
    }

    // Datacenter filter
    if (filters.datacenterId !== 'All' && subnet.datacenterId !== filters.datacenterId) {
      return false;
    }

    // VLAN filter
    if (filters.vlanId !== 'All' && subnet.vlanId !== filters.vlanId) {
      return false;
    }

    // Subnet filter
    if (filters.subnetId !== 'All' && ip.subnetId !== filters.subnetId) {
      return false;
    }

    // Status filter
    if (filters.status !== 'All' && ip.status !== filters.status) {
      return false;
    }

    // Segment type filter
    if (filters.segmentType !== 'All' && subnet.segmentType !== filters.segmentType) {
      return false;
    }

    return true;
  });

  return (
    <div className="p-3.5 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white dark:text-white flex items-center gap-2.5">
            <Hash className="w-5 h-5 text-indigo-400" />
            Dual-Stack IP Directory & Host Inventory
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 font-mono">
            IPv4 & IPv6 host assignments, hostname bindings, status flags, and subnet allocations.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-reserve-next-ip"
            onClick={() => onOpenReserveNextModal()}
            className="flex-1 sm:flex-initial justify-center px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <BookmarkCheck className="w-3.5 h-3.5" /> Reserve Next IP
          </button>

          <button
            id="btn-bulk-generate-ips"
            onClick={onOpenBulkGenerateModal}
            className="flex-1 sm:flex-initial justify-center px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Database className="w-3.5 h-3.5" /> Bulk IP Tool
          </button>

          <button
            id="btn-add-ip"
            onClick={onOpenNewIPModal}
            className="w-full sm:w-auto justify-center px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Assign IP
          </button>
        </div>
      </div>

      {/* Multi-Select Filters Toolbar */}
      <div className={`p-3.5 sm:p-4 rounded-2xl border space-y-3 ${
        isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMobileFilters(prev => !prev)}
              className="sm:pointer-events-none flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300 font-mono"
            >
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>Multi-Criteria Filtering</span>
              {activeFilterCount > 0 && (
                <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMobileFilters(prev => !prev)}
              className="sm:hidden text-xs text-indigo-400 font-mono font-semibold"
            >
              {showMobileFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            <button
              onClick={resetFilters}
              className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1 font-mono transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
        </div>

        {/* Filter grid (always visible on sm+, toggleable on mobile) */}
        <div className={`${showMobileFilters ? 'grid' : 'hidden sm:grid'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 sm:gap-3 font-mono pt-1`}>
          {/* Protocol Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Protocol</label>
            <select
              id="filter-protocol"
              value={filters.ipVersion || 'All'}
              onChange={(e) => setFilters(prev => ({ ...prev, ipVersion: e.target.value as any }))}
              className={`w-full px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              <option value="All">All (Dual-Stack)</option>
              <option value="IPv4">IPv4 Only</option>
              <option value="IPv6">IPv6 Only</option>
            </select>
          </div>

          {/* Datacenter Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Datacenter</label>
            <select
              id="filter-dc"
              value={filters.datacenterId}
              onChange={(e) => setFilters(prev => ({ ...prev, datacenterId: e.target.value }))}
              className={`w-full px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              <option value="All">All Datacenters</option>
              {datacenters.map(dc => (
                <option key={dc.id} value={dc.id}>{dc.name}</option>
              ))}
            </select>
          </div>

          {/* Subnet Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Subnet Prefix</label>
            <select
              id="filter-subnet"
              value={filters.subnetId}
              onChange={(e) => setFilters(prev => ({ ...prev, subnetId: e.target.value }))}
              className={`w-full px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              <option value="All">All Subnets</option>
              {subnets.map(sub => (
                <option key={sub.id} value={sub.id}>[{sub.ipVersion || (sub.cidr.includes(':') ? 'IPv6' : 'IPv4')}] {sub.cidr}</option>
              ))}
            </select>
          </div>

          {/* VLAN Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">VLAN Scope</label>
            <select
              id="filter-vlan"
              value={filters.vlanId}
              onChange={(e) => setFilters(prev => ({ ...prev, vlanId: e.target.value }))}
              className={`w-full px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              <option value="All">All VLANs</option>
              {vlans.map(v => (
                <option key={v.id} value={v.id}>VLAN {v.vlanId}: {v.name}</option>
              ))}
            </select>
          </div>

          {/* IP Status Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">IP Status</label>
            <select
              id="filter-status"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className={`w-full px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active (Assigned)</option>
              <option value="Reserved">Reserved (Holding)</option>
              <option value="Available">Available (Free Pool)</option>
            </select>
          </div>

          {/* Segment Type Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Segment Routing</label>
            <select
              id="filter-segment"
              value={filters.segmentType}
              onChange={(e) => setFilters(prev => ({ ...prev, segmentType: e.target.value }))}
              className={`w-full px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              <option value="All">All Segments</option>
              <option value="Private">Private (RFC1918 / ULA)</option>
              <option value="Public">Public Routed</option>
            </select>
          </div>
        </div>
      </div>

      {/* IP Inventory: Mobile Cards (< md) + Desktop Table (md+) */}
      <div className={`rounded-2xl border overflow-hidden ${
        isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
      }`}>
        <div className="p-3.5 border-b border-slate-700/50 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 font-mono">
            Showing {filteredIPs.length} of {ips.length} Tracked Host Records
          </span>
        </div>

        {/* Mobile Cards Stack (< md) */}
        <div className="block md:hidden divide-y divide-slate-700/40">
          {filteredIPs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-mono text-xs px-4">
              No IP address records found matching the active filter criteria.
            </div>
          ) : (
            filteredIPs.map((ip) => {
              const subnet = subnets.find(s => s.id === ip.subnetId);
              const dc = subnet ? datacenters.find(d => d.id === subnet.datacenterId) : null;
              const vlan = subnet?.vlanId ? vlans.find(v => v.id === subnet.vlanId) : null;
              const isPublic = subnet?.segmentType === 'Public';
              const ipVer = ip.ipVersion || (ip.ipAddress.includes(':') ? 'IPv6' : 'IPv4');

              return (
                <div key={ip.id} className="p-3.5 space-y-2.5 transition-colors hover:bg-slate-800/30">
                  {/* Top line: IP address, copy, status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-indigo-400 break-all">
                        {ip.ipAddress}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold uppercase border ${
                        ipVer === 'IPv6' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      }`}>
                        {ipVer}
                      </span>
                      <button
                        onClick={() => handleCopy(ip.ipAddress, ip.id)}
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        title="Copy IP"
                      >
                        {copiedId === ip.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider border ${
                      ip.status === 'Active' 
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                        : ip.status === 'Reserved'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {ip.status}
                    </span>
                  </div>

                  {/* Device / Hostname */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Host:</span>
                    <span className={`font-mono ${ip.assignedDevice ? 'font-semibold text-slate-200' : 'text-slate-500 italic'}`}>
                      {ip.assignedDevice || 'Unassigned'}
                    </span>
                  </div>

                  {/* Subnet & Datacenter info */}
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-emerald-400 font-semibold truncate max-w-[180px]">{subnet ? subnet.cidr : '—'}</span>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span>{dc?.name || '—'}</span>
                      {vlan && (
                        <span className="text-purple-400 font-semibold">• VLAN {vlan.vlanId}</span>
                      )}
                    </div>
                  </div>

                  {/* Description if present */}
                  {ip.description && (
                    <p className="text-[11px] text-slate-400 line-clamp-1 italic bg-slate-900/40 p-1.5 rounded">
                      {ip.description}
                    </p>
                  )}

                  {/* Mobile Actions Toolbar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-700/30">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleQuickStatusChange(ip, ip.status === 'Active' ? 'Reserved' : 'Active')}
                        className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-[11px] font-mono border border-slate-700/50"
                      >
                        Set {ip.status === 'Active' ? 'Reserved' : 'Active'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenEditIPModal(ip)}
                        className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-indigo-400 text-xs flex items-center gap-1 border border-slate-700/50"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(ip)}
                        className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-rose-400 text-xs flex items-center gap-1 border border-slate-700/50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table (md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b font-mono uppercase tracking-wider text-slate-400 ${
                isDark ? 'border-slate-700/50 text-[11px] bg-slate-900/60' : 'border-slate-200 text-[11px] bg-slate-50'
              }`}>
                <th className="py-3 px-4">Host IP Address</th>
                <th className="py-3 px-4">Protocol</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assigned Hostname / Device</th>
                <th className="py-3 px-4">Parent Subnet</th>
                <th className="py-3 px-4">Datacenter & VLAN</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {filteredIPs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    No IP address records found matching the active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredIPs.map((ip) => {
                  const isEditing = inlineEditingId === ip.id;
                  const subnet = subnets.find(s => s.id === ip.subnetId);
                  const dc = subnet ? datacenters.find(d => d.id === subnet.datacenterId) : null;
                  const vlan = subnet?.vlanId ? vlans.find(v => v.id === subnet.vlanId) : null;
                  const isPublic = subnet?.segmentType === 'Public';
                  const ipVer = ip.ipVersion || (ip.ipAddress.includes(':') ? 'IPv6' : 'IPv4');

                  return (
                    <tr 
                      key={ip.id}
                      className={`transition-colors ${
                        isDark ? 'hover:bg-slate-700/20' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* IP Address + Copy */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-indigo-400 break-all">
                            {ip.ipAddress}
                          </span>
                          <button
                            onClick={() => handleCopy(ip.ipAddress, ip.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 shrink-0"
                            title="Copy IP Address"
                          >
                            {copiedId === ip.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Protocol Badge */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase tracking-wider border ${
                          ipVer === 'IPv6'
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}>
                          {ipVer}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as IPStatus)}
                            className="px-2 py-1 rounded text-xs border dark:bg-slate-900 dark:border-slate-700"
                          >
                            <option value="Active">Active</option>
                            <option value="Reserved">Reserved</option>
                            <option value="Available">Available</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider border ${
                              ip.status === 'Active' 
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                                : ip.status === 'Reserved'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {ip.status}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Hostname / Device */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDevice}
                            onChange={(e) => setEditDevice(e.target.value)}
                            placeholder="e.g. core-router01.internal"
                            className="w-full px-2 py-1 rounded text-xs border dark:bg-slate-900 dark:border-slate-700 font-mono text-slate-200"
                          />
                        ) : (
                          <span className={`font-mono text-xs ${ip.assignedDevice ? 'font-semibold text-slate-200' : 'text-slate-500 italic'}`}>
                            {ip.assignedDevice || '— Unassigned —'}
                          </span>
                        )}
                      </td>

                      {/* Parent Subnet & Segment */}
                      <td className="py-3.5 px-4">
                        {subnet ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-emerald-400 truncate max-w-[180px]">
                              {subnet.cidr}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase font-semibold border ${
                              isPublic 
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                : 'bg-slate-700/40 text-slate-300 border-slate-600/30'
                            }`}>
                              {subnet.segmentType}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Unknown Subnet</span>
                        )}
                      </td>

                      {/* Datacenter & VLAN */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="font-medium text-slate-200 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-indigo-400" />
                            {dc?.name || '—'}
                          </span>
                          {vlan && (
                            <span className="text-[11px] font-mono text-purple-400 flex items-center gap-1">
                              <Layers className="w-3 h-3" /> VLAN {vlan.vlanId}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            placeholder="Description / note"
                            className="w-full px-2 py-1 rounded text-xs border dark:bg-slate-900 dark:border-slate-700 text-slate-200"
                          />
                        ) : (
                          <span className="text-slate-400 truncate max-w-xs block text-[11px]">
                            {ip.description || '—'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => saveInlineEdit(ip)}
                              className="px-2 py-1 rounded bg-indigo-600 text-white font-semibold text-xs"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setInlineEditingId(null)}
                              className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => startInlineEdit(ip)}
                              className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-indigo-400 transition-colors"
                              title="Quick Edit IP"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(ip)}
                              className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-rose-400 transition-colors"
                              title="Release / Delete IP Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
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
