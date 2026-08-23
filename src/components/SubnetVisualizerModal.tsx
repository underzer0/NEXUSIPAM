import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { 
  X, 
  Network, 
  Building2, 
  Layers, 
  Hash, 
  CheckCircle2, 
  BookmarkCheck, 
  Zap, 
  Edit, 
  Copy, 
  Check, 
  Info,
  Sparkles
} from 'lucide-react';
import { Subnet, IPAddress, IPStatus } from '../types/ipam';
import { parseCIDR, generateIPRange } from '../utils/ipCalculator';

interface SubnetVisualizerModalProps {
  subnet: Subnet | null;
  onClose: () => void;
}

export const SubnetVisualizerModal: React.FC<SubnetVisualizerModalProps> = ({
  subnet,
  onClose,
}) => {
  const { ips, datacenters, vlans, updateIP, createIP, deleteIP, isDark } = useIPAM();
  const [selectedIP, setSelectedIP] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<IPStatus>('Active');
  const [editDevice, setEditDevice] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!subnet) return null;

  const dc = datacenters.find(d => d.id === subnet.datacenterId);
  const vlan = subnet.vlanId ? vlans.find(v => v.id === subnet.vlanId) : null;
  
  let calc;
  try {
    calc = parseCIDR(subnet.cidr);
  } catch {
    calc = null;
  }

  // Generate range of IPs for visual matrix (first 256 addresses)
  const rangeIps = generateIPRange(subnet.cidr, 256);
  const subnetTrackedIps = ips.filter(i => i.subnetId === subnet.id);
  const ipMap = new Map<string, IPAddress>();
  subnetTrackedIps.forEach(i => ipMap.set(i.ipAddress, i));

  const currentSelectedRecord = selectedIP ? ipMap.get(selectedIP) : null;

  const handleCellClick = (ipStr: string) => {
    setSelectedIP(ipStr);
    const existing = ipMap.get(ipStr);
    if (existing) {
      setEditStatus(existing.status);
      setEditDevice(existing.assignedDevice);
      setEditDesc(existing.description);
    } else {
      setEditStatus('Active');
      setEditDevice('');
      setEditDesc('');
    }
  };

  const handleSave = async () => {
    if (!selectedIP) return;
    setSaving(true);
    try {
      const existing = ipMap.get(selectedIP);
      if (existing) {
        await updateIP(existing.id, {
          status: editStatus,
          assignedDevice: editDevice,
          description: editDesc,
        });
      } else {
        await createIP({
          ipAddress: selectedIP,
          subnetId: subnet.id,
          status: editStatus,
          assignedDevice: editDevice,
          description: editDesc,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update IP');
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async () => {
    if (!currentSelectedRecord) return;
    if (!window.confirm(`Release IP ${currentSelectedRecord.ipAddress}?`)) return;
    try {
      await deleteIP(currentSelectedRecord.id);
      setEditStatus('Available');
      setEditDevice('');
      setEditDesc('');
    } catch (err: any) {
      alert(err.message || 'Failed to release IP');
    }
  };

  const copySelectedIP = () => {
    if (!selectedIP) return;
    navigator.clipboard.writeText(selectedIP);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isV6 = subnet.cidr.includes(':') || subnet.ipVersion === 'IPv6';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className={`relative w-full max-w-5xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
        isDark ? 'bg-slate-900 border-slate-700/60 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-700/50 flex items-start justify-between gap-3 sm:gap-4 shrink-0">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
                <Network className="w-4 sm:w-5 h-4 sm:h-5 text-indigo-400 shrink-0" />
                <span className="truncate">Matrix Visualizer: {subnet.cidr}</span>
              </h2>
              <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase border ${
                isV6 ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              }`}>
                {isV6 ? 'IPv6 128-bit' : 'IPv4 32-bit'}
              </span>
              <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase border ${
                subnet.segmentType === 'Public' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-slate-700/40 text-slate-300 border-slate-600/30'
              }`}>
                {subnet.segmentType}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 flex flex-wrap items-center gap-x-2 font-mono">
              <span>{dc?.name || 'Datacenter'}</span>
              {vlan && <span>• VLAN {vlan.vlanId} ({vlan.name})</span>}
              {calc && <span>• {calc.usableHostsFormatted || calc.usableHosts.toLocaleString()} capacity</span>}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legend */}
        <div className="px-3.5 sm:px-6 py-2 border-b border-slate-700/50 flex items-center justify-between text-[11px] sm:text-xs bg-slate-950/40 font-mono shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-indigo-500"></div>
              <span className="text-slate-300">Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-amber-500"></div>
              <span className="text-slate-300">Reserved</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-emerald-500/30 border border-emerald-500/60"></div>
              <span className="text-slate-300">Available</span>
            </div>
          </div>

          <span className="hidden sm:inline text-[11px] text-slate-400">
            Click any cell to inspect or assign
          </span>
        </div>

        {/* Body: Grid on Left, Inspector on Right */}
        <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-5">
          {/* IP Matrix Grid */}
          <div className="lg:col-span-2 space-y-3">
            <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 gap-1.5 p-3 rounded-xl border border-slate-700/50 bg-slate-950/40 max-h-[55vh] overflow-y-auto">
              {rangeIps.map((ipStr) => {
                const record = ipMap.get(ipStr);
                const isSelected = selectedIP === ipStr;
                const status = record ? record.status : 'Available';

                let bgClass = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20';
                if (status === 'Active') {
                  bgClass = 'bg-indigo-600 text-white font-bold shadow-sm hover:bg-indigo-500 border-indigo-400/50';
                } else if (status === 'Reserved') {
                  bgClass = 'bg-amber-500 text-black font-bold shadow-sm hover:bg-amber-400 border-amber-400/50';
                }

                const cellLabel = isV6
                  ? (ipStr.endsWith('::') ? '::0' : `:${ipStr.split(':').filter(Boolean).pop() || '0'}`)
                  : `.${ipStr.split('.')[3]}`;

                return (
                  <button
                    key={ipStr}
                    onClick={() => handleCellClick(ipStr)}
                    className={`h-9 rounded-lg border font-mono text-[10px] sm:text-[11px] flex flex-col items-center justify-center transition-all ${bgClass} ${
                      isSelected ? 'ring-2 ring-white scale-105 z-10' : ''
                    }`}
                    title={`${ipStr} - ${status}${record?.assignedDevice ? ` (${record.assignedDevice})` : ''}`}
                  >
                    <span className="truncate px-0.5">{cellLabel}</span>
                  </button>
                );
              })}
            </div>
            {rangeIps.length === 256 && (
              <p className="text-[11px] text-slate-400 font-mono italic">
                * Matrix displays the first 256 consecutive address candidates in this allocation.
              </p>
            )}
          </div>

          {/* Quick Inspector & Editor Drawer */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-200'
          }`}>
            {selectedIP ? (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
                  <div className="overflow-hidden mr-2">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block font-mono">Inspected Host</span>
                    <span className="font-mono font-bold text-xs sm:text-sm text-indigo-400 break-all">{selectedIP}</span>
                  </div>
                  <button
                    onClick={copySelectedIP}
                    className="p-1.5 rounded hover:bg-slate-700 text-slate-300 shrink-0"
                    title="Copy IP"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="space-y-2.5 text-xs font-mono">
                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as IPStatus)}
                      className="w-full px-2.5 py-1.5 rounded-lg border dark:bg-slate-900 dark:border-slate-700 text-slate-200 text-xs"
                    >
                      <option value="Active">Active (Assigned)</option>
                      <option value="Reserved">Reserved (Holding)</option>
                      <option value="Available">Available (Free Pool)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Assigned Device / Hostname</label>
                    <input
                      type="text"
                      placeholder="e.g. k8s-worker-01.dc1"
                      value={editDevice}
                      onChange={(e) => setEditDevice(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border font-mono dark:bg-slate-900 dark:border-slate-700 text-slate-200 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Description / Note</label>
                    <textarea
                      rows={2}
                      placeholder="Purpose or maintenance notes"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border dark:bg-slate-900 dark:border-slate-700 text-slate-200 text-xs resize-none"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-700/50 flex items-center justify-between gap-2">
                  {currentSelectedRecord && (
                    <button
                      onClick={handleRelease}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      Release Record
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="ml-auto px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all active:scale-95"
                  >
                    {saving ? 'Saving...' : 'Apply Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-6 space-y-2 font-mono">
                <Info className="w-8 h-8 text-slate-500" />
                <span className="font-semibold text-xs text-slate-300">Select an IP Cell</span>
                <p className="text-[11px] text-slate-400">
                  Click any address cell in the matrix grid to inspect allocation details, assign hostnames, or toggle reservation status.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
