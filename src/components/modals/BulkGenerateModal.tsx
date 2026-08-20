import React, { useState, useEffect } from 'react';
import { useIPAM } from '../../context/IPAMContext';
import { X, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { Subnet, IPStatus } from '../../types/ipam';

interface BulkGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  subnet?: Subnet | null;
}

export const BulkGenerateModal: React.FC<BulkGenerateModalProps> = ({
  isOpen,
  onClose,
  subnet,
}) => {
  const { subnets, bulkGenerateIPs, isDark } = useIPAM();
  const [subnetId, setSubnetId] = useState(subnet?.id || subnets[0]?.id || '');
  const [count, setCount] = useState(10);
  const [startingOffset, setStartingOffset] = useState(1);
  const [status, setStatus] = useState<IPStatus>('Available');
  const [devicePattern, setDevicePattern] = useState('k8s-node-{i}.internal');
  const [description, setDescription] = useState('Bulk provisioned IP slot');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (subnet) {
      setSubnetId(subnet.id);
    } else if (subnets[0]) {
      setSubnetId(subnets[0].id);
    }
    setError(null);
    setSuccessMsg(null);
  }, [subnet, isOpen, subnets]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subnetId) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const generated = await bulkGenerateIPs(
        subnetId,
        Number(count),
        Number(startingOffset),
        status,
        description,
        devicePattern
      );
      setSuccessMsg(`Successfully generated ${generated.length} IP host records!`);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to bulk generate IPs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${
        isDark ? 'bg-slate-900 border-slate-700/60 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2 text-white">
            <Database className="w-5 h-5 text-purple-400" />
            Bulk IP Address Generation Tool
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs font-mono">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Subnet Target */}
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Target Subnet Prefix *</label>
            <select
              required
              value={subnetId}
              onChange={(e) => setSubnetId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-mono font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {subnets.map(s => (
                <option key={s.id} value={s.id}>{s.cidr} ({s.segmentType})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Count of IPs *</label>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value, 10))}
                className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-mono font-bold text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Starting Host Offset *</label>
              <input
                type="number"
                min="1"
                max="254"
                required
                value={startingOffset}
                onChange={(e) => setStartingOffset(parseInt(e.target.value, 10))}
                className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-mono font-bold text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Initial Status *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as IPStatus)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="Available">Available (Free Pool)</option>
              <option value="Reserved">Reserved (Pre-staged)</option>
              <option value="Active">Active (Provisioned)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Hostname Pattern (use &#123;i&#125; for index)</label>
            <input
              type="text"
              placeholder="e.g. k8s-worker-{i}.dc1"
              value={devicePattern}
              onChange={(e) => setDevicePattern(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Batch Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-700/50 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-md shadow-purple-500/20 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? 'Generating...' : `Generate ${count} IPs`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
