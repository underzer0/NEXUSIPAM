import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { ArrowUpRight, Building2, Eye, Hash, Layers, Network, Plus, Zap } from 'lucide-react';
import { Subnet, IPVersion, IPAddress } from '../types/ipam';
import { getIPVersion } from '../utils/ipCalculator';
import { Bar, card, formatCount, linkButton, muted, percentLabel, percentOf, primaryButton, secondaryButton, usableOf } from './ui';

interface DashboardViewProps {
  onOpenSubnetVisualizer: (subnet: Subnet) => void;
  onOpenNewDatacenterModal: () => void;
  onOpenNewSubnetModal: () => void;
  onOpenReserveNextModal: (subnetId?: string) => void;
  onOpenAuditLogs?: (entityFilter?: string) => void;
}

const ACTION_DOT: Record<string, string> = { CREATE: 'bg-blue-500', RESERVE: 'bg-amber-500', DELETE: 'bg-rose-500', UPDATE: 'bg-emerald-500' };

const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; onClick: () => void; children?: React.ReactNode }> = ({
  icon,
  label,
  value,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`${card} group flex flex-col gap-3 p-5 text-left transition hover:border-indigo-400 hover:shadow-md focus-visible:outline-2 focus-visible:outline-indigo-500 cursor-pointer`}
  >
    <span className={`flex items-center gap-2 text-sm font-medium ${muted}`}>
      {icon}
      {label}
      <ArrowUpRight className="ml-auto h-4 w-4 opacity-0 transition group-hover:opacity-100" />
    </span>
    <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</span>
    {children}
  </button>
);

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenSubnetVisualizer,
  onOpenNewSubnetModal,
  onOpenReserveNextModal,
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
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-500" />
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
    const used = sum(rows, 'used');
    return { dc, subnetCount: rows.length, used, percent: percentOf(used, sum(rows, 'usable')) };
  });

  const dcName = new Map(datacenters.map((d) => [d.id, d.name]));
  const vlanTag = new Map(vlans.map((v) => [v.id, v.vlanId]));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Overview</h1>
          <div role="group" aria-label="IP version" className="flex rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
            {(['IPv4', 'IPv6'] as IPVersion[]).map((ver) => (
              <button
                key={ver}
                type="button"
                aria-pressed={selectedProtocol === ver}
                onClick={() => handleProtocolChange(ver)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition cursor-pointer ${
                  selectedProtocol === ver
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {ver}
                <span className="rounded-full bg-slate-500/15 px-1.5 text-xs font-medium">{versionCount(ver)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onOpenReserveNextModal()}
            className={secondaryButton}
          >
            <Zap className="h-4 w-4" /> Reserve IP
          </button>
          <button
            type="button"
            onClick={onOpenNewSubnetModal}
            className={primaryButton}
          >
            <Plus className="h-4 w-4" /> New subnet
          </button>
        </div>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<Network className="h-4 w-4 text-indigo-500" />} label="Subnets" value={protocolSubnets.length} onClick={() => goTo('subnets')}>
          <div className="flex h-2 overflow-hidden rounded-full bg-purple-500/80" aria-hidden>
            <div className="bg-indigo-500" style={{ width: `${percentOf(privateCount, protocolSubnets.length)}%` }} />
          </div>
          <span className={`flex gap-4 text-xs ${muted}`}>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" />{privateCount} private</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple-500" />{protocolSubnets.length - privateCount} public</span>
          </span>
        </StatTile>

        <StatTile icon={<Hash className="h-4 w-4 text-blue-500" />} label="IPs in use" value={totalActive + totalReserved} onClick={() => goTo('ips')}>
          <span className={`flex gap-4 text-xs ${muted}`}>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />{totalActive} active</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />{totalReserved} reserved</span>
          </span>
        </StatTile>

        <StatTile icon={<Layers className="h-4 w-4 text-emerald-500" />} label="Usable addresses" value={formatCount(totalUsable)} onClick={() => goTo('subnets')}>
          <span className={`text-xs ${muted}`}>across {protocolSubnets.length} {selectedProtocol} subnets</span>
        </StatTile>

        <StatTile
          icon={<Building2 className="h-4 w-4 text-amber-500" />}
          label="Utilization"
          value={percentLabel(totalPercent)}
          onClick={() => goTo('subnets')}
        >
          <Bar percent={totalPercent} label={`${selectedProtocol} utilization`} />
        </StatTile>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Datacenters */}
        <section className={`${card} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">Datacenters</h2>
            <button type="button" onClick={() => goTo('datacenters')} className={linkButton}>
              Manage
            </button>
          </div>
          {dcRows.length === 0 ? (
            <p className={`py-6 text-center text-sm ${muted}`}>No datacenters yet.</p>
          ) : (
            <ul className="space-y-4">
              {dcRows.map(({ dc, subnetCount, used, percent }) => (
                <li key={dc.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-slate-800 dark:text-slate-100">{dc.name}</span>
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{percentLabel(percent)}</span>
                  </div>
                  <Bar percent={percent} label={`${dc.name} utilization`} />
                  <p className={`text-xs ${muted}`}>{subnetCount} subnets · {used} IPs used</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent activity */}
        <section className={`${card} p-5 lg:col-span-2`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">Recent activity</h2>
            <button type="button" onClick={() => onOpenAuditLogs?.()} className={linkButton}>
              View all
            </button>
          </div>
          {activityLogs.length === 0 ? (
            <p className={`py-6 text-center text-sm ${muted}`}>Nothing has happened yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {activityLogs.slice(0, 6).map((log) => (
                <li key={log.id}>
                  <button
                    type="button"
                    onClick={() => onOpenAuditLogs?.(log.entityType)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${ACTION_DOT[log.action] ?? 'bg-slate-400'}`} aria-hidden />
                    <span className="truncate font-medium text-slate-800 dark:text-slate-100">{log.title}</span>
                    <time className={`ml-auto shrink-0 text-xs tabular-nums ${muted}`} dateTime={log.timestamp}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* The nine fullest subnets; the Subnets page has the rest */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">{selectedProtocol} subnets</h2>
          <button type="button" onClick={() => goTo('subnets')} className={linkButton}>
            See all
          </button>
        </div>
        {subnetRows.length === 0 ? (
          <div className={`${card} flex flex-col items-center gap-3 p-10 text-center`}>
            <Network className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className={`text-sm ${muted}`}>No {selectedProtocol} subnets yet.</p>
            <button type="button" onClick={onOpenNewSubnetModal} className={primaryButton}>
              Create the first one
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {subnetRows.slice(0, 9).map(({ sub, used, usable, percent }) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onOpenSubnetVisualizer(sub)}
                className={`${card} group flex flex-col gap-3 p-5 text-left transition hover:border-indigo-400 hover:shadow-md cursor-pointer`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="break-all font-mono text-base font-bold text-slate-900 dark:text-white">{sub.cidr}</span>
                  <Eye className="h-4 w-4 shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100" aria-label="Open address map" />
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs font-medium">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{dcName.get(sub.datacenterId) ?? 'Unknown site'}</span>
                  {sub.vlanId && vlanTag.has(sub.vlanId) && (
                    <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-purple-700 dark:text-purple-300">VLAN {vlanTag.get(sub.vlanId)}</span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 ${sub.segmentType === 'Public' ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300' : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'}`}>
                    {sub.segmentType}
                  </span>
                </div>
                <Bar percent={percent} label={`${sub.cidr} utilization`} />
                <div className={`flex justify-between text-xs tabular-nums ${muted}`}>
                  <span>{used} / {formatCount(usable)} used</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{percentLabel(percent)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
