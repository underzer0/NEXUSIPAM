import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { Edit, Layers, Plus, Search, Trash2 } from 'lucide-react';
import { Subnet, VLAN } from '../types/ipam';
import { card, chip, chipNeutral, iconButton, input, muted, primaryButton } from './ui';

interface VlansViewProps {
  onOpenNewVlanModal: () => void;
  onOpenEditVlanModal: (vlan: VLAN) => void;
}

export const VlansView: React.FC<VlansViewProps> = ({ onOpenNewVlanModal, onOpenEditVlanModal }) => {
  const { vlans, datacenters, subnets, deleteVlan } = useIPAM();

  const [dcFilter, setDcFilter] = useState('All');
  const [searchFilter, setSearchFilter] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const dcName = new Map(datacenters.map((d) => [d.id, d.name]));
  const subnetsByVlan = new Map<string, Subnet[]>();
  for (const s of subnets) {
    if (!s.vlanId) continue;
    const list = subnetsByVlan.get(s.vlanId);
    if (list) list.push(s);
    else subnetsByVlan.set(s.vlanId, [s]);
  }
  // VLAN IDs are scoped per datacenter, so the same tag in two sites is allowed; we just point it out.
  const tagCount = new Map<number, number>();
  for (const v of vlans) tagCount.set(v.vlanId, (tagCount.get(v.vlanId) ?? 0) + 1);

  const q = searchFilter.trim().toLowerCase();
  const filteredVlans = vlans
    .filter((v) => {
      if (dcFilter !== 'All' && v.datacenterId !== dcFilter) return false;
      return !q || v.name.toLowerCase().includes(q) || v.vlanId.toString().includes(q) || v.description.toLowerCase().includes(q);
    })
    .sort((a, b) => a.vlanId - b.vlanId);

  const handleDelete = async (vlan: VLAN) => {
    if (!window.confirm(`Delete VLAN ${vlan.vlanId} (${vlan.name}) in ${dcName.get(vlan.datacenterId) ?? 'this datacenter'}?`)) return;
    try {
      setDeleteError(null);
      await deleteVlan(vlan.id);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete VLAN');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          VLANs <span className={`text-lg font-medium ${muted}`}>{filteredVlans.length}</span>
        </h1>
        <button id="btn-add-vlan" type="button" onClick={onOpenNewVlanModal} className={primaryButton}>
          <Plus className="h-4 w-4" /> New VLAN
        </button>
      </div>

      {deleteError && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-600 dark:text-rose-400">
          {deleteError}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search VLANs</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search name, ID or description"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className={`${input} w-full pl-9`}
          />
        </label>
        <select id="vlan-dc-filter" aria-label="Datacenter" value={dcFilter} onChange={(e) => setDcFilter(e.target.value)} className={input}>
          <option value="All">All datacenters</option>
          {datacenters.map((dc) => (
            <option key={dc.id} value={dc.id}>{dc.name}</option>
          ))}
        </select>
      </div>

      {filteredVlans.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 p-12 text-center`}>
          <Layers className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className={`text-sm ${muted}`}>{vlans.length === 0 ? 'No VLANs yet.' : 'No VLANs match these filters.'}</p>
          {vlans.length === 0 && (
            <button type="button" onClick={onOpenNewVlanModal} className={primaryButton}>
              Create the first one
            </button>
          )}
        </div>
      ) : (
        <ul className={`${card} divide-y divide-slate-100 overflow-hidden dark:divide-slate-800`}>
          {filteredVlans.map((vlan) => {
            const linked = subnetsByVlan.get(vlan.id) ?? [];
            const shared = (tagCount.get(vlan.vlanId) ?? 0) > 1;
            return (
              <li
                key={vlan.id}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition hover:bg-slate-50 md:grid-cols-[5rem_1.2fr_1fr_1.5fr_auto] dark:hover:bg-slate-800/40"
              >
                <span className="flex flex-col items-start gap-1">
                  <span className={`${chip} bg-purple-500/10 font-mono text-sm font-bold text-purple-700 dark:text-purple-300`}>{vlan.vlanId}</span>
                  {shared && (
                    <span className={`text-[10px] font-medium ${muted}`} title={`VLAN ${vlan.vlanId} also exists in another datacenter`}>
                      shared ID
                    </span>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900 dark:text-white">{vlan.name}</p>
                  {vlan.description && <p className={`truncate text-xs ${muted}`}>{vlan.description}</p>}
                </div>
                <div className="flex justify-end gap-0.5 md:order-last">
                  <button type="button" onClick={() => onOpenEditVlanModal(vlan)} className={iconButton} title="Edit" aria-label={`Edit VLAN ${vlan.vlanId}`}>
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(vlan)}
                    className={`${iconButton} hover:text-rose-600! dark:hover:text-rose-400!`}
                    title="Delete"
                    aria-label={`Delete VLAN ${vlan.vlanId}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <span className={`col-span-3 truncate text-sm md:col-span-1 ${muted}`}>{dcName.get(vlan.datacenterId) ?? 'Unknown site'}</span>
                <div className="col-span-3 flex flex-wrap gap-1 md:col-span-1">
                  {linked.length === 0 ? (
                    <span className={`text-xs italic ${muted}`}>No subnets</span>
                  ) : (
                    linked.map((s) => (
                      <span key={s.id} className={`${chipNeutral} font-mono`}>
                        {s.cidr}
                      </span>
                    ))
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
