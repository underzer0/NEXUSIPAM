import React, { useEffect, useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { BookmarkCheck, Database, Edit, Network, Search, Trash2 } from 'lucide-react';
import { Subnet, IPAddress, VLAN } from '../types/ipam';
import { getIPVersion, parseCIDR } from '../utils/ipCalculator';
import { Ring, Segmented, card, chip, chipNeutral, formatCount, iconButton, input, muted, percentOf, primaryButton, usableOf } from './ui';

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
  const { subnets, datacenters, vlans, ips, deleteSubnet, filters, canEditDc, editableDatacenters } = useIPAM();

  const [dcFilter, setDcFilter] = useState('All');
  const [segmentFilter, setSegmentFilter] = useState('All');
  // The dashboard tiles set the global IP version before opening this page.
  const [versionFilter, setVersionFilter] = useState<'All' | 'IPv4' | 'IPv6'>(filters.ipVersion === 'IPv4' || filters.ipVersion === 'IPv6' ? filters.ipVersion : 'All');
  const [searchFilter, setSearchFilter] = useState(filters.search);

  // The header search can change filters while this page is already open; follow it.
  useEffect(() => {
    setSearchFilter(filters.search);
    setVersionFilter(filters.ipVersion === 'IPv4' || filters.ipVersion === 'IPv6' ? filters.ipVersion : 'All');
    setDcFilter('All');
    setSegmentFilter('All');
  }, [filters.search, filters.ipVersion]);
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
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Subnets <span className={`font-mono text-base font-medium ${muted}`}>{filteredSubnets.length}</span>
        </h1>
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
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            placeholder="Search CIDR or description"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className={`${input} w-full pl-9`}
          />
        </label>
        <Segmented label="IP version" options={['All', 'IPv4', 'IPv6'] as const} value={versionFilter} onChange={setVersionFilter} />
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
          <Network className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className={`text-sm ${muted}`}>{subnets.length === 0 ? 'No subnets yet.' : 'No subnets match these filters.'}</p>
          {subnets.length === 0 && editableDatacenters.length > 0 && (
            <button type="button" onClick={onOpenNewSubnetModal} className={primaryButton}>
              Create the first one
            </button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredSubnets.map((subnet) => {
            const subIps = ipsBySubnet.get(subnet.id) ?? [];
            const used = subIps.filter((i) => i.status !== 'Available').length;
            const usable = usableOf(subnet.cidr);
            const percent = percentOf(used, usable);
            const vlan = subnet.vlanId ? vlanById.get(subnet.vlanId) : undefined;
            const ver = subnet.ipVersion || getIPVersion(subnet.cidr);
            const isPublic = subnet.segmentType === 'Public';

            return (
              <li key={subnet.id} className={`${card} group flex flex-col transition hover:border-cyan-500/60`}>
                <button
                  type="button"
                  onClick={() => onOpenSubnetVisualizer(subnet)}
                  title={rangeOf(subnet.cidr)}
                  className="flex flex-1 items-center gap-4 p-4 text-left cursor-pointer"
                >
                  <Ring percent={percent} label={`${subnet.cidr} utilization`} size={60} />
                  <span className="min-w-0 flex-1 space-y-1.5">
                    <span className="block break-all font-mono text-base font-semibold text-zinc-900 group-hover:text-cyan-600 dark:text-white dark:group-hover:text-cyan-400">
                      {subnet.cidr}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className={`${chipNeutral} font-mono`}>{ver}</span>
                      <span className={`${chip} ${isPublic ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300' : 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isPublic ? 'bg-purple-500' : 'bg-cyan-400'}`} aria-hidden />
                        {subnet.segmentType}
                      </span>
                      {vlan && <span className={`${chip} bg-purple-500/10 font-mono text-purple-700 dark:text-purple-300`} title={vlan.name}>VLAN {vlan.vlanId}</span>}
                    </span>
                    <span className={`block truncate text-xs ${muted}`}>
                      {dcName.get(subnet.datacenterId) ?? 'Unknown site'}
                      {subnet.description && ` · ${subnet.description}`}
                    </span>
                  </span>
                </button>

                <div className="flex items-center gap-0.5 border-t border-zinc-100 px-2 py-1.5 dark:border-zinc-800/80">
                  <span className={`mr-auto pl-2 font-mono text-xs ${muted}`}>
                    {used} / {formatCount(usable)}
                  </span>
                  {canEditDc(subnet.datacenterId) && (
                    <>
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
