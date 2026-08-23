import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { 
  Layers, 
  Plus, 
  Building2, 
  Network, 
  Edit, 
  Trash2, 
  Info, 
  Filter, 
  ShieldCheck, 
  AlertCircle,
  Copy
} from 'lucide-react';
import { VLAN } from '../types/ipam';

interface VlansViewProps {
  onOpenNewVlanModal: () => void;
  onOpenEditVlanModal: (vlan: VLAN) => void;
}

export const VlansView: React.FC<VlansViewProps> = ({
  onOpenNewVlanModal,
  onOpenEditVlanModal,
}) => {
  const { 
    vlans, 
    datacenters, 
    subnets, 
    deleteVlan, 
    isDark 
  } = useIPAM();

  const [dcFilter, setDcFilter] = useState<string>('All');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Group VLANs by vlanId to visually highlight reused VLAN IDs across multiple DCs
  const vlanIdCounts = vlans.reduce((acc, v) => {
    acc[v.vlanId] = (acc[v.vlanId] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const filteredVlans = vlans.filter((v) => {
    if (dcFilter !== 'All' && v.datacenterId !== dcFilter) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        v.vlanId.toString().includes(q) ||
        v.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleDelete = async (vlan: VLAN) => {
    const dc = datacenters.find(d => d.id === vlan.datacenterId);
    if (!window.confirm(`Are you sure you want to delete VLAN ${vlan.vlanId} ("${vlan.name}") in ${dc?.name || 'Datacenter'}?`)) return;
    try {
      setDeleteError(null);
      await deleteVlan(vlan.id);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete VLAN');
    }
  };

  return (
    <div className="p-3.5 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white dark:text-white flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-purple-400" />
            Virtual LAN (VLAN) Management
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 font-mono">
            Layer-2 broadcast domains scoped locally to individual Datacenters (VLAN IDs 1–4094).
          </p>
        </div>

        <button
          id="btn-add-vlan"
          onClick={onOpenNewVlanModal}
          className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 active:scale-95"
        >
          <Plus className="w-4 h-4" /> Create VLAN
        </button>
      </div>

      {/* Domain Rule Explainer Card */}
      <div className={`p-3.5 sm:p-4 rounded-2xl border flex items-start gap-3 text-xs ${
        isDark ? 'bg-purple-950/20 border-purple-500/30 text-purple-200' : 'bg-purple-50 border-purple-200 text-purple-900'
      }`}>
        <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-xs block text-purple-300">VLAN Uniqueness Architecture Rule</span>
          <p className="text-inherit opacity-90 leading-relaxed font-mono text-[11px]">
            In enterprise networks, VLAN IDs (1–4094) are scoped to their respective physical Datacenter. 
            For example, <span className="font-semibold text-purple-300 underline">VLAN 100</span> can exist in <strong>DC-East</strong> and independently in <strong>DC-West</strong> without collision.
          </p>
        </div>
      </div>

      {deleteError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2 font-mono">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Cannot Delete VLAN: </span>
            {deleteError}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
        isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 font-mono">
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px]">Datacenter Scope:</span>
          </div>
          <select
            id="vlan-dc-filter"
            value={dcFilter}
            onChange={(e) => setDcFilter(e.target.value)}
            className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
              isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}
          >
            <option value="All">All Datacenters ({vlans.length})</option>
            {datacenters.map((dc) => (
              <option key={dc.id} value={dc.id}>
                {dc.name} ({vlans.filter(v => v.datacenterId === dc.id).length})
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Filter VLAN name, ID..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className={`w-full px-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
              isDark ? 'bg-slate-900/80 border-slate-700/60 text-slate-200 placeholder-slate-500' : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}
          />
        </div>
      </div>

      {/* VLANs: Mobile Cards (< md) + Desktop Table (md+) */}
      <div className={`rounded-2xl border overflow-hidden ${
        isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200'
      }`}>
        {/* Mobile Cards View */}
        <div className="block md:hidden divide-y divide-slate-700/40">
          {filteredVlans.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-mono text-xs px-4">
              No VLANs found matching current filters.
            </div>
          ) : (
            filteredVlans.map((vlan) => {
              const dc = datacenters.find(d => d.id === vlan.datacenterId);
              const linkedSubnets = subnets.filter(s => s.vlanId === vlan.id);
              const isReusedAcrossDCs = (vlanIdCounts[vlan.vlanId] || 0) > 1;

              return (
                <div key={vlan.id} className="p-3.5 space-y-2.5 transition-colors hover:bg-slate-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                        VID {vlan.vlanId}
                      </span>
                      <span className="font-bold text-sm text-white">{vlan.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onOpenEditVlanModal(vlan)}
                        className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-indigo-400 text-xs border border-slate-700/50"
                        title="Edit VLAN"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(vlan)}
                        className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-rose-400 text-xs border border-slate-700/50"
                        title="Delete VLAN"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Datacenter:</span>
                    <span className="text-slate-200 font-medium">{dc?.name || 'Unknown'}</span>
                  </div>

                  {linkedSubnets.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      <span className="text-[11px] text-slate-400 font-mono">Subnets:</span>
                      {linkedSubnets.map(s => (
                        <span key={s.id} className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {s.cidr}
                        </span>
                      ))}
                    </div>
                  )}

                  {vlan.description && (
                    <p className="text-[11px] text-slate-400 italic bg-slate-900/40 p-1.5 rounded">
                      {vlan.description}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b font-mono uppercase tracking-wider text-slate-400 ${
                isDark ? 'border-slate-700/50 text-[11px] bg-slate-900/60' : 'border-slate-200 text-[11px] bg-slate-50'
              }`}>
                <th className="py-3 px-4">VLAN Tag</th>
                <th className="py-3 px-4">VLAN Name</th>
                <th className="py-3 px-4">Scoped Datacenter</th>
                <th className="py-3 px-4">Attached Subnets</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {filteredVlans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-mono">
                    No VLANs found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredVlans.map((vlan) => {
                  const dc = datacenters.find(d => d.id === vlan.datacenterId);
                  const linkedSubnets = subnets.filter(s => s.vlanId === vlan.id);
                  const isReusedAcrossDCs = (vlanIdCounts[vlan.vlanId] || 0) > 1;

                  return (
                    <tr 
                      key={vlan.id}
                      className={`transition-colors ${
                        isDark ? 'hover:bg-slate-700/20' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            VID {vlan.vlanId}
                          </span>
                          {isReusedAcrossDCs && (
                            <span 
                              className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              title={`VLAN ID ${vlan.vlanId} is independently reused across multiple datacenters`}
                            >
                              Reused Tag
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-xs text-white dark:text-white">
                        {vlan.name}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-200">
                          <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{dc?.name || 'Unknown Datacenter'}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">{dc?.location}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        {linkedSubnets.length === 0 ? (
                          <span className="text-slate-500 italic text-[11px]">No subnets assigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {linkedSubnets.map(s => (
                              <span 
                                key={s.id}
                                className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              >
                                {s.cidr}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate text-[11px]">
                        {vlan.description || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onOpenEditVlanModal(vlan)}
                            className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-indigo-400 transition-colors"
                            title="Edit VLAN"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(vlan)}
                            className="p-1.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete VLAN"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
