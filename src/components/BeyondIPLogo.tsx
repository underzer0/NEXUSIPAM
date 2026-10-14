import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md';
  variant?: 'full' | 'icon';
  className?: string;
}

// Four subnet blocks; the top-right one breaks out of the grid ("beyond"). Same shapes as public/favicon.svg.
export const BeyondIPMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 32 32" className={`shrink-0 ${className}`} aria-hidden>
    <rect x="3" y="5" width="11" height="11" rx="2.5" className="fill-cyan-500/55" />
    <rect x="3" y="18" width="11" height="11" rx="2.5" className="fill-cyan-500/30" />
    <rect x="16" y="18" width="11" height="11" rx="2.5" className="fill-cyan-500/55" />
    <rect x="19" y="2" width="11" height="11" rx="2.5" className="fill-cyan-400" />
  </svg>
);

const MARK_SIZE = { sm: 'h-7 w-7', md: 'h-8 w-8' };
const TEXT_SIZE = { sm: 'text-base', md: 'text-lg' };

export const BeyondIPLogo: React.FC<LogoProps> = ({ size = 'md', variant = 'full', className = '' }) => {
  if (variant === 'icon') return <BeyondIPMark className={`${MARK_SIZE[size]} ${className}`} />;
  return (
    <span className={`flex select-none items-center gap-2.5 ${className}`} aria-label="BeyondIP">
      <BeyondIPMark className={MARK_SIZE[size]} />
      <span className={`font-semibold tracking-tight text-zinc-900 dark:text-white ${TEXT_SIZE[size]}`} aria-hidden>
        Beyond<span className="text-cyan-600 dark:text-cyan-400">IP</span>
      </span>
    </span>
  );
};
