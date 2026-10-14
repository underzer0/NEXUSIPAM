import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { ArrowUpRight, Building2, Hash, Layers, Network } from 'lucide-react';
import { Subnet, IPVersion, IPAddress } from '../types/ipam';
import { getIPVersion } from '../utils/ipCalculator';
import { Bar, Ring, Segmented, card, formatCount, linkButton, muted, percentLabel, percentOf, primaryButton, usableOf } from './ui';

interface DashboardViewProps {
  onOpenSubnetVisualizer: (subnet: Subnet) => void;
  onOpenNewDatacenterModal: () => void;
  onOpenNewSubnetModal: () => void;
  onOpenAuditLogs?: (entityFilter?: string) => void;
}

const ACTION_DOT: Record<string, string> = { CREATE: 'bg-cyan-400', RESERVE: 'bg-amber-400', DELETE: 'bg-rose-500', UPDATE: 'bg-emerald-400' };

// Heatmap cell color by how full a subnet is; empty subnets stay dark.
const heat = (p: number) =>
  p === 0 ? 'bg-zinc-200 dark:bg-zinc-800' : p < 25 ? 'bg-emerald-400/40' : p < 50 ? 'bg-emerald-400' : p < 80 ? 'bg-amber-400' : 'bg-rose-500';
const HEAT_LEGEND = [
  ['Empty', 0],
  ['<25%', 10],
  ['<50%', 30],
  ['<80%', 60],
  ['80%+', 90],
] as const;

const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; onClick: () => void }> = ({ icon, label, value, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`${card} group flex items-center gap-4 p-4 text-left transition hover:border-cyan-500/60 focus-visible:outline-2 focus-visible:outline-cyan-500 cursor-pointer`}
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">{icon}</span>
    <span className="min-w-0">
      <span className="block font-mono text-2xl font-semibold leading-tight text-zinc-900 dark:text-white">{value}</span>
      <span className={`block text-xs ${muted}`}>{label}</span>
    </span>
    <ArrowUpRight className={`ml-auto h-4 w-4 opacity-0 transition group-hover:opacity-100 ${muted}`} aria-hidden />
  </button>
);

const Legend: React.FC<{ items: [string, string][] }> = ({ items }) => (
  <span className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${muted}`}>
    {items.map(([color, text]) => (
      <span key={text} className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-sm ${color}`} aria-hidden />
        {text}
      </span>
    ))}
  </span>
);

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenSubnetVisualizer,
  onOpenNewSubnetModal,
  onOpenAuditLogs,
}) => {
  const { stats, datacenters, subnets, ips, vlans, activityLogs, setActiveTab, setFilters } = useIPAM();

  const [selectedProtocol, setSelectedProtocol] = useState<IPVersion>(() => {
    try {
      return localStorage.getItem('ipam_dashboard_protocol') === 'IPv6' ? 'IPv6' : 'IPv4';
    } catch {
      return 'IPv4';
    }
  });

  const handleProtocolChange = (ver: IPVersion) => {
    setSelectedProtocol(ver);
    try {
      localStorage.setItem('ipam_dashboard_protocol', ver);
    } catch {}
  };

  if (!stats) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-cyan-500" />
      </div>
    );
  }

  const goTo = (tab: 'subnets' | 'ips' | 'datacenters') => {
    if (tab !== 'datacenters') setFilters((prev) => ({ ...prev, ipVersion: selectedProtocol }));
    setActiveTab(tab);
  };

  const versionCount = (ver: IPVersion) => subnets.filter((s) => (s.ipVersion || getIPVersion(s.cidr)) === ver).length;
  const protocolSubnets = subnets.filter((s) => (s.ipVersion || getIPVersion(s.cidr)) === selectedProtocol);

  const ipsBySubnet = new Map<string, IPAddress[]>();
  for (const ip of ips) {
    const list = ipsBySubnet.get(ip.subnetId);
    if (list) list.push(ip);
    else ipsBySubnet.set(ip.subnetId, [ip]);
  }

  // One pass per subnet; everything below aggregates these rows.
  const subnetRows = protocolSubnets
    .map((sub) => {
      const subIPs = ipsBySubnet.get(sub.id) ?? [];
      const active = subIPs.filter((i) => i.status === 'Active').length;
      const reserved = subIPs.filter((i) => i.status === 'Reserved').length;
      const usable = usableOf(sub.cidr);
      return { sub, active, reserved, used: active + reserved, usable, percent: percentOf(active + reserved, usable) };
    })
    .sort((a, b) => b.percent - a.percent);

  const sum = (rows: typeof subnetRows, key: 'active' | 'reserved' | 'used' | 'usable') => rows.reduce((t, r) => t + r[key], 0);
  const totalActive = sum(subnetRows, 'active');
  const totalReserved = sum(subnetRows, 'reserved');
  const totalUsable = sum(subnetRows, 'usable');
  const totalPercent = percentOf(totalActive + totalReserved, totalUsable);
  const privateCount = protocolSubnets.filter((s) => s.segmentType === 'Private').length;

  const dcRows = datacenters.map((dc) => {
    const rows = subnetRows.filter((r) => r.sub.datacenterId === dc.id);
    return { dc, subnetCount: rows.length, percent: percentOf(sum(rows, 'used'), sum(rows, 'usable')) };
  });


  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Overview</h1>
          <Segmented
            label="IP version"
            options={['IPv4', 'IPv6'] as const}
            value={selectedProtocol}
            onChange={handleProtocolChange}
            render={(ver) => (
              <span className="font-mono">
                {ver} <span className="opacity-70">{versionCount(ver)}</span>
              </span>
            )}
          />
        </div>
      </div>

      {/* Utilization ring + key counts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <button
          type="button"
          onClick={() => goTo('subnets')}
          className={`${card} flex items-center gap-6 p-5 text-left transition hover:border-cyan-500/60 cursor-pointer`}
        >
          <Ring percent={totalPercent} label={`${selectedProtocol} utilization`} size={120}>
            <span className="font-mono text-2xl font-semibold text-zinc-900 dark:text-white">{percentLabel(totalPercent)}</span>
            <span className={`text-[10px] uppercase tracking-wider ${muted}`}>used</span>
          </Ring>
          <div className="min-w-0 space-y-3">
            <div>
              <p className="font-mono text-lg font-semibold text-zinc-900 dark:text-white">{totalActive + totalReserved}</p>
              <p className={`text-xs ${muted}`}>of {formatCount(totalUsable)} addresses</p>
            </div>
            <Legend items={[['bg-cyan-400', `${totalActive} active`], ['bg-amber-400', `${totalReserved} reserved`]]} />
          </div>
        </button>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatTile icon={<Network className="h-5 w-5" />} label={`${selectedProtocol} subnets`} value={protocolSubnets.length} onClick={() => goTo('subnets')} />
          <StatTile icon={<Hash className="h-5 w-5" />} label="IPs in use" value={totalActive + totalReserved} onClick={() => goTo('ips')} />
          <StatTile icon={<Layers className="h-5 w-5" />} label="VLANs" value={vlans.length} onClick={() => setActiveTab('vlans')} />
          <StatTile icon={<Building2 className="h-5 w-5" />} label="Datacenters" value={datacenters.length} onClick={() => goTo('datacenters')} />
          <div className={`${card} col-span-2 flex flex-col justify-center gap-2 p-4 xl:col-span-4`}>
            <div className="flex h-2 overflow-hidden rounded-full bg-purple-500" aria-hidden>
              <div className="bg-cyan-400" style={{ width: `${percentOf(privateCount, protocolSubnets.length)}%` }} />
            </div>
            <Legend items={[['bg-cyan-400', `${privateCount} private`], ['bg-purple-500', `${protocolSubnets.length - privateCount} public`]]} />
          </div>
        </div>
      </div>

      {/* Heatmap: every subnet as one square, fullest first */}
      <section className={`${card} space-y-4 p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Subnet heatmap</h2>
          <Legend items={HEAT_LEGEND.map(([text, p]): [string, string] => [heat(p), text])} />
        </div>
        {subnetRows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Network className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
            <p className={`text-sm ${muted}`}>No {selectedProtocol} subnets yet.</p>
            <button type="button" onClick={onOpenNewSubnetModal} className={primaryButton}>
              Create the first one
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {subnetRows.map(({ sub, percent }) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onOpenSubnetVisualizer(sub)}
                title={`${sub.cidr} · ${percentLabel(percent)}`}
                aria-label={`${sub.cidr}, ${percentLabel(percent)} used`}
                className={`h-7 w-7 rounded transition hover:scale-125 hover:ring-2 hover:ring-cyan-400 cursor-pointer ${heat(percent)}`}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Fullest subnets */}
        <section className={`${card} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Fullest subnets</h2>
            <button type="button" onClick={() => goTo('subnets')} className={linkButton}>
              See all
            </button>
          </div>
          {subnetRows.length === 0 ? (
            <p className={`py-6 text-center text-sm ${muted}`}>None yet.</p>
          ) : (
            <ul className="space-y-1">
              {subnetRows.slice(0, 6).map(({ sub, percent }) => (
                <li key={sub.id}>
                  <button
                    type="button"
                    onClick={() => onOpenSubnetVisualizer(sub)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_5rem_2.5rem] items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer"
                  >
                    <span className="truncate font-mono text-sm text-zinc-800 dark:text-zinc-100">{sub.cidr}</span>
                    <Bar percent={percent} label={`${sub.cidr} utilization`} />
                    <span className="text-right font-mono text-xs text-zinc-600 dark:text-zinc-300">{percentLabel(percent)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Datacenters */}
        <section className={`${card} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Datacenters</h2>
            <button type="button" onClick={() => goTo('datacenters')} className={linkButton}>
              Manage
            </button>
          </div>
          {dcRows.length === 0 ? (
            <p className={`py-6 text-center text-sm ${muted}`}>No datacenters yet.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-4">
              {dcRows.map(({ dc, subnetCount, percent }) => (
                <li key={dc.id} className="flex flex-col items-center gap-2 text-center">
                  <Ring percent={percent} label={`${dc.name} utilization`} size={72} />
                  <span className="w-full truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{dc.name}</span>
                  <span className={`-mt-2 font-mono text-xs ${muted}`}>{subnetCount} subnets</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent activity */}
        <section className={`${card} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Activity</h2>
            <button type="button" onClick={() => onOpenAuditLogs?.()} className={linkButton}>
              View all
            </button>
          </div>
          {activityLogs.length === 0 ? (
            <p className={`py-6 text-center text-sm ${muted}`}>Nothing yet.</p>
          ) : (
            <ul className="space-y-1">
              {activityLogs.slice(0, 6).map((log) => (
                <li key={log.id}>
                  <button
                    type="button"
                    onClick={() => onOpenAuditLogs?.(log.entityType)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${ACTION_DOT[log.action] ?? 'bg-zinc-400'}`} aria-hidden />
                    <span className="truncate text-zinc-800 dark:text-zinc-100">{log.title}</span>
                    <time className={`ml-auto shrink-0 font-mono text-xs ${muted}`} dateTime={log.timestamp}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
