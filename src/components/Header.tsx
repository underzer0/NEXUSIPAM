import React, { useState, useRef, useEffect } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { 
  Search, 
  Plus, 
  BookmarkCheck, 
  Network, 
  Building2, 
  Hash, 
  X, 
  Layers, 
  Radio, 
  HelpCircle,
  ExternalLink
} from 'lucide-react';

interface HeaderProps {
  onOpenNewSubnetModal: () => void;
  onOpenReserveNextModal: () => void;
  onOpenNewDatacenterModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewSubnetModal,
  onOpenReserveNextModal,
  onOpenNewDatacenterModal,
}) => {
  const { 
    filters, 
    setFilters, 
    datacenters, 
    subnets, 
    ips, 
    vlans,
    setActiveTab, 
    isDark,
    wsConnected 
  } = useIPAM();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setFilters(prev => ({ ...prev, search: val }));
    setShowSearchResults(val.trim().length > 0);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setFilters(prev => ({ ...prev, search: '' }));
    setShowSearchResults(false);
  };

  // Quick matched results
  const q = searchQuery.toLowerCase().trim();
  const matchedIPs = q ? ips.filter(i => i.ipAddress.includes(q) || i.assignedDevice.toLowerCase().includes(q)).slice(0, 4) : [];
  const matchedSubnets = q ? subnets.filter(s => s.cidr.includes(q) || s.description.toLowerCase().includes(q)).slice(0, 3) : [];
  const matchedVlans = q ? vlans.filter(v => v.name.toLowerCase().includes(q) || v.vlanId.toString().includes(q)).slice(0, 3) : [];
  const matchedDCs = q ? datacenters.filter(d => d.name.toLowerCase().includes(q) || d.location.toLowerCase().includes(q)).slice(0, 2) : [];

  const hasResults = matchedIPs.length > 0 || matchedSubnets.length > 0 || matchedVlans.length > 0 || matchedDCs.length > 0;

  return (
    <header 
      id="ipam-header"
      className={`h-16 border-b px-6 sm:px-8 flex items-center justify-between gap-4 z-10 shrink-0 ${
        isDark ? 'bg-[#0F172A] border-slate-700/50 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      }`}
    >
      {/* Search Bar with Global Autocomplete */}
      <div ref={searchRef} className="relative flex-1 max-w-xl">
        <div className={`relative flex items-center rounded-lg border transition-all ${
          isDark 
            ? 'bg-slate-800/90 border-slate-700/60 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30' 
            : 'bg-slate-100 border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30'
        }`}>
          <Search className="w-4 h-4 ml-3 text-slate-400 shrink-0" />
          <input
            id="global-search-input"
            type="text"
            placeholder="Search IPs, Hostnames, Subnets, VLANs..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim()) setShowSearchResults(true);
            }}
            className="w-full bg-transparent px-3 py-2 text-sm focus:outline-none placeholder-slate-500 font-sans"
          />
          {searchQuery && (
            <button 
              onClick={clearSearch}
              className="mr-3 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && (
          <div className={`absolute top-full left-0 right-0 mt-2 p-2 rounded-xl shadow-2xl border max-h-96 overflow-y-auto z-50 ${
            isDark ? 'bg-[#1E293B] border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            {!hasResults ? (
              <div className="py-6 text-center text-sm text-slate-400">
                No matching network resources found for "{searchQuery}"
              </div>
            ) : (
              <div className="space-y-3">
                {matchedIPs.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                      <Hash className="w-3 h-3 text-indigo-400" /> IP Addresses
                    </div>
                    {matchedIPs.map(ip => (
                      <div
                        key={ip.id}
                        onClick={() => {
                          setActiveTab('ips');
                          setFilters(prev => ({ ...prev, search: ip.ipAddress }));
                          setShowSearchResults(false);
                        }}
                        className="px-3 py-2 rounded-lg text-sm hover:bg-indigo-500/10 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-semibold text-indigo-400">{ip.ipAddress}</span>
                          {ip.assignedDevice && (
                            <span className="text-xs text-slate-400 truncate max-w-xs font-sans">({ip.assignedDevice})</span>
                          )}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold ${
                          ip.status === 'Active' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          ip.status === 'Reserved' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {ip.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {matchedSubnets.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                      <Network className="w-3 h-3 text-emerald-400" /> Subnets
                    </div>
                    {matchedSubnets.map(sub => (
                      <div
                        key={sub.id}
                        onClick={() => {
                          setActiveTab('subnets');
                          setFilters(prev => ({ ...prev, search: sub.cidr }));
                          setShowSearchResults(false);
                        }}
                        className="px-3 py-2 rounded-lg text-sm hover:bg-emerald-500/10 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <span className="font-mono font-semibold text-emerald-400">{sub.cidr}</span>
                        <span className="text-xs text-slate-400 truncate max-w-xs">{sub.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                {matchedVlans.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-purple-400" /> VLANs
                    </div>
                    {matchedVlans.map(v => (
                      <div
                        key={v.id}
                        onClick={() => {
                          setActiveTab('vlans');
                          setFilters(prev => ({ ...prev, search: v.name }));
                          setShowSearchResults(false);
                        }}
                        className="px-3 py-2 rounded-lg text-sm hover:bg-purple-500/10 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <span className="font-mono font-semibold text-purple-400">VLAN {v.vlanId}: {v.name}</span>
                        <span className="text-xs text-slate-400">{v.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                {matchedDCs.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-amber-400" /> Datacenters
                    </div>
                    {matchedDCs.map(dc => (
                      <div
                        key={dc.id}
                        onClick={() => {
                          setActiveTab('datacenters');
                          setFilters(prev => ({ ...prev, search: dc.name }));
                          setShowSearchResults(false);
                        }}
                        className="px-3 py-2 rounded-lg text-sm hover:bg-amber-500/10 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <span className="font-semibold text-amber-400">{dc.name}</span>
                        <span className="text-xs text-slate-400">{dc.location}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons & Websocket Badge */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded uppercase tracking-wider font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Websocket Connected
        </span>

        {/* Quick Reserve Next IP Button */}
        <button
          id="btn-quick-reserve-ip"
          onClick={onOpenReserveNextModal}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all shadow-sm active:scale-95"
          title="Find & Reserve the Next Available IP in any Subnet"
        >
          <BookmarkCheck className="w-4 h-4" />
          <span className="hidden sm:inline">Reserve Next IP</span>
        </button>

        {/* Add Subnet Button */}
        <button
          id="btn-quick-new-subnet"
          onClick={onOpenNewSubnetModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Allocate Subnet</span>
        </button>
      </div>
    </header>
  );
};
