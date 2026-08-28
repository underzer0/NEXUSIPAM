import React from 'react';
import { useIPAM } from '../context/IPAMContext';
import { BeyondIPLogo } from './BeyondIPLogo';
import { 
  LayoutDashboard, 
  Building2, 
  Layers, 
  Network, 
  Hash, 
  Calculator, 
  Code2, 
  Sun, 
  Moon, 
  Radio, 
  ShieldCheck, 
  Server,
  Activity,
  User,
  UserPlus,
  Settings,
  X
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  collapsed, 
  setCollapsed,
  isMobileOpen = false,
  onMobileClose
}) => {
  const { 
    activeTab, 
    setActiveTab, 
    datacenters, 
    vlans, 
    subnets, 
    ips, 
    stats,
    currentUser,
    wsConnected, 
    isDark, 
    toggleTheme 
  } = useIPAM();

  const getInitials = (n: string) => {
    const parts = (n || 'User').trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (parts[0] || 'U').substring(0, 2).toUpperCase();
  };

  const navItems = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'datacenters' as const,
      label: 'Datacenters',
      icon: Building2,
      badge: datacenters.length,
    },
    {
      id: 'vlans' as const,
      label: 'VLANs',
      icon: Layers,
      badge: vlans.length,
    },
    {
      id: 'subnets' as const,
      label: 'Subnets / Prefixes',
      icon: Network,
      badge: subnets.length,
    },
    {
      id: 'ips' as const,
      label: 'IP Directory',
      icon: Hash,
      badge: ips.length,
    },
    {
      id: 'calculator' as const,
      label: 'CIDR Calculator',
      icon: Calculator,
      badge: null,
    },
    {
      id: 'api-docs' as const,
      label: 'REST API Explorer',
      icon: Code2,
      badge: 'v1.0',
    },
    {
      id: 'profile' as const,
      label: 'User Profile',
      icon: User,
      badge: 'Account',
    },
  ];

  const handleNavClick = (tabId: typeof navItems[number]['id'] | 'signup') => {
    setActiveTab(tabId);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar / Drawer Container */}
      <aside 
        id="ipam-sidebar"
        className={`fixed md:relative inset-y-0 left-0 z-50 flex flex-col border-r transition-all duration-300 shrink-0 ${
          isMobileOpen 
            ? 'translate-x-0 w-72 shadow-2xl' 
            : '-translate-x-full md:translate-x-0'
        } ${
          collapsed ? 'md:w-20' : 'md:w-64'
        } ${
          isDark 
            ? 'bg-[#1E293B] border-slate-700/50 text-slate-300' 
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-inherit shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            {collapsed && !isMobileOpen ? (
              <BeyondIPLogo size="md" variant="icon" />
            ) : (
              <BeyondIPLogo size="md" variant="full" />
            )}
          </div>

          {/* Mobile Close Button */}
          <button 
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Sync Status Pill */}
        <div className="px-4 pt-3 shrink-0">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            wsConnected 
              ? isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            <span className="relative flex h-2 w-2 shrink-0">
              {wsConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${wsConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            {(!collapsed || isMobileOpen) && (
              <span className="truncate text-[11px] font-mono font-medium">
                {wsConnected ? 'Live Websocket Sync' : 'Reconnecting Sync...'}
              </span>
            )}
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {(!collapsed || isMobileOpen) && (
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2 font-mono">
              Infrastructure Scopes
            </div>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                title={collapsed && !isMobileOpen ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? isDark
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold'
                    : isDark
                      ? 'hover:bg-slate-700/50 text-slate-400 hover:text-slate-200'
                      : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : 'text-slate-400'}`} />
                {(!collapsed || isMobileOpen) && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}
                {(!collapsed || isMobileOpen) && item.badge !== null && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-medium ${
                    isActive
                      ? isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-800'
                      : isDark ? 'bg-slate-800 text-slate-400 border border-slate-700/40' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Profile Bento Card (when expanded or on mobile) */}
        {(!collapsed || isMobileOpen) ? (
          <div className="p-3 border-t border-inherit shrink-0">
            <button
              id="sidebar-user-profile-button"
              onClick={() => handleNavClick('profile')}
              title="Click to view & edit user profile"
              className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 group ${
                activeTab === 'profile'
                  ? isDark
                    ? 'bg-indigo-500/20 border-indigo-500/50 shadow-md'
                    : 'bg-indigo-50 border-indigo-300 shadow-sm'
                  : isDark
                    ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/60 hover:border-indigo-500/40'
                    : 'bg-slate-100 hover:bg-slate-200/80 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                {getInitials(currentUser.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-indigo-400 transition-colors">
                  {currentUser.email}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                  <span>{currentUser.role || 'Network Architect'}</span>
                  <span className="text-[9px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    • Edit
                  </span>
                </p>
              </div>
              <Settings className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 group-hover:rotate-45 transition-all shrink-0" />
            </button>
          </div>
        ) : (
          /* Collapsed state avatar button */
          <div className="p-2 border-t border-inherit flex justify-center shrink-0">
            <button
              id="sidebar-user-profile-collapsed-btn"
              onClick={() => handleNavClick('profile')}
              title={`Logged in as ${currentUser.email} (${currentUser.name}) - Click to edit profile`}
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-md hover:ring-2 hover:ring-indigo-400 transition-all active:scale-95"
            >
              {getInitials(currentUser.name)}
            </button>
          </div>
        )}

        {/* Footer Controls: Theme & Collapse */}
        <div className="p-3 border-t border-inherit flex items-center justify-between gap-2 shrink-0">
          <button
            id="btn-toggle-theme"
            onClick={toggleTheme}
            className={`flex items-center justify-center p-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              isDark ? 'bg-slate-800 text-amber-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
            }`}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {(!collapsed || isMobileOpen) && (
              <span className="ml-2 text-xs text-inherit">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            )}
          </button>

          <button
            id="btn-toggle-sidebar"
            onClick={() => setCollapsed(!collapsed)}
            className={`hidden md:block p-2 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
              isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? '→' : '← Collapse'}
          </button>
        </div>
      </aside>
    </>
  );
};
