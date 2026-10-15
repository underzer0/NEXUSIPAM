import React, { useEffect, useRef, useState } from 'react';
import { useIPAM, ActiveTab } from '../context/IPAMContext';
import { BookmarkCheck, Building2, Hash, Layers, Menu, Network, Plus, Search, X } from 'lucide-react';
import { BeyondIPLogo } from './BeyondIPLogo';
import { compressIPv6, isValidIP } from '../utils/ipCalculator';
import { muted, primaryButton, secondaryButton } from './ui';

interface HeaderProps {
  onOpenNewSubnetModal: () => void;
  onOpenReserveNextModal: () => void;
  onOpenNewDatacenterModal?: () => void;
  onToggleMobileMenu?: () => void;
  onOpenAuditLogs?: () => void;
}

interface Result {
  key: string;
  icon: React.ElementType;
  primary: string;
  secondary: string;
  tab: ActiveTab;
  search: string;
  datacenterId?: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNewSubnetModal, onOpenReserveNextModal, onToggleMobileMenu }) => {
  const { setFilters, datacenters, subnets, ips, vlans, setActiveTab, editableDatacenters, editableSubnets } = useIPAM();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  // Highlighted result for the arrow keys; Enter opens it.
  const [active, setActive] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const q = query.toLowerCase().trim();
  // Stored IPv6 addresses are in short form; match a typed long form too.
  const qIP = isValidIP(q) && q.includes(':') ? compressIPv6(q) : q;
  const results: Result[] = q
    ? [
        ...ips
          .filter((i) => i.ipAddress.includes(qIP) || i.assignedDevice.toLowerCase().includes(q))
          .slice(0, 4)
          .map((i) => ({ key: i.id, icon: Hash, primary: i.ipAddress, secondary: i.assignedDevice || i.status, tab: 'ips' as const, search: i.ipAddress })),
        ...subnets
          .filter((s) => s.cidr.includes(q) || s.description.toLowerCase().includes(q))
          .slice(0, 3)
          .map((s) => ({ key: s.id, icon: Network, primary: s.cidr, secondary: s.description, tab: 'subnets' as const, search: s.cidr })),
        ...vlans
          .filter((v) => v.name.toLowerCase().includes(q) || v.vlanId.toString().includes(q))
          .slice(0, 3)
          .map((v) => ({ key: v.id, icon: Layers, primary: `VLAN ${v.vlanId}`, secondary: v.name, tab: 'vlans' as const, search: v.name })),
        ...datacenters
          .filter((d) => d.name.toLowerCase().includes(q) || d.location.toLowerCase().includes(q))
          .slice(0, 2)
          .map((d) => ({ key: d.id, icon: Building2, primary: d.name, secondary: d.location, tab: 'datacenters' as const, search: '', datacenterId: d.id })),
      ]
    : [];

  // The target page follows filters.search, so the result is pre-filtered. Every other filter is
  // cleared, or an earlier choice (IPv4 only, Reserved only, another datacenter) could hide the result.
  const openResult = (r: Result) => {
    setFilters({
      search: r.search,
      datacenterId: r.datacenterId ?? 'All',
      vlanId: 'All',
      status: 'All',
      segmentType: 'All',
      ipVersion: 'All',
      subnetId: 'All',
    });
    setActiveTab(r.tab);
    setQuery('');
    setOpen(false);
  };

  return (
    <header id="ipam-header" className="z-10 flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white/80 px-4 backdrop-blur sm:px-6 md:px-8 dark:border-zinc-800/80 dark:bg-zinc-950/80">
      <div className="flex shrink-0 items-center gap-2 md:hidden">
        <button type="button" onClick={onToggleMobileMenu} className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <BeyondIPLogo size="sm" variant="icon" />
      </div>

      <div ref={searchRef} className="relative min-w-0 max-w-xl flex-1">
        <label className="relative block">
          <span className="sr-only">Search everything</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            id="global-search-input"
            type="text"
            role="combobox"
            aria-expanded={open && !!q}
            aria-controls="global-search-results"
            placeholder="Search IPs, subnets, VLANs…"
            value={query}
            aria-activedescendant={open && results[active] ? `search-result-${active}` : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setOpen(true);
                if (results.length) setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length);
              }
              if (e.key === 'Enter' && results[active]) openResult(results[active]);
            }}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-9 text-sm text-zinc-900 placeholder-zinc-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100 dark:focus:bg-zinc-950"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" aria-label="Clear search">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>

        {open && q && (
          <div
            id="global-search-results"
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            {results.length === 0 ? (
              <p className={`py-6 text-center text-sm ${muted}`}>Nothing matches “{query}”.</p>
            ) : (
              results.map((r, i) => (
                <button
                  key={r.key}
                  id={`search-result-${i}`}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onClick={() => openResult(r)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm cursor-pointer ${
                    i === active ? 'bg-cyan-500/10' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <r.icon className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="shrink-0 font-mono font-medium text-zinc-900 dark:text-white">{r.primary}</span>
                  <span className={`truncate text-xs ${muted}`}>{r.secondary}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {editableSubnets.length > 0 && (
          <button id="btn-quick-reserve-ip" type="button" onClick={onOpenReserveNextModal} className={`${secondaryButton} px-3`} aria-label="Reserve next IP">
            <BookmarkCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Reserve IP</span>
          </button>
        )}
        {editableDatacenters.length > 0 && (
          <button id="btn-quick-new-subnet" type="button" onClick={onOpenNewSubnetModal} className={`${primaryButton} px-3`} aria-label="New subnet">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New subnet</span>
          </button>
        )}
      </div>
    </header>
  );
};
