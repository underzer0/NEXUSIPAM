import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { 
  Building2, 
  Plus, 
  MapPin, 
  Layers, 
  Network, 
  Hash, 
  Edit, 
  Trash2, 
  Clock, 
  ExternalLink, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight,
  Eye
} from 'lucide-react';
import { Datacenter, Subnet } from '../types/ipam';

interface DatacentersViewProps {
  onOpenNewDatacenterModal: () => void;
  onOpenEditDatacenterModal: (dc: Datacenter) => void;
  onOpenSubnetVisualizer: (subnet: Subnet) => void;
  onOpenNewSubnetModalForDC?: (dcId: string) => void;
  onOpenNewVlanModalForDC?: (dcId: string) => void;
}

export const DatacentersView: React.FC<DatacentersViewProps> = ({
  onOpenNewDatacenterModal,
  onOpenEditDatacenterModal,
  onOpenSubnetVisualizer,
  onOpenNewSubnetModalForDC,
  onOpenNewVlanModalForDC,
}) => {
  const { 
    datacenters, 
    vlans, 
    subnets, 
    ips, 
    stats, 
    deleteDatacenter, 
    setActiveTab, 
    setFilters,
    isDark 
  } = useIPAM();

  const [selectedDcId, setSelectedDcId] = useState<string | null>(datacenters[0]?.id || null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const activeDc = datacenters.find(d => d.id === selectedDcId) || datacenters[0];
  const activeDcVlans = activeDc ? vlans.filter(v => v.datacenterId === activeDc.id) : [];
  const activeDcSubnets = activeDc ? subnets.filter(s => s.datacenterId === activeDc.id) : [];
  const activeDcSubnetIds = new Set(activeDcSubnets.map(s => s.id));
  const activeDcIps = activeDc ? ips.filter(ip => activeDcSubnetIds.has(ip.subnetId)) : [];

  const handleDelete = async (dc: Datacenter) => {
    if (!window.confirm(`Are you sure you want to delete Datacenter "${dc.name}" (${dc.location})?`)) return;
    try {
      setDeleteError(null);
      await deleteDatacenter(dc.id);
      if (selectedDcId === dc.id) {
        setSelectedDcId(datacenters.find(d => d.id !== dc.id)?.id || null);
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete datacenter');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white dark:text-white flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-indigo-400" />
            Datacenter Infrastructure Sites
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Physical geographic regions acting as independent routing and VLAN isolation scopes.
          </p>
        </div>

        <button
          id="btn-add-datacenter"
          onClick={onOpenNewDatacenterModal}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 self-start sm:self-auto active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Datacenter Site
        </button>
      </div>

      {deleteError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2 font-mono">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Cannot Delete Datacenter: </span>
            {deleteError}
          </div>
        </div>
      )}

      {/* Datacenter Selection Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {datacenters.map((dc) => {
          const isSelected = activeDc?.id === dc.id;
          const dcVlanCount = vlans.filter(v => v.datacenterId === dc.id).length;
          const dcSubnetList = subnets.filter(s => s.datacenterId === dc.id);
          const dcSubnetIdsSet = new Set(dcSubnetList.map(s => s.id));
          const dcIpList = ips.filter(i => dcSubnetIdsSet.has(i.subnetId));
          const activeIps = dcIpList.filter(i => i.status === 'Active').length;
          const resIps = dcIpList.filter(i => i.status === 'Reserved').length;

          return (
            <div
              key={dc.id}
              onClick={() => setSelectedDcId(dc.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? isDark
                    ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/40'
                    : 'bg-indigo-50/80 border-indigo-400 shadow-md ring-1 ring-indigo-400'
                  : isDark
                    ? 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'
                    : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isSelected 
                        ? 'bg-indigo-500 text-white shadow-sm' 
                        : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                    }`}>
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm leading-tight text-white dark:text-white">{dc.name}</h3>
                      <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-36">{dc.location}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEditDatacenterModal(dc);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-indigo-400 hover:bg-slate-800"
                      title="Edit Site Details"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(dc);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                      title="Delete Datacenter"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {dc.description || 'Enterprise physical hosting location.'}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-700/40 grid grid-cols-3 gap-1 text-center font-mono text-xs">
                <div>
                  <span className="block text-[10px] text-slate-400 font-sans uppercase">VLANs</span>
                  <span className="font-bold text-purple-400">{dcVlanCount}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-sans uppercase">Subnets</span>
                  <span className="font-bold text-emerald-400">{dcSubnetList.length}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-sans uppercase">Alloc IPs</span>
                  <span className="font-bold text-indigo-400">{activeIps + resIps}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Datacenter Deep-Dive Breakdown */}
      {activeDc && (
        <div className={`p-6 rounded-2xl border ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-inherit">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold">{activeDc.name} Detail Explorer</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Site Scope Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                {activeDc.location} • <Clock className="w-3.5 h-3.5 ml-2" /> Provisioned {new Date(activeDc.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveTab('ips');
                  setFilters(prev => ({ ...prev, datacenterId: activeDc.id }));
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Hash className="w-3.5 h-3.5 text-blue-400" /> Filter IP Directory
              </button>
            </div>
          </div>

          {/* Subnet & VLAN Breakdown Tabs within this DC */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Scoped VLANs in this Datacenter */}
            <div className={`p-4 rounded-xl border ${
              isDark ? 'bg-slate-900/40 border-slate-700/50' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-white dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  VLANs Scoped to {activeDc.name} ({activeDcVlans.length})
                </h3>
                <span className="text-[11px] font-mono text-slate-400">Unique (DC + VLAN ID)</span>
              </div>

              {activeDcVlans.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 font-mono">
                  No VLANs configured in {activeDc.name} yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                  {activeDcVlans.map((vlan) => {
                    const linkedSubnets = activeDcSubnets.filter(s => s.vlanId === vlan.id);
                    return (
                      <div 
                        key={vlan.id}
                        className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                          isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-purple-400 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                              VLAN {vlan.vlanId}
                            </span>
                            <span className="font-semibold text-slate-200">{vlan.name}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-1">{vlan.description}</span>
                        </div>

                        <div className="text-right font-mono text-[11px]">
                          <span className="text-slate-400">{linkedSubnets.length} Subnet{linkedSubnets.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Subnets in this Datacenter */}
            <div className={`p-4 rounded-xl border ${
              isDark ? 'bg-slate-900/40 border-slate-700/50' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-white dark:text-white flex items-center gap-2">
                  <Network className="w-4 h-4 text-emerald-400" />
                  Subnets in {activeDc.name} ({activeDcSubnets.length})
                </h3>
              </div>

              {activeDcSubnets.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 font-mono">
                  No Subnets allocated in {activeDc.name} yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                  {activeDcSubnets.map((sub) => {
                    const subIps = ips.filter(i => i.subnetId === sub.id);
                    const isPublic = sub.segmentType === 'Public';

                    return (
                      <div 
                        key={sub.id}
                        className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                          isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-emerald-400">
                              {sub.cidr}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold border ${
                              isPublic ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-slate-700/50 text-slate-300 border-slate-600/30'
                            }`}>
                              {sub.segmentType}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-1">{sub.description}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-slate-400">
                            {subIps.length} IPs
                          </span>
                          <button
                            onClick={() => onOpenSubnetVisualizer(sub)}
                            className="p-1.5 rounded hover:bg-indigo-500/20 text-indigo-400 transition-colors"
                            title="View Interactive Matrix"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
