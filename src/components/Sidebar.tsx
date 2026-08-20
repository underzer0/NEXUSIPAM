import React from 'react';
import { useIPAM } from '../context/IPAMContext';
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
  Activity
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const { 
    activeTab, 
    setActiveTab, 
    datacenters, 
    vlans, 
    subnets, 
    ips, 
    stats,
    wsConnected, 
    isDark, 
    toggleTheme 
  } = useIPAM();

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
  ];

  return (
    <aside 
      id="ipam-sidebar"
      className={`relative flex flex-col border-r transition-all duration-300 z-20 shrink-0 ${
        collapsed ? 'w-20' : 'w-64'
      } ${
        isDark 
          ? 'bg-[#1E293B] border-slate-700/50 text-slate-300' 
          : 'bg-white border-slate-200 text-slate-800'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-inherit shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-500/20 shrink-0">
            IP
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold tracking-tight text-lg truncate text-white dark:text-white">
                Nexus<span className="text-indigo-400">IPAM</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono -mt-1 tracking-wider uppercase">Enterprise Grid</span>
            </div>
          )}
        </div>
      </div>

      {/* Live Sync Status Pill */}
      <div className="px-4 pt-3 shrink-0">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          wsConnected 
            ? isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          <span className="relative flex h-2 w-2">
            {wsConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${wsConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          {!collapsed && (
            <span className="truncate text-[11px] font-mono font-medium">
              {wsConnected ? 'Websocket Connected' : 'Reconnecting Sync...'}
            </span>
          )}
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
            Infrastructure
          </div>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
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
              {!collapsed && (
                <span className="flex-1 text-left truncate">{item.label}</span>
              )}
              {!collapsed && item.badge !== null && (
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

      {/* Bottom Profile Bento Card (when expanded) */}
      {!collapsed && (
        <div className="p-3 border-t border-inherit shrink-0">
          <div className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
            isDark ? 'bg-slate-800/80 border-slate-700/40' : 'bg-slate-100 border-slate-200'
          }`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              NA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white dark:text-white truncate">arch.admin@nexus.io</p>
              <p className="text-[10px] text-slate-400 truncate">Network Architect</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer Controls: Theme & Collapse */}
      <div className="p-3 border-t border-inherit flex items-center justify-between gap-2 shrink-0">
        <button
          id="btn-toggle-theme"
          onClick={toggleTheme}
          className={`flex items-center justify-center p-2 rounded-lg text-sm font-medium transition-colors ${
            isDark ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {!collapsed && (
            <span className="ml-2 text-xs text-inherit">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          )}
        </button>

        <button
          id="btn-toggle-sidebar"
          onClick={() => setCollapsed(!collapsed)}
          className={`p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors text-xs font-mono`}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? '→' : '← Collapse'}
        </button>
      </div>
    </aside>
  );
};
