import React, { useEffect, useState } from 'react';
import { useIPAM } from '../../context/IPAMContext';
import { ActivityLog } from '../../types/ipam';
import { Download, Search } from 'lucide-react';
import { Modal, chip, chipNeutral, input, linkButton, muted, secondaryButton } from '../ui';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEntityFilter?: string;
}

const ACTIONS = ['ALL', 'CREATE', 'UPDATE', 'DELETE', 'RESERVE'] as const;
const ENTITIES = ['ALL', 'Datacenter', 'VLAN', 'Subnet', 'IP', 'User'] as const;
const ACTION_STYLE: Record<string, string> = {
  CREATE: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  UPDATE: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  DELETE: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  RESERVE: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
};
const TAB_FOR: Record<string, 'ips' | 'subnets' | 'vlans' | 'datacenters'> = { IP: 'ips', Subnet: 'subnets', VLAN: 'vlans', Datacenter: 'datacenters' };

const relativeTime = (iso: string) => {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
};

const download = (filename: string, type: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

// Quote every cell, and neutralize leading = + - @ so spreadsheets don't run user text as formulas.
const csvCell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose, initialEntityFilter }) => {
  const { activityLogs, setActiveTab, setFilters } = useIPAM();

  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<(typeof ACTIONS)[number]>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');

  useEffect(() => {
    setEntityFilter(initialEntityFilter || 'ALL');
  }, [initialEntityFilter, isOpen]);

  if (!isOpen) return null;

  const q = searchQuery.trim().toLowerCase();
  const filteredLogs = activityLogs.filter(
    (log) =>
      (actionFilter === 'ALL' || log.action === actionFilter) &&
      (entityFilter === 'ALL' || log.entityType === entityFilter) &&
      (!q || [log.title, log.detail, log.entityId, log.entityType, log.action].some((f) => f.toLowerCase().includes(q))),
  );

  const openEntity = (log: ActivityLog) => {
    const tab = TAB_FOR[log.entityType];
    if (!tab) return;
    const match =
      log.entityType === 'IP'
        ? `${log.title} ${log.detail}`.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)
        : log.entityType === 'Subnet'
          ? `${log.title} ${log.detail}`.match(/\b(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}\b/)
          : null;
    if (match) setFilters((prev) => ({ ...prev, search: match[0] }));
    setActiveTab(tab);
    onClose();
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const exportCSV = () =>
    download(
      `beyondip-audit-${stamp}.csv`,
      'text/csv;charset=utf-8',
      [
        'Timestamp,Action,EntityType,EntityID,Title,Detail',
        ...filteredLogs.map((l) => [l.timestamp, l.action, l.entityType, l.entityId, l.title, l.detail].map(csvCell).join(',')),
      ].join('\n'),
    );
  const exportJSON = () => download(`beyondip-audit-${stamp}.json`, 'application/json', JSON.stringify(filteredLogs, null, 2));

  const pill = (active: boolean) =>
    `rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
      active ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
    }`;

  return (
    <Modal title="Activity" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search activity</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="search" placeholder="Search activity" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`${input} w-full pl-9`} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={exportCSV} disabled={!filteredLogs.length} className={`${secondaryButton} px-3 disabled:opacity-50`}>
              <Download className="h-4 w-4" /> CSV
            </button>
            <button type="button" onClick={exportJSON} disabled={!filteredLogs.length} className={`${secondaryButton} px-3 disabled:opacity-50`}>
              <Download className="h-4 w-4" /> JSON
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div role="group" aria-label="Action" className="flex flex-wrap rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
            {ACTIONS.map((a) => (
              <button key={a} type="button" aria-pressed={actionFilter === a} onClick={() => setActionFilter(a)} className={pill(actionFilter === a)}>
                {a === 'ALL' ? 'All actions' : a.charAt(0) + a.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Type" className="flex flex-wrap rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
            {ENTITIES.map((t) => (
              <button key={t} type="button" aria-pressed={entityFilter === t} onClick={() => setEntityFilter(t)} className={pill(entityFilter === t)}>
                {t === 'ALL' ? 'All types' : t}
              </button>
            ))}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <p className={`py-12 text-center text-sm ${muted}`}>{activityLogs.length === 0 ? 'Nothing has happened yet.' : 'No activity matches these filters.'}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredLogs.map((log) => (
              <li key={log.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex shrink-0 items-center gap-1.5 sm:w-44">
                  <span className={`${chip} ${ACTION_STYLE[log.action] ?? chipNeutral}`}>{log.action.charAt(0) + log.action.slice(1).toLowerCase()}</span>
                  <span className={chipNeutral}>{log.entityType}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 dark:text-white">{log.title}</p>
                  {log.detail && <p className={`text-sm ${muted}`}>{log.detail}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs sm:flex-col sm:items-end sm:gap-1">
                  <time dateTime={log.timestamp} title={new Date(log.timestamp).toLocaleString()} className={`tabular-nums ${muted}`}>
                    {relativeTime(log.timestamp)}
                  </time>
                  {TAB_FOR[log.entityType] && (
                    <button type="button" onClick={() => openEntity(log)} className={`${linkButton} text-xs`}>
                      Open
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className={`text-xs ${muted}`}>
          {filteredLogs.length} of {activityLogs.length} events
        </p>
      </div>
    </Modal>
  );
};
