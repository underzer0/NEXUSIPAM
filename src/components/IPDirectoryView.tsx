import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { BookmarkCheck, Check, Copy, Database, Edit, Hash, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { IPAddress, IPStatus, Subnet } from '../types/ipam';
import { card, chip, chipNeutral, iconButton, input, linkButton, muted, primaryButton, secondaryButton } from './ui';

interface IPDirectoryViewProps {
  onOpenNewIPModal: () => void;
  onOpenEditIPModal: (ip: IPAddress) => void;
  onOpenReserveNextModal: (subnetId?: string) => void;
  onOpenBulkGenerateModal: () => void;
}

const STATUS_STYLE: Record<IPStatus, string> = {
  Active: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  Reserved: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  Available: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};
const STATUS_DOT: Record<IPStatus, string> = { Active: 'bg-blue-500', Reserved: 'bg-amber-500', Available: 'bg-emerald-500' };
const STATUSES: IPStatus[] = ['Active', 'Reserved', 'Available'];

// shortcut: renders at most PAGE rows at a time; switch to a virtualized list if people need to scroll through thousands.
const PAGE = 200;

const versionOf = (ip: IPAddress) => ip.ipVersion || (ip.ipAddress.includes(':') ? 'IPv6' : 'IPv4');

export const IPDirectoryView: React.FC<IPDirectoryViewProps> = ({
  onOpenNewIPModal,
  onOpenEditIPModal,
  onOpenReserveNextModal,
  onOpenBulkGenerateModal,
}) => {
  const { ips, subnets, datacenters, vlans, deleteIP, filters, setFilters, resetFilters } = useIPAM();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const subnetById = new Map<string, Subnet>(subnets.map((s) => [s.id, s]));
  const dcName = new Map(datacenters.map((d) => [d.id, d.name]));
  const vlanTag = new Map<string, number>(vlans.map((v) => [v.id, v.vlanId]));

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (ip: IPAddress) => {
    if (!window.confirm(`Remove ${ip.ipAddress} from the directory?`)) return;
    try {
      await deleteIP(ip.id);
    } catch (err: any) {
      alert(err.message || 'Failed to remove IP');
    }
  };

  const q = filters.search.toLowerCase().trim();
  // Everything except status, so the status chips can show counts for the current view.
  const scopedIPs = ips.filter((ip) => {
    const subnet = subnetById.get(ip.subnetId);
    if (!subnet) return false;
    if (filters.ipVersion && filters.ipVersion !== 'All' && versionOf(ip) !== filters.ipVersion) return false;
    if (filters.datacenterId !== 'All' && subnet.datacenterId !== filters.datacenterId) return false;
    if (filters.subnetId !== 'All' && ip.subnetId !== filters.subnetId) return false;
    return (
      !q ||
      ip.ipAddress.toLowerCase().includes(q) ||
      ip.assignedDevice.toLowerCase().includes(q) ||
      ip.description.toLowerCase().includes(q) ||
      subnet.cidr.toLowerCase().includes(q)
    );
  });
  const statusCount = (s: IPStatus) => scopedIPs.filter((ip) => ip.status === s).length;
  const filteredIPs = filters.status === 'All' ? scopedIPs : scopedIPs.filter((ip) => ip.status === filters.status);

  const hasFilters =
    !!q ||
    (filters.ipVersion && filters.ipVersion !== 'All') ||
    filters.datacenterId !== 'All' ||
    filters.subnetId !== 'All' ||
    filters.status !== 'All';

  const setFilter = (patch: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setLimit(PAGE);
  };

  const segmented = (active: boolean) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition cursor-pointer ${
      active ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
    }`;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          IP addresses <span className={`text-lg font-medium ${muted}`}>{filteredIPs.length}</span>
        </h1>
        <div className="flex flex-wrap gap-2">
          <button id="btn-reserve-next-ip" type="button" onClick={() => onOpenReserveNextModal()} className={secondaryButton}>
            <BookmarkCheck className="h-4 w-4" /> Reserve next
          </button>
          <button id="btn-bulk-generate-ips" type="button" onClick={onOpenBulkGenerateModal} className={secondaryButton}>
            <Database className="h-4 w-4" /> Bulk add
          </button>
          <button id="btn-add-ip" type="button" onClick={onOpenNewIPModal} className={primaryButton}>
            <Plus className="h-4 w-4" /> Assign IP
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search IP addresses</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search IP, device, description or subnet"
              value={filters.search}
              onChange={(e) => setFilter({ search: e.target.value })}
              className={`${input} w-full pl-9`}
            />
          </label>
          <div role="group" aria-label="IP version" className="flex rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
            {['All', 'IPv4', 'IPv6'].map((ver) => (
              <button key={ver} type="button" aria-pressed={(filters.ipVersion || 'All') === ver} onClick={() => setFilter({ ipVersion: ver })} className={segmented((filters.ipVersion || 'All') === ver)}>
                {ver}
              </button>
            ))}
          </div>
          <select aria-label="Datacenter" value={filters.datacenterId} onChange={(e) => setFilter({ datacenterId: e.target.value })} className={input}>
            <option value="All">All datacenters</option>
            {datacenters.map((dc) => (
              <option key={dc.id} value={dc.id}>{dc.name}</option>
            ))}
          </select>
          <select aria-label="Subnet" value={filters.subnetId} onChange={(e) => setFilter({ subnetId: e.target.value })} className={input}>
            <option value="All">All subnets</option>
            {subnets.map((sub) => (
              <option key={sub.id} value={sub.id}>{sub.cidr}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Status" className="flex flex-wrap rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
            <button type="button" aria-pressed={filters.status === 'All'} onClick={() => setFilter({ status: 'All' })} className={segmented(filters.status === 'All')}>
              All <span className={`text-xs ${muted}`}>{scopedIPs.length}</span>
            </button>
            {STATUSES.map((s) => (
              <button key={s} type="button" aria-pressed={filters.status === s} onClick={() => setFilter({ status: s })} className={segmented(filters.status === s)}>
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} aria-hidden />
                {s} <span className={`text-xs ${muted}`}>{statusCount(s)}</span>
              </button>
            ))}
          </div>
          {hasFilters && (
            <button type="button" onClick={() => { resetFilters(); setLimit(PAGE); }} className={`${linkButton} flex items-center gap-1`}>
              <RotateCcw className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* List: one markup, a table-like grid on wide screens and stacked rows on phones */}
      {filteredIPs.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 p-12 text-center`}>
          <Hash className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className={`text-sm ${muted}`}>{ips.length === 0 ? 'No IP addresses yet.' : 'No IP addresses match these filters.'}</p>
          {ips.length === 0 && (
            <button type="button" onClick={onOpenNewIPModal} className={primaryButton}>
              Assign the first one
            </button>
          )}
        </div>
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className={`hidden grid-cols-[minmax(12rem,1.2fr)_7rem_1fr_1fr_6rem] gap-4 border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide md:grid dark:border-slate-800 ${muted}`}>
            <span>Address</span>
            <span>Status</span>
            <span>Device</span>
            <span>Subnet</span>
            <span className="sr-only">Actions</span>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredIPs.slice(0, limit).map((ip) => {
              const subnet = subnetById.get(ip.subnetId)!;
              const vlan = subnet.vlanId ? vlanTag.get(subnet.vlanId) : undefined;
              return (
                <li
                  key={ip.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-5 py-3 transition hover:bg-slate-50 md:grid-cols-[minmax(12rem,1.2fr)_7rem_1fr_1fr_6rem] dark:hover:bg-slate-800/40"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="break-all font-mono text-sm font-semibold text-slate-900 dark:text-white">{ip.ipAddress}</span>
                    {versionOf(ip) === 'IPv6' && <span className={chipNeutral}>v6</span>}
                    <button
                      type="button"
                      onClick={() => handleCopy(ip.ipAddress, ip.id)}
                      className={`${iconButton} p-1`}
                      title="Copy address"
                      aria-label={`Copy ${ip.ipAddress}`}
                    >
                      {copiedId === ip.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <span className={`${chip} w-fit ${STATUS_STYLE[ip.status]}`}>{ip.status}</span>
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <p className={`truncate text-sm ${ip.assignedDevice ? 'font-medium text-slate-800 dark:text-slate-100' : `italic ${muted}`}`}>
                      {ip.assignedDevice || 'Unassigned'}
                    </p>
                    {ip.description && <p className={`truncate text-xs ${muted}`}>{ip.description}</p>}
                  </div>
                  <div className={`col-span-2 min-w-0 text-xs md:col-span-1 ${muted}`}>
                    <p className="truncate font-mono text-slate-700 dark:text-slate-300">{subnet.cidr}</p>
                    <p className="truncate">
                      {dcName.get(subnet.datacenterId) ?? 'Unknown site'}
                      {vlan !== undefined && ` · VLAN ${vlan}`}
                    </p>
                  </div>
                  <div className="col-span-2 flex justify-end gap-0.5 md:col-span-1">
                    <button type="button" onClick={() => onOpenEditIPModal(ip)} className={iconButton} title="Edit" aria-label={`Edit ${ip.ipAddress}`}>
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ip)}
                      className={`${iconButton} hover:text-rose-600! dark:hover:text-rose-400!`}
                      title="Remove"
                      aria-label={`Remove ${ip.ipAddress}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {filteredIPs.length > limit && (
            <div className="border-t border-slate-100 p-4 text-center dark:border-slate-800">
              <button type="button" onClick={() => setLimit((l) => l + PAGE)} className={linkButton}>
                Show {Math.min(PAGE, filteredIPs.length - limit)} more of {filteredIPs.length - limit} remaining
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
