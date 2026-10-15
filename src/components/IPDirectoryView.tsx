import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { Check, Copy, Database, Edit, Hash, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { IPAddress, IPStatus, Subnet } from '../types/ipam';
import { compressIPv6, isValidIP } from '../utils/ipCalculator';
import { Segmented, card, chipNeutral, iconButton, input, linkButton, muted, percentOf, primaryButton, secondaryButton } from './ui';

interface IPDirectoryViewProps {
  onOpenNewIPModal: () => void;
  onOpenEditIPModal: (ip: IPAddress) => void;
  onOpenBulkGenerateModal: () => void;
}

const STATUS_TEXT: Record<IPStatus, string> = {
  Active: 'text-cyan-700 dark:text-cyan-300',
  Reserved: 'text-amber-700 dark:text-amber-300',
  Available: 'text-emerald-700 dark:text-emerald-300',
};
const STATUS_DOT: Record<IPStatus, string> = { Active: 'bg-cyan-400', Reserved: 'bg-amber-400', Available: 'bg-emerald-400' };
const STATUSES: IPStatus[] = ['Active', 'Reserved', 'Available'];

// shortcut: renders at most PAGE rows at a time; switch to a virtualized list if people need to scroll through thousands.
const PAGE = 200;

const versionOf = (ip: IPAddress) => ip.ipVersion || (ip.ipAddress.includes(':') ? 'IPv6' : 'IPv4');

export const IPDirectoryView: React.FC<IPDirectoryViewProps> = ({
  onOpenNewIPModal,
  onOpenEditIPModal,
  onOpenBulkGenerateModal,
}) => {
  const { ips, subnets, datacenters, vlans, deleteIP, filters, setFilters, resetFilters, canEditDc, editableSubnets } = useIPAM();

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
  // A complete address finds that address only, not 10.0.0.10-19 (or subnet 10.0.0.128/25) as well.
  const exactIP = isValidIP(q);
  // IPv6 has many spellings of one address (2001:db8:0:0::1 = 2001:db8::1); compare the short form, as stored.
  const exactQ = exactIP && q.includes(':') ? compressIPv6(q) : q;
  // Everything except status, so the status chips can show counts for the current view.
  const scopedIPs = ips.filter((ip) => {
    const subnet = subnetById.get(ip.subnetId);
    if (!subnet) return false;
    if (filters.ipVersion && filters.ipVersion !== 'All' && versionOf(ip) !== filters.ipVersion) return false;
    if (filters.datacenterId !== 'All' && subnet.datacenterId !== filters.datacenterId) return false;
    if (filters.subnetId !== 'All' && ip.subnetId !== filters.subnetId) return false;
    if (exactIP) return ip.ipAddress.toLowerCase() === exactQ;
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

  const versionFilter = filters.ipVersion === 'IPv4' || filters.ipVersion === 'IPv6' ? filters.ipVersion : 'All';

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          IP addresses <span className={`font-mono text-base font-medium ${muted}`}>{filteredIPs.length}</span>
        </h1>
        <div className="flex flex-wrap gap-2">
          {editableSubnets.length > 0 && (
            <>
              <button id="btn-bulk-generate-ips" type="button" onClick={onOpenBulkGenerateModal} className={secondaryButton}>
                <Database className="h-4 w-4" /> Bulk add
              </button>
              <button id="btn-add-ip" type="button" onClick={onOpenNewIPModal} className={primaryButton}>
                <Plus className="h-4 w-4" /> Assign IP
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search IP addresses</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              placeholder="Search IP, device, description or subnet"
              value={filters.search}
              onChange={(e) => setFilter({ search: e.target.value })}
              className={`${input} w-full pl-9`}
            />
          </label>
          <Segmented label="IP version" options={['All', 'IPv4', 'IPv6'] as const} value={versionFilter} onChange={(ver) => setFilter({ ipVersion: ver })} />
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

        {/* Status tiles double as the status filter; the bar shows the mix at a glance */}
        <div role="group" aria-label="Status" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['All', ...STATUSES] as const).map((s) => {
            const n = s === 'All' ? scopedIPs.length : statusCount(s);
            const active = filters.status === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter({ status: s })}
                className={`${card} flex items-center gap-3 px-4 py-3 text-left transition cursor-pointer ${
                  active ? 'border-cyan-500! ring-1 ring-cyan-500/40' : 'hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <span className={`h-8 w-1 rounded-full ${s === 'All' ? 'bg-zinc-400 dark:bg-zinc-600' : STATUS_DOT[s]}`} aria-hidden />
                <span>
                  <span className="block font-mono text-xl font-semibold leading-tight text-zinc-900 dark:text-white">{n}</span>
                  <span className={`block text-xs ${muted}`}>{s === 'All' ? 'All addresses' : s}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden>
          {STATUSES.map((s) => (
            <div key={s} className={`${STATUS_DOT[s]} transition-all duration-500`} style={{ width: `${percentOf(statusCount(s), scopedIPs.length)}%` }} />
          ))}
        </div>
        {hasFilters && (
          <button type="button" onClick={() => { resetFilters(); setLimit(PAGE); }} className={`${linkButton} flex items-center gap-1`}>
            <RotateCcw className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </div>

      {/* List: one markup, a table-like grid on wide screens and stacked rows on phones */}
      {filteredIPs.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 p-12 text-center`}>
          <Hash className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className={`text-sm ${muted}`}>{ips.length === 0 ? 'No IP addresses yet.' : 'No IP addresses match these filters.'}</p>
          {ips.length === 0 && editableSubnets.length > 0 && (
            <button type="button" onClick={onOpenNewIPModal} className={primaryButton}>
              Assign the first one
            </button>
          )}
        </div>
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className={`hidden grid-cols-[minmax(12rem,1.2fr)_7rem_1fr_1fr_6rem] gap-4 border-b border-zinc-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide md:grid dark:border-zinc-800 ${muted}`}>
            <span>Address</span>
            <span>Status</span>
            <span>Device</span>
            <span>Subnet</span>
            <span className="sr-only">Actions</span>
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredIPs.slice(0, limit).map((ip) => {
              const subnet = subnetById.get(ip.subnetId)!;
              const vlan = subnet.vlanId ? vlanTag.get(subnet.vlanId) : undefined;
              return (
                <li
                  key={ip.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-5 py-3 transition hover:bg-zinc-50 md:grid-cols-[minmax(12rem,1.2fr)_7rem_1fr_1fr_6rem] dark:hover:bg-zinc-800/40"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="break-all font-mono text-sm font-semibold text-zinc-900 dark:text-white">{ip.ipAddress}</span>
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
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${STATUS_TEXT[ip.status]}`}>
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[ip.status]}`} aria-hidden />
                    {ip.status}
                  </span>
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <p className={`truncate text-sm ${ip.assignedDevice ? 'font-medium text-zinc-800 dark:text-zinc-100' : `italic ${muted}`}`}>
                      {ip.assignedDevice || 'Unassigned'}
                    </p>
                    {ip.description && <p className={`truncate text-xs ${muted}`}>{ip.description}</p>}
                  </div>
                  <div className={`col-span-2 min-w-0 text-xs md:col-span-1 ${muted}`}>
                    <p className="truncate font-mono text-zinc-700 dark:text-zinc-300">{subnet.cidr}</p>
                    <p className="truncate">
                      {dcName.get(subnet.datacenterId) ?? 'Unknown site'}
                      {vlan !== undefined && ` · VLAN ${vlan}`}
                    </p>
                  </div>
                  <div className="col-span-2 flex justify-end gap-0.5 md:col-span-1">
                    {canEditDc(subnet.datacenterId) && (
                      <>
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
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {filteredIPs.length > limit && (
            <div className="border-t border-zinc-100 p-4 text-center dark:border-zinc-800">
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
