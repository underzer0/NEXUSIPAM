import React from 'react';
import { useIPAM } from '../context/IPAMContext';
import { 
  LayoutDashboard, 
  Network, 
  Hash, 
  User, 
  Menu 
} from 'lucide-react';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMenu }) => {
  const { activeTab, setActiveTab, isDark, subnets, ips, currentUser } = useIPAM();

  const primaryItems = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'subnets' as const,
      label: 'Subnets',
      icon: Network,
      badge: subnets.length,
    },
    {
      id: 'ips' as const,
      label: 'IPs',
      icon: Hash,
      badge: ips.length,
    },
    {
      id: 'profile' as const,
      label: 'Profile',
      icon: User,
    },
  ];

  return (
    <div 
      id="mobile-bottom-nav"
      className={`md:hidden fixed bottom-0 left-0 right-0 z-30 border-t backdrop-blur-lg px-2 py-1.5 transition-colors ${
        isDark 
          ? 'bg-[#1E293B]/95 border-slate-700/60 text-slate-300' 
          : 'bg-white/95 border-slate-200 text-slate-700'
      }`}
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-around">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
                isActive
                  ? isDark 
                    ? 'text-indigo-400 font-semibold' 
                    : 'text-indigo-600 font-semibold'
                  : isDark 
                    ? 'text-slate-400 hover:text-slate-200' 
                    : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-indigo-500 text-white text-[9px] font-mono font-bold px-1 rounded-full min-w-3.5 text-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight font-medium">
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-indigo-500 rounded-full" />
              )}
            </button>
          );
        })}

        {/* More button to toggle sidebar */}
        <button
          onClick={onOpenMenu}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            isDark 
              ? 'text-slate-400 hover:text-slate-200' 
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight font-medium">
            Menu
          </span>
        </button>
      </div>
    </div>
  );
};
