import React from 'react';
import { X } from 'lucide-react';
import { formatCapacityCompact, parseCIDR } from '../utils/ipCalculator';

// Shared "control room" look: near-black surfaces, hairline borders, one cyan accent.
export const card = 'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-zinc-900/50';
export const muted = 'text-zinc-500 dark:text-zinc-400';
export const linkButton = 'text-sm font-medium text-cyan-700 hover:underline dark:text-cyan-400 cursor-pointer';
export const primaryButton =
  'flex items-center justify-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-400 cursor-pointer';
export const secondaryButton =
  'flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/70 cursor-pointer';
export const iconButton =
  'rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer';
export const input =
  'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100';
export const chip = 'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium';
export const chipNeutral = `${chip} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300`;

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';

// Doubles keep 3 significant digits even at 2^128, which is all a screen shows.
export const formatCount = (n: number) =>
  n < 1e9 ? formatCapacityCompact(n) : n.toExponential(2).replace(/e\+(\d+)/, (_, e: string) => ` × 10${[...e].map((d) => SUPERSCRIPT[+d]).join('')}`);

export const usableOf = (cidr: string) => {
  try {
    const c = parseCIDR(cidr);
    return c.ipVersion === 'IPv6' ? 2 ** (128 - c.prefix) : c.usableHosts;
  } catch {
    return 0;
  }
};

export const percentOf = (used: number, total: number) => (total > 0 ? Math.min(100, (used / total) * 100) : 0);
export const percentLabel = (p: number) => (p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`);

const BAR_FILL = { rose: 'bg-rose-500', amber: 'bg-amber-400', emerald: 'bg-emerald-400' };
const RING_STROKE = { rose: 'stroke-rose-500', amber: 'stroke-amber-400', emerald: 'stroke-emerald-400' };
export const usageColor = (p: number) => (p > 80 ? 'rose' : p > 50 ? 'amber' : 'emerald');

export const Bar: React.FC<{ percent: number; label: string }> = ({ percent, label }) => (
  <div
    role="progressbar"
    aria-label={label}
    aria-valuenow={Math.round(percent)}
    aria-valuemin={0}
    aria-valuemax={100}
    className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
  >
    <div className={`h-full rounded-full transition-all duration-500 ${BAR_FILL[usageColor(percent)]}`} style={{ width: `${percent}%` }} />
  </div>
);

// Donut gauge: the color says how full, the number says exactly.
export const Ring: React.FC<{ percent: number; label: string; size?: number; children?: React.ReactNode }> = ({ percent, label, size = 96, children }) => {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div role="img" aria-label={`${label}: ${percentLabel(percent)}`} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-zinc-100 dark:stroke-zinc-800" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
          className={`transition-all duration-700 ${RING_STROKE[usageColor(percent)]}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ?? <span className="font-mono text-lg font-semibold text-zinc-900 dark:text-white">{percentLabel(percent)}</span>}
      </div>
    </div>
  );
};

// One dialog frame for every form: Escape and the backdrop close it, the title labels it.
export const Modal: React.FC<{ title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }> = ({ title, onClose, wide, children }) => {
  const titleId = React.useId();
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${card} flex max-h-[90vh] w-full flex-col overflow-hidden shadow-2xl dark:bg-zinc-950 ${wide ? 'max-w-3xl' : 'max-w-md'}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 id={titleId} className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} className={`${iconButton} -mr-2`} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
};

export const Field: React.FC<{ label: string; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block space-y-1.5">
    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
    {children}
    {hint && <span className={`block text-xs ${muted}`}>{hint}</span>}
  </label>
);

export const FormError: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
      {message}
    </p>
  ) : null;

export const FormActions: React.FC<{ onCancel: () => void; submitLabel: string; loading?: boolean; disabled?: boolean }> = ({ onCancel, submitLabel, loading, disabled }) => (
  <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
    <button type="button" onClick={onCancel} className={secondaryButton}>
      Cancel
    </button>
    <button type="submit" disabled={loading || disabled} className={`${primaryButton} disabled:opacity-50`}>
      {loading ? 'Saving…' : submitLabel}
    </button>
  </div>
);

export const fieldInput = `${input} w-full`;
