import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { BookmarkCheck, Database, Edit, Eye, Network, Plus, Search, Trash2 } from 'lucide-react';
import { Subnet, IPAddress, VLAN } from '../types/ipam';
import { getIPVersion, parseCIDR } from '../utils/ipCalculator';
import { Bar, card, chip, chipNeutral, formatCount, iconButton, input, muted, percentLabel, percentOf, primaryButton, usableOf } from './ui';

interface SubnetsViewProps {
  onOpenNewSubnetModal: () => void;
  onOpenEditSubnetModal: (subnet: Subnet) => void;
  onOpenSubnetVisualizer: (subnet: Subnet) => void;
  onOpenReserveNextModal: (subnetId?: string) => void;
  onOpenBulkGenerateModal: (subnet: Subnet) => void;
}

const rangeOf = (cidr: string) => {
  try {
    const c = parseCIDR(cidr);
    return `${c.firstUsableHost} – ${c.lastUsableHost}`;
  } catch {
    return '';
  }
};

export const SubnetsView: React.FC<SubnetsViewProps> = ({
  onOpenNewSubnetModal,
  onOpenEditSubnetModal,
  onOpenSubnetVisualizer,
  onOpenReserveNextModal,
  onOpenBulkGenerateModal,
}) => {
  const { subnets, datacenters, vlans, ips, deleteSubnet, filters } = useIPAM();

  const [dcFilter, setDcFilter] = useState('All');
  const [segmentFilter, setSegmentFilter] = useState('All');
  // The dashboard tiles set the global IP version before opening this page.
  const [versionFilter, setVersionFilter] = useState(filters.ipVersion || 'All');
  const [searchFilter, setSearchFilter] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const ipsBySubnet = new Map<string, IPAddress[]>();
  for (const ip of ips) {
    const list = ipsBySubnet.get(ip.subnetId);
    if (list) list.push(ip);
    else ipsBySubnet.set(ip.subnetId, [ip]);
  }
  const dcName = new Map(datacenters.map((d) => [d.id, d.name]));
  const vlanById = new Map<string, VLAN>(vlans.map((v) => [v.id, v]));

  const q = searchFilter.trim().toLowerCase();
  const filteredSubnets = subnets.filter((s) => {
    if (dcFilter !== 'All' && s.datacenterId !== dcFilter) return false;
    if (segmentFilter !== 'All' && s.segmentType !== segmentFilter) return false;
    if (versionFilter !== 'All' && (s.ipVersion || getIPVersion(s.cidr)) !== versionFilter) return false;
    return !q || s.cidr.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
  });

  const handleDelete = async (s: Subnet) => {
    const assignedCount = ipsBySubnet.get(s.id)?.length ?? 0;
    const warning =
      assignedCount > 0
        ? `Subnet ${s.cidr} has ${assignedCount} IP records. Deleting it also deletes them. Continue?`
        : `Delete subnet ${s.cidr}?`;
    if (!window.confirm(warning)) return;

    try {
      setDeleteError(null);
      await deleteSubnet(s.id);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete subnet');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Subnets <span className={`text-lg font-medium ${muted}`}>{filteredSubnets.length}</span>
        </h1>
        <button id="btn-add-subnet" type="button" onClick={onOpenNewSubnetModal} className={primaryButton}>
          <Plus className="h-4 w-4" /> New subnet
        </button>
      </div>

      {deleteError && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-600 dark:text-rose-400">
          {deleteError}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search subnets</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search CIDR or description"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className={`${input} w-full pl-9`}
          />
        </label>
        <div role="group" aria-label="IP version" className="flex rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
          {['All', 'IPv4', 'IPv6'].map((ver) => (
            <button
              key={ver}
              type="button"
              aria-pressed={versionFilter === ver}
              onClick={() => setVersionFilter(ver)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition cursor-pointer ${
                versionFilter === ver
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {ver}
            </button>
          ))}
        </div>
        <select aria-label="Datacenter" value={dcFilter} onChange={(e) => setDcFilter(e.target.value)} className={input}>
          <option value="All">All datacenters</option>
          {datacenters.map((dc) => (
            <option key={dc.id} value={dc.id}>{dc.name}</option>
          ))}
        </select>
        <select aria-label="Segment" value={segmentFilter} onChange={(e) => setSegmentFilter(e.target.value)} className={input}>
          <option value="All">Private and public</option>
          <option value="Private">Private</option>
          <option value="Public">Public</option>
        </select>
      </div>

      {/* List */}
      {filteredSubnets.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 p-12 text-center`}>
          <Network className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className={`text-sm ${muted}`}>{subnets.length === 0 ? 'No subnets yet.' : 'No subnets match these filters.'}</p>
          {subnets.length === 0 && (
            <button type="button" onClick={onOpenNewSubnetModal} className={primaryButton}>
              Create the first one
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredSubnets.map((subnet) => {
            const subIps = ipsBySubnet.get(subnet.id) ?? [];
            const used = subIps.filter((i) => i.status !== 'Available').length;
            const usable = usableOf(subnet.cidr);
            const percent = percentOf(used, usable);
            const vlan = subnet.vlanId ? vlanById.get(subnet.vlanId) : undefined;
            const ver = subnet.ipVersion || getIPVersion(subnet.cidr);

            return (
              <li key={subnet.id} className={`${card} flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center`}>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenSubnetVisualizer(subnet)}
                      className="break-all font-mono text-base font-bold text-slate-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400 cursor-pointer"
                    >
                      {subnet.cidr}
                    </button>
                    <span className={chipNeutral}>{ver}</span>
                    <span className={`${chip} ${subnet.segmentType === 'Public' ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300' : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'}`}>
                      {subnet.segmentType}
                    </span>
                    <span className={chipNeutral}>{dcName.get(subnet.datacenterId) ?? 'Unknown site'}</span>
                    {vlan && <span className={`${chip} bg-purple-500/10 text-purple-700 dark:text-purple-300`}>VLAN {vlan.vlanId} · {vlan.name}</span>}
                  </div>
                  <p className={`truncate text-sm ${muted}`}>
                    {subnet.description && <span>{subnet.description} · </span>}
                    <span className="font-mono text-xs">{rangeOf(subnet.cidr)}</span>
                  </p>
                </div>

                <div className="w-full space-y-1.5 lg:w-56">
                  <Bar percent={percent} label={`${subnet.cidr} utilization`} />
                  <div className={`flex justify-between text-xs tabular-nums ${muted}`}>
                    <span>{used} / {formatCount(usable)} used</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{percentLabel(percent)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5 border-t border-slate-100 pt-3 dark:border-slate-800 lg:border-0 lg:pt-0">
                  <button type="button" onClick={() => onOpenSubnetVisualizer(subnet)} className={iconButton} title="Address map" aria-label="Address map">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => onOpenReserveNextModal(subnet.id)} className={iconButton} title="Reserve next IP" aria-label="Reserve next IP">
                    <BookmarkCheck className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => onOpenBulkGenerateModal(subnet)} className={iconButton} title="Bulk add IPs" aria-label="Bulk add IPs">
                    <Database className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => onOpenEditSubnetModal(subnet)} className={iconButton} title="Edit" aria-label="Edit subnet">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(subnet)}
                    className={`${iconButton} hover:text-rose-600! dark:hover:text-rose-400!`}
                    title="Delete"
                    aria-label="Delete subnet"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
