import React from 'react';
import { useIPAM } from '../context/IPAMContext';
import { BeyondIPLogo } from './BeyondIPLogo';
import { Building2, Calculator, ShieldCheck, ChevronsLeft, ChevronsRight, Hash, Layers, LayoutDashboard, Moon, Network, Sun, X } from 'lucide-react';
import { muted } from './ui';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const initials = (n: string) => {
  const parts = (n || 'User').trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
};

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed, isMobileOpen = false, onMobileClose }) => {
  const { activeTab, setActiveTab, datacenters, vlans, subnets, ips, currentUser, wsConnected, isDark, toggleTheme, isAdmin } = useIPAM();

  const navItems = [
    { id: 'dashboard' as const, label: 'Overview', icon: LayoutDashboard, count: null },
    { id: 'datacenters' as const, label: 'Datacenters', icon: Building2, count: datacenters.length },
    { id: 'vlans' as const, label: 'VLANs', icon: Layers, count: vlans.length },
    { id: 'subnets' as const, label: 'Subnets', icon: Network, count: subnets.length },
    { id: 'ips' as const, label: 'IP addresses', icon: Hash, count: ips.length },
    { id: 'tools' as const, label: 'Tools', icon: Calculator, count: null },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin', icon: ShieldCheck, count: null }] : []),
  ];

  const expanded = !collapsed || isMobileOpen;

  const go = (tab: (typeof navItems)[number]['id'] | 'profile') => {
    setActiveTab(tab);
    onMobileClose?.();
  };

  return (
    <>
      {isMobileOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={onMobileClose} aria-hidden="true" />}

      <aside
        id="ipam-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-zinc-200 bg-white transition-all duration-300 md:relative dark:border-zinc-800/80 dark:bg-black ${
          isMobileOpen ? 'w-72 translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'md:w-[4.5rem]' : 'md:w-60'}`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <BeyondIPLogo size="md" variant={expanded ? 'full' : 'icon'} />
          <button type="button" onClick={onMobileClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 md:hidden dark:hover:bg-zinc-900" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {navItems.map(({ id, label, icon: Icon, count }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                id={`nav-${id}`}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => go(id)}
                title={expanded ? undefined : label}
                className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white'
                }`}
              >
                {isActive && <span className="absolute inset-y-1.5 -left-3 w-0.5 rounded-full bg-cyan-400" aria-hidden />}
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {expanded && <span className="flex-1 truncate text-left">{label}</span>}
                {expanded && count !== null && <span className={`font-mono text-xs ${muted}`}>{count}</span>}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-zinc-100 p-3 dark:border-zinc-800/80">
          <button
            id="sidebar-user-profile-button"
            type="button"
            onClick={() => go('profile')}
            title={expanded ? undefined : currentUser.name}
            aria-current={activeTab === 'profile' ? 'page' : undefined}
            className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition cursor-pointer ${
              activeTab === 'profile' ? 'bg-cyan-500/10' : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-xs font-bold text-zinc-950">
              {initials(currentUser.name)}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-black ${wsConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}
                title={wsConnected ? 'Live updates on' : 'Reconnecting…'}
              />
            </span>
            {expanded && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900 dark:text-white">{currentUser.name}</span>
                <span className={`block truncate text-xs ${muted}`}>{wsConnected ? 'Live updates on' : 'Reconnecting…'}</span>
              </span>
            )}
          </button>

          <div className={`flex gap-1 ${expanded ? 'flex-row' : 'flex-col items-center'}`}>
            <button
              id="btn-toggle-theme"
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Light mode' : 'Dark mode'}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg p-2 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900 cursor-pointer"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {expanded && (isDark ? 'Light' : 'Dark')}
            </button>
            <button
              id="btn-toggle-sidebar"
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand' : 'Collapse'}
              className="hidden rounded-lg p-2 text-zinc-600 transition hover:bg-zinc-100 md:block dark:text-zinc-400 dark:hover:bg-zinc-900 cursor-pointer"
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
