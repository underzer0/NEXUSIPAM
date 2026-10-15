import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { Edit, Layers, Plus, Search, Trash2 } from 'lucide-react';
import { Subnet, VLAN } from '../types/ipam';
import { card, chipNeutral, iconButton, input, muted, primaryButton } from './ui';

// One color per datacenter so VLANs from the same site read as a group.
const SITE_COLORS = [
  { block: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-400' },
  { block: 'bg-purple-500/15 text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  { block: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', dot: 'bg-amber-400' },
  { block: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-400' },
  { block: 'bg-rose-500/15 text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
  { block: 'bg-sky-500/15 text-sky-700 dark:text-sky-300', dot: 'bg-sky-400' },
];
const MAX_VLAN = 4094;

interface VlansViewProps {
  onOpenNewVlanModal: () => void;
  onOpenEditVlanModal: (vlan: VLAN) => void;
}

export const VlansView: React.FC<VlansViewProps> = ({ onOpenNewVlanModal, onOpenEditVlanModal }) => {
  const { vlans, datacenters, subnets, deleteVlan, filters, canEditDc, editableDatacenters } = useIPAM();

  const [dcFilter, setDcFilter] = useState('All');
  // Header search results open this page with filters.search pre-set.
  const [searchFilter, setSearchFilter] = useState(filters.search);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const dcName = new Map(datacenters.map((d) => [d.id, d.name]));
  const siteColor = new Map<string, (typeof SITE_COLORS)[number]>(datacenters.map((d, i) => [d.id, SITE_COLORS[i % SITE_COLORS.length]]));
  const colorOf = (dcId: string) => siteColor.get(dcId) ?? SITE_COLORS[0];
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
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          VLANs <span className={`font-mono text-base font-medium ${muted}`}>{filteredVlans.length}</span>
        </h1>
        {editableDatacenters.length > 0 && (
          <button id="btn-add-vlan" type="button" onClick={onOpenNewVlanModal} className={primaryButton}>
            <Plus className="h-4 w-4" /> New VLAN
          </button>
        )}
      </div>

      {deleteError && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-600 dark:text-rose-400">
          {deleteError}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search VLANs</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
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

      {/* Tag map: where the VLAN IDs in view sit within 1-4094 */}
      {filteredVlans.length > 0 && (
        <div className={`${card} space-y-2 p-4`}>
          <div className="relative h-6 rounded bg-zinc-100 dark:bg-zinc-800/70" role="img" aria-label="VLAN IDs in use across 1 to 4094">
            {filteredVlans.map((v) => (
              <span
                key={v.id}
                title={`VLAN ${v.vlanId} · ${v.name}`}
                className={`absolute inset-y-1 w-0.5 rounded-full ${colorOf(v.datacenterId).dot}`}
                style={{ left: `${((v.vlanId - 1) / (MAX_VLAN - 1)) * 100}%` }}
              />
            ))}
          </div>
          <div className={`flex justify-between font-mono text-[10px] ${muted}`}>
            <span>1</span>
            <span>1024</span>
            <span>2048</span>
            <span>3072</span>
            <span>{MAX_VLAN}</span>
          </div>
          <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${muted}`}>
            {datacenters.map((dc) => (
              <span key={dc.id} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-sm ${colorOf(dc.id).dot}`} aria-hidden />
                {dc.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {filteredVlans.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 p-12 text-center`}>
          <Layers className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className={`text-sm ${muted}`}>{vlans.length === 0 ? 'No VLANs yet.' : 'No VLANs match these filters.'}</p>
          {vlans.length === 0 && editableDatacenters.length > 0 && (
            <button type="button" onClick={onOpenNewVlanModal} className={primaryButton}>
              Create the first one
            </button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredVlans.map((vlan) => {
            const linked = subnetsByVlan.get(vlan.id) ?? [];
            const shared = (tagCount.get(vlan.vlanId) ?? 0) > 1;
            return (
              <li key={vlan.id} className={`${card} flex flex-col`}>
                <div className="flex flex-1 items-start gap-4 p-4">
                  <span className={`flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-lg font-mono ${colorOf(vlan.datacenterId).block}`}>
                    <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">VLAN</span>
                    <span className="text-lg font-bold leading-none">{vlan.vlanId}</span>
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-semibold text-zinc-900 dark:text-white">{vlan.name}</p>
                    <p className={`truncate text-xs ${muted}`}>
                      {dcName.get(vlan.datacenterId) ?? 'Unknown site'}
                      {shared && <span title={`VLAN ${vlan.vlanId} also exists in another datacenter`}> · shared ID</span>}
                    </p>
                    {vlan.description && <p className={`truncate text-xs ${muted}`}>{vlan.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-zinc-100 px-4 py-2 dark:border-zinc-800/80">
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {linked.length === 0 ? (
                      <span className={`text-xs ${muted}`}>No subnets</span>
                    ) : (
                      linked.slice(0, 3).map((s) => (
                        <span key={s.id} className={`${chipNeutral} font-mono`}>
                          {s.cidr}
                        </span>
                      ))
                    )}
                    {linked.length > 3 && <span className={`${chipNeutral} font-mono`}>+{linked.length - 3}</span>}
                  </div>
                  {canEditDc(vlan.datacenterId) && (
                    <>
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
                    </>
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
