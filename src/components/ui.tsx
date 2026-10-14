import React from 'react';
import { formatCapacityCompact, parseCIDR } from '../utils/ipCalculator';

// Shared look for every screen: one card, one muted text color, one usage bar.
export const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60';
export const muted = 'text-slate-500 dark:text-slate-400';
export const linkButton = 'text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer';
export const primaryButton =
  'flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 cursor-pointer';
export const secondaryButton =
  'flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer';
export const iconButton =
  'rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer';
export const input =
  'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
export const chip = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium';
export const chipNeutral = `${chip} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300`;

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

const BAR_FILL = { rose: 'bg-rose-500', amber: 'bg-amber-500', emerald: 'bg-emerald-500' };
const usageColor = (p: number) => (p > 80 ? 'rose' : p > 50 ? 'amber' : 'emerald');

export const Bar: React.FC<{ percent: number; label: string }> = ({ percent, label }) => (
  <div
    role="progressbar"
    aria-label={label}
    aria-valuenow={Math.round(percent)}
    aria-valuemin={0}
    aria-valuemax={100}
    className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
  >
    <div className={`h-full rounded-full transition-all duration-500 ${BAR_FILL[usageColor(percent)]}`} style={{ width: `${percent}%` }} />
  </div>
);
