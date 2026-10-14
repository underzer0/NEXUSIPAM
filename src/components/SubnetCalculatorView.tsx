import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { parseCIDR, isValidIPv4, isValidIPv6 } from '../utils/ipCalculator';
import { IPVersion } from '../types/ipam';
import { card, chip, iconButton, input, muted } from './ui';

const PRESETS: Record<IPVersion, { ip: string; prefix: number }[]> = {
  IPv4: [
    { ip: '192.168.1.0', prefix: 24 },
    { ip: '10.10.0.0', prefix: 20 },
    { ip: '172.16.50.0', prefix: 26 },
    { ip: '10.0.0.0', prefix: 30 },
    { ip: '10.10.10.1', prefix: 32 },
  ],
  IPv6: [
    { ip: 'fd00:10:10::', prefix: 64 },
    { ip: '2001:db8:acad::', prefix: 48 },
    { ip: '2001:db8:cafe::', prefix: 56 },
    { ip: 'fd00:ffff::', prefix: 126 },
    { ip: '::1', prefix: 128 },
  ],
};

export const SubnetCalculatorView: React.FC = () => {
  const [ipInput, setIpInput] = useState('10.10.10.0');
  const [prefix, setPrefix] = useState(24);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const raw = ipInput.trim();
  // The address decides the version; the prefix is clamped when switching from IPv6 to IPv4.
  const version: IPVersion = raw.includes(':') ? 'IPv6' : 'IPv4';
  const maxPrefix = version === 'IPv4' ? 32 : 128;
  const safePrefix = Math.min(prefix, maxPrefix);

  let result: ReturnType<typeof parseCIDR> | null = null;
  let error: string | null = null;
  if (version === 'IPv4' ? isValidIPv4(raw) : isValidIPv6(raw)) {
    try {
      result = parseCIDR(`${raw}/${safePrefix}`);
    } catch (err: any) {
      error = err.message || 'Invalid address';
    }
  } else {
    error = version === 'IPv4' ? 'Enter a valid IPv4 address, like 10.10.10.0' : 'Enter a valid IPv6 address, like 2001:db8::';
  }

  const handleCopy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isV6 = result?.ipVersion === 'IPv6';
  const rows: { label: string; value: string; copy?: boolean }[] = result
    ? [
        { label: 'Network', value: result.cidr, copy: true },
        { label: 'Netmask', value: result.netmask, copy: true },
        ...(!isV6 ? [{ label: 'Wildcard', value: result.wildcard }] : []),
        { label: 'First host', value: result.firstUsableHost, copy: true },
        { label: 'Last host', value: result.lastUsableHost, copy: true },
        { label: isV6 ? 'Last address' : 'Broadcast', value: result.broadcastAddress },
        ...(isV6 && result.expandedAddress ? [{ label: 'Expanded', value: result.expandedAddress }] : []),
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className={`${card} space-y-5 p-5`}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_1.4fr]">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Address</span>
            <input
              type="text"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              placeholder="10.10.10.0 or 2001:db8::"
              spellCheck={false}
              className={`${input} w-full font-mono`}
            />
          </label>
          <label className="space-y-1.5">
            <span className="flex justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Prefix length <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">/{safePrefix}</span>
            </span>
            <input
              type="range"
              min={0}
              max={maxPrefix}
              value={safePrefix}
              onChange={(e) => setPrefix(parseInt(e.target.value, 10))}
              className="w-full cursor-pointer accent-cyan-600"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs ${muted}`}>Try:</span>
          {[...PRESETS.IPv4, ...PRESETS.IPv6].map((p) => (
            <button
              key={`${p.ip}/${p.prefix}`}
              type="button"
              onClick={() => {
                setIpInput(p.ip);
                setPrefix(p.prefix);
              }}
              className={`${chip} bg-zinc-100 font-mono text-zinc-700 transition hover:bg-cyan-500/10 hover:text-cyan-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:text-cyan-300 cursor-pointer`}
            >
              {p.ip}/{p.prefix}
            </button>
          ))}
        </div>
        {error && raw && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </div>

      {result && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
          {/* Summary */}
          <div className={`${card} space-y-5 p-5`}>
            <div>
              <p className={`text-sm ${muted}`}>Usable addresses</p>
              <p className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{result.usableHostsFormatted ?? result.usableHosts.toLocaleString()}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
                <div className="bg-cyan-500" style={{ width: `${(safePrefix / maxPrefix) * 100}%` }} />
                <div className="flex-1 bg-emerald-500" />
              </div>
              <p className={`flex justify-between text-xs ${muted}`}>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-500" />{safePrefix} network bits</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{maxPrefix - safePrefix} host bits</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`${chip} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300`}>{result.ipVersion}</span>
              <span
                className={`${chip} ${result.isPrivate ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' : 'bg-purple-500/10 text-purple-700 dark:text-purple-300'}`}
              >
                {result.isPrivate ? 'Private' : 'Public'}
              </span>
            </div>
          </div>

          {/* Details */}
          <dl className={`${card} divide-y divide-zinc-100 p-2 dark:divide-zinc-800`}>
            {rows.map(({ label, value, copy }) => (
              <div key={label} className="flex items-center gap-4 px-3 py-2.5">
                <dt className={`w-28 shrink-0 text-sm ${muted}`}>{label}</dt>
                <dd className="min-w-0 flex-1 break-all font-mono text-sm font-semibold text-zinc-900 dark:text-white">{value}</dd>
                {copy && (
                  <button type="button" onClick={() => handleCopy(value, label)} className={`${iconButton} p-1.5`} aria-label={`Copy ${label.toLowerCase()}`}>
                    {copiedKey === label ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
};
