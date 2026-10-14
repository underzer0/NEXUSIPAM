import React from 'react';
import { useIPAM } from '../context/IPAMContext';
import { Hash, LayoutDashboard, Menu, Network, User } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

const ITEMS = [
  { id: 'dashboard' as const, label: 'Overview', icon: LayoutDashboard },
  { id: 'subnets' as const, label: 'Subnets', icon: Network },
  { id: 'ips' as const, label: 'IPs', icon: Hash },
  { id: 'profile' as const, label: 'Profile', icon: User },
];

const itemClass = (active: boolean) =>
  `flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition cursor-pointer ${
    active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
  }`;

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMenu }) => {
  const { activeTab, setActiveTab } = useIPAM();

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 px-2 pt-1.5 backdrop-blur-lg md:hidden dark:border-slate-800 dark:bg-slate-900/95"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
    >
      {ITEMS.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)} className={itemClass(activeTab === id)}>
          <Icon className="h-5 w-5" />
          {label}
        </button>
      ))}
      <button type="button" onClick={onOpenMenu} className={itemClass(false)}>
        <Menu className="h-5 w-5" />
        Menu
      </button>
    </nav>
  );
};
