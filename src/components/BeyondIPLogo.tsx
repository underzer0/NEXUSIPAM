import React from 'react';
import { Network } from 'lucide-react';
import { useIPAM } from '../context/IPAMContext';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'badge';
  className?: string;
  isDark?: boolean;
}

export const BeyondIPLogo: React.FC<LogoProps> = ({ 
  size = 'md', 
  variant = 'full',
  className = '',
  isDark: explicitIsDark,
}) => {
  let contextIsDark: boolean | undefined;
  try {
    const context = useIPAM();
    contextIsDark = context?.isDark;
  } catch {
    contextIsDark = undefined;
  }

  const isDark = explicitIsDark !== undefined ? explicitIsDark : contextIsDark;

  const iconSizeClasses = {
    sm: 'w-7 h-7 rounded-lg',
    md: 'w-8 h-8 rounded-xl',
    lg: 'w-10 h-10 rounded-xl',
    xl: 'w-14 h-14 rounded-2xl',
  };

  const innerIconSizes = {
    sm: 'w-4 h-4',
    md: 'w-4.5 h-4.5',
    lg: 'w-5 h-5',
    xl: 'w-7 h-7',
  };

  const textClasses = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  const badgeTextClasses = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-[11px]',
    xl: 'text-xs',
  };

  const iconElement = (
    <div className={`relative flex items-center justify-center bg-gradient-to-tr from-indigo-700 via-indigo-600 to-cyan-500 shadow-md shadow-indigo-500/25 border border-indigo-400/30 shrink-0 overflow-hidden group ${iconSizeClasses[size]} ${className}`}>
      {/* Background network grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff12_1px,transparent_1px),linear-gradient(to_bottom,#ffffff12_1px,transparent_1px)] bg-[size:6px_6px] opacity-60" />
      
      {/* Dynamic network node icon */}
      <Network className={`text-white relative z-10 transition-transform duration-300 group-hover:scale-110 ${innerIconSizes[size]}`} />

      {/* Top-right connection pulse point */}
      <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-80" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400" />
      </span>
    </div>
  );

  if (variant === 'icon') {
    return iconElement;
  }

  const beyondTextColor = isDark === true 
    ? 'text-white' 
    : isDark === false 
    ? 'text-slate-900' 
    : 'text-slate-900 dark:text-white';

  const ipGradient = isDark === false
    ? 'from-indigo-600 via-indigo-500 to-cyan-600'
    : 'from-indigo-400 via-cyan-400 to-teal-300';

  const badgeColor = isDark === true
    ? 'text-slate-400'
    : isDark === false
    ? 'text-slate-600 font-semibold'
    : 'text-slate-600 dark:text-slate-400';

  return (
    <div className="flex items-center gap-3 overflow-hidden select-none">
      {iconElement}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`font-bold tracking-tight truncate ${beyondTextColor} ${textClasses[size]}`}>
            Beyond<span className={`text-transparent bg-clip-text bg-gradient-to-r ${ipGradient} font-extrabold`}>IP</span>
          </span>
        </div>
        <span className={`${badgeColor} font-mono -mt-0.5 tracking-wider uppercase flex items-center gap-1.5 ${badgeTextClasses[size]}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0" />
          Enterprise Edition
        </span>
      </div>
    </div>
  );
};
