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
  ExternalLink,
  Menu
} from 'lucide-react';

interface HeaderProps {
  onOpenNewSubnetModal: () => void;
  onOpenReserveNextModal: () => void;
  onOpenNewDatacenterModal: () => void;
  onToggleMobileMenu?: () => void;
  onOpenAuditLogs?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewSubnetModal,
  onOpenReserveNextModal,
  onOpenNewDatacenterModal,
  onToggleMobileMenu,
  onOpenAuditLogs,
}) => {
  const { 
    filters, 
    setFilters, 
    datacenters, 
    subnets, 
    ips, 
    vlans,
    currentUser,
    activeTab,
    setActiveTab, 
    isDark,
    wsConnected 
  } = useIPAM();

  const getInitials = (n: string) => {
    const parts = (n || 'User').trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (parts[0] || 'U').substring(0, 2).toUpperCase();
  };

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
      className={`h-16 border-b px-3 sm:px-6 md:px-8 flex items-center justify-between gap-2.5 sm:gap-4 z-10 shrink-0 ${
        isDark ? 'bg-[#0F172A] border-slate-700/50 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      }`}
    >
      {/* Mobile Menu Toggle Button & Brand Icon on Mobile */}
      <div className="flex items-center gap-2 md:hidden shrink-0">
        <button
          onClick={onToggleMobileMenu}
          className={`p-2 rounded-lg transition-colors ${
            isDark
              ? 'text-slate-200 hover:text-white hover:bg-slate-800'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="Open Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
          IP
        </div>
      </div>

      {/* Search Bar with Global Autocomplete */}
      <div ref={searchRef} className="relative flex-1 max-w-xl min-w-0">
        <div className={`relative flex items-center rounded-lg border transition-all ${
          isDark 
            ? 'bg-slate-800/90 border-slate-700/60 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30' 
            : 'bg-slate-100 border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30'
        }`}>
          <Search className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ml-2.5 sm:ml-3 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            id="global-search-input"
            type="text"
            placeholder="Search IPs, Subnets..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim()) setShowSearchResults(true);
            }}
            className={`w-full bg-transparent px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none font-sans ${
              isDark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
            }`}
          />
          {searchQuery && (
            <button 
              onClick={clearSearch}
              className={`mr-2 sm:mr-3 p-1 rounded transition-colors ${
                isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && (
          <div className={`absolute top-full left-0 right-0 mt-2 p-2 rounded-xl shadow-2xl border max-h-80 sm:max-h-96 overflow-y-auto z-50 ${
            isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            {!hasResults ? (
              <div className={`py-6 text-center text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                No matching network resources found for "{searchQuery}"
              </div>
            ) : (
              <div className="space-y-3">
                {matchedIPs.length > 0 && (
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Hash className="w-3 h-3 text-indigo-500 dark:text-indigo-400" /> IP Addresses
                    </div>
                    {matchedIPs.map(ip => (
                      <div
                        key={ip.id}
                        onClick={() => {
                          setActiveTab('ips');
                          setFilters(prev => ({ ...prev, search: ip.ipAddress }));
                          setShowSearchResults(false);
                        }}
                        className={`px-3 py-2 rounded-lg text-xs sm:text-sm cursor-pointer flex items-center justify-between transition-colors ${
                          isDark ? 'hover:bg-indigo-500/10' : 'hover:bg-indigo-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-mono truncate">
                          <span className={`font-semibold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{ip.ipAddress}</span>
                          {ip.assignedDevice && (
                            <span className={`text-[11px] truncate max-w-xs font-sans ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>({ip.assignedDevice})</span>
                          )}
                        </div>
                        <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-mono uppercase font-semibold shrink-0 ml-2 ${
                          ip.status === 'Active' ? (isDark ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-blue-50 text-blue-700 border border-blue-200') :
                          ip.status === 'Reserved' ? (isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-50 text-amber-700 border border-amber-200') :
                          (isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200')
                        }`}>
                          {ip.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {matchedSubnets.length > 0 && (
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Network className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> Subnets
                    </div>
                    {matchedSubnets.map(sub => (
                      <div
                        key={sub.id}
                        onClick={() => {
                          setActiveTab('subnets');
                          setFilters(prev => ({ ...prev, search: sub.cidr }));
                          setShowSearchResults(false);
                        }}
                        className={`px-3 py-2 rounded-lg text-xs sm:text-sm cursor-pointer flex items-center justify-between transition-colors ${
                          isDark ? 'hover:bg-emerald-500/10' : 'hover:bg-emerald-50'
                        }`}
                      >
                        <span className={`font-mono font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{sub.cidr}</span>
                        <span className={`text-[11px] truncate max-w-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{sub.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                {matchedVlans.length > 0 && (
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Layers className="w-3 h-3 text-purple-500 dark:text-purple-400" /> VLANs
                    </div>
                    {matchedVlans.map(v => (
                      <div
                        key={v.id}
                        onClick={() => {
                          setActiveTab('vlans');
                          setFilters(prev => ({ ...prev, search: v.name }));
                          setShowSearchResults(false);
                        }}
                        className={`px-3 py-2 rounded-lg text-xs sm:text-sm cursor-pointer flex items-center justify-between transition-colors ${
                          isDark ? 'hover:bg-purple-500/10' : 'hover:bg-purple-50'
                        }`}
                      >
                        <span className={`font-mono font-semibold ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>VLAN {v.vlanId}: {v.name}</span>
                        <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{v.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                {matchedDCs.length > 0 && (
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Building2 className="w-3 h-3 text-amber-500 dark:text-amber-400" /> Datacenters
                    </div>
                    {matchedDCs.map(dc => (
                      <div
                        key={dc.id}
                        onClick={() => {
                          setActiveTab('datacenters');
                          setFilters(prev => ({ ...prev, search: dc.name }));
                          setShowSearchResults(false);
                        }}
                        className={`px-3 py-2 rounded-lg text-xs sm:text-sm cursor-pointer flex items-center justify-between transition-colors ${
                          isDark ? 'hover:bg-amber-500/10' : 'hover:bg-amber-50'
                        }`}
                      >
                        <span className={`font-semibold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>{dc.name}</span>
                        <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{dc.location}</span>
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
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <button
          onClick={onOpenAuditLogs}
          className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded uppercase tracking-wider font-mono transition-colors cursor-pointer ${
            isDark
              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
          }`}
          title="Click to view Live Network Alerts & Audit Stream"
        >
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-emerald-400' : 'bg-emerald-600'}`}></span>
          Websocket Sync
        </button>

        {/* Quick Reserve Next IP Button */}
        <button
          id="btn-quick-reserve-ip"
          onClick={onOpenReserveNextModal}
          className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer ${
            isDark
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
              : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
          }`}
          title="Find & Reserve the Next Available IP in any Subnet"
        >
          <BookmarkCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Reserve Next IP</span>
          <span className="sm:hidden text-[11px]">Reserve</span>
        </button>

        {/* Add Subnet Button */}
        <button
          id="btn-quick-new-subnet"
          onClick={onOpenNewSubnetModal}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all active:scale-95 cursor-pointer"
          title="Allocate Subnet"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Allocate Subnet</span>
          <span className="sm:hidden text-[11px]">Subnet</span>
        </button>

        {/* User Profile Header Trigger */}
        <button
          id="header-user-profile-button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 p-1 sm:pl-2 sm:pr-2.5 sm:py-1 rounded-xl border transition-all cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 ring-2 ring-indigo-500/20'
              : isDark
                ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/60 text-slate-200'
                : 'bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-900'
          }`}
          title={`Logged in as ${currentUser.email} (${currentUser.name}) - Click to edit profile`}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
            {getInitials(currentUser.name)}
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-semibold leading-tight truncate max-w-[120px]">
              {currentUser.name}
            </span>
            <span className={`text-[10px] leading-tight truncate max-w-[120px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {currentUser.email}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
};
