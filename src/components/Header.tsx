import React, { useEffect, useRef, useState } from 'react';
import { useIPAM, ActiveTab } from '../context/IPAMContext';
import { BookmarkCheck, Building2, Hash, Layers, Menu, Network, Plus, Search, X } from 'lucide-react';
import { BeyondIPLogo } from './BeyondIPLogo';
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
}

export const Header: React.FC<HeaderProps> = ({ onOpenNewSubnetModal, onOpenReserveNextModal, onToggleMobileMenu }) => {
  const { setFilters, datacenters, subnets, ips, vlans, setActiveTab } = useIPAM();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const q = query.toLowerCase().trim();
  const results: Result[] = q
    ? [
        ...ips
          .filter((i) => i.ipAddress.includes(q) || i.assignedDevice.toLowerCase().includes(q))
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
          .map((d) => ({ key: d.id, icon: Building2, primary: d.name, secondary: d.location, tab: 'datacenters' as const, search: '' })),
      ]
    : [];

  // The target page reads filters.search when it opens, so the result is pre-filtered.
  const openResult = (r: Result) => {
    setFilters((prev) => ({ ...prev, search: r.search }));
    setActiveTab(r.tab);
    setQuery('');
    setOpen(false);
  };

  return (
    <header id="ipam-header" className="z-10 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6 md:px-8 dark:border-slate-800 dark:bg-slate-950/80">
      <div className="flex shrink-0 items-center gap-2 md:hidden">
        <button type="button" onClick={onToggleMobileMenu} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <BeyondIPLogo size="sm" variant="icon" />
      </div>

      <div ref={searchRef} className="relative min-w-0 max-w-xl flex-1">
        <label className="relative block">
          <span className="sr-only">Search everything</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="global-search-input"
            type="text"
            role="combobox"
            aria-expanded={open && !!q}
            aria-controls="global-search-results"
            placeholder="Search IPs, subnets, VLANs…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'Enter' && results[0]) openResult(results[0]);
            }}
            className="w-full rounded-xl border border-transparent bg-slate-100 py-2 pl-9 pr-9 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label="Clear search">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>

        {open && q && (
          <div
            id="global-search-results"
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            {results.length === 0 ? (
              <p className={`py-6 text-center text-sm ${muted}`}>Nothing matches “{query}”.</p>
            ) : (
              results.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => openResult(r)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <r.icon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="shrink-0 font-mono font-medium text-slate-900 dark:text-white">{r.primary}</span>
                  <span className={`truncate text-xs ${muted}`}>{r.secondary}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button id="btn-quick-reserve-ip" type="button" onClick={onOpenReserveNextModal} className={`${secondaryButton} px-3`} aria-label="Reserve next IP">
          <BookmarkCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Reserve IP</span>
        </button>
        <button id="btn-quick-new-subnet" type="button" onClick={onOpenNewSubnetModal} className={`${primaryButton} px-3`} aria-label="New subnet">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New subnet</span>
        </button>
      </div>
    </header>
  );
};
