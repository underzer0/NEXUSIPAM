import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { Check, Copy, MousePointerClick } from 'lucide-react';
import { Subnet, IPAddress, IPStatus } from '../types/ipam';
import { parseCIDR, generateIPRange } from '../utils/ipCalculator';
import { Field, FormError, Modal, chip, chipNeutral, fieldInput, iconButton, muted, primaryButton } from './ui';

interface SubnetVisualizerModalProps {
  subnet: Subnet | null;
  onClose: () => void;
}

const CELL: Record<IPStatus, string> = {
  Active: 'bg-blue-500 text-white hover:bg-blue-400',
  Reserved: 'bg-amber-400 text-amber-950 hover:bg-amber-300',
  Available: 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300',
};
const STATUSES: IPStatus[] = ['Active', 'Reserved', 'Available'];
const MAX_CELLS = 256;

export const SubnetVisualizerModal: React.FC<SubnetVisualizerModalProps> = ({ subnet, onClose }) => {
  const { ips, datacenters, vlans, updateIP, createIP, deleteIP } = useIPAM();
  const [selectedIP, setSelectedIP] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<IPStatus>('Active');
  const [editDevice, setEditDevice] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!subnet) return null;

  const dcName = datacenters.find((d) => d.id === subnet.datacenterId)?.name;
  const vlan = subnet.vlanId ? vlans.find((v) => v.id === subnet.vlanId) : null;
  let usable = '';
  try {
    const c = parseCIDR(subnet.cidr);
    usable = c.usableHostsFormatted ?? c.usableHosts.toLocaleString();
  } catch {}

  const rangeIps = generateIPRange(subnet.cidr, MAX_CELLS);
  const ipMap = new Map<string, IPAddress>();
  for (const i of ips) if (i.subnetId === subnet.id) ipMap.set(i.ipAddress, i);
  const selectedRecord = selectedIP ? ipMap.get(selectedIP) : undefined;
  const isV6 = subnet.cidr.includes(':');

  const select = (ipStr: string) => {
    const existing = ipMap.get(ipStr);
    setSelectedIP(ipStr);
    setEditStatus(existing?.status ?? 'Active');
    setEditDevice(existing?.assignedDevice ?? '');
    setEditDesc(existing?.description ?? '');
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIP) return;
    setSaving(true);
    setError(null);
    try {
      const data = { status: editStatus, assignedDevice: editDevice.trim(), description: editDesc.trim() };
      if (selectedRecord) await updateIP(selectedRecord.id, data);
      else await createIP({ ...data, ipAddress: selectedIP, subnetId: subnet.id });
    } catch (err: any) {
      setError(err.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async () => {
    if (!selectedRecord || !window.confirm(`Release ${selectedRecord.ipAddress}?`)) return;
    try {
      await deleteIP(selectedRecord.id);
      select(selectedRecord.ipAddress);
    } catch (err: any) {
      setError(err.message || 'Failed to release.');
    }
  };

  const copy = () => {
    if (!selectedIP) return;
    navigator.clipboard.writeText(selectedIP);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const counts = STATUSES.map((s) => [s, [...ipMap.values()].filter((i) => i.status === s).length] as const);

  return (
    <Modal title={subnet.cidr} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={chipNeutral}>{isV6 ? 'IPv6' : 'IPv4'}</span>
          <span className={chipNeutral}>{subnet.segmentType}</span>
          {dcName && <span className={chipNeutral}>{dcName}</span>}
          {vlan && <span className={`${chip} bg-purple-500/10 text-purple-700 dark:text-purple-300`}>VLAN {vlan.vlanId}</span>}
          {usable && <span className={`text-xs ${muted}`}>{usable} usable</span>}
        </div>

        <div className={`flex flex-wrap gap-4 text-xs ${muted}`}>
          {counts.map(([s, n]) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded ${CELL[s].split(' ')[0]}`} aria-hidden />
              {s} {s !== 'Available' && <strong className="text-zinc-700 dark:text-zinc-200">{n}</strong>}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_17rem]">
          <div>
            <div className="grid max-h-[50vh] grid-cols-8 gap-1 overflow-y-auto sm:grid-cols-12 md:grid-cols-16">
              {rangeIps.map((ipStr) => {
                const record = ipMap.get(ipStr);
                const status = record?.status ?? 'Available';
                const label = isV6 ? (ipStr.endsWith('::') ? '::0' : `:${ipStr.split(':').filter(Boolean).pop() || '0'}`) : `.${ipStr.split('.')[3]}`;
                return (
                  <button
                    key={ipStr}
                    type="button"
                    onClick={() => select(ipStr)}
                    aria-pressed={selectedIP === ipStr}
                    aria-label={`${ipStr}, ${status}${record?.assignedDevice ? `, ${record.assignedDevice}` : ''}`}
                    title={`${ipStr} · ${status}${record?.assignedDevice ? ` · ${record.assignedDevice}` : ''}`}
                    className={`h-8 truncate rounded-md px-0.5 font-mono text-[10px] font-semibold transition cursor-pointer ${CELL[status]} ${
                      selectedIP === ipStr ? 'ring-2 ring-cyan-500 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900' : ''
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {rangeIps.length === MAX_CELLS && <p className={`mt-2 text-xs ${muted}`}>Showing the first {MAX_CELLS} addresses.</p>}
          </div>

          <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
            {selectedIP ? (
              <form onSubmit={handleSave} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="break-all font-mono text-sm font-bold text-zinc-900 dark:text-white">{selectedIP}</span>
                  <button type="button" onClick={copy} className={`${iconButton} p-1.5`} aria-label="Copy address">
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <FormError message={error} />
                <Field label="Status">
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as IPStatus)} className={fieldInput}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Device">
                  <input value={editDevice} onChange={(e) => setEditDevice(e.target.value)} className={`${fieldInput} font-mono`} />
                </Field>
                <Field label="Note">
                  <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className={fieldInput} />
                </Field>
                <div className="flex items-center gap-2 pt-1">
                  {selectedRecord && (
                    <button type="button" onClick={handleRelease} className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400 cursor-pointer">
                      Release
                    </button>
                  )}
                  <button type="submit" disabled={saving} className={`${primaryButton} ml-auto disabled:opacity-50`}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <div className={`flex h-full flex-col items-center justify-center gap-2 py-8 text-center text-sm ${muted}`}>
                <MousePointerClick className="h-6 w-6" />
                Pick an address to see or change it.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
