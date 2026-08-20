import React, { useState, useEffect } from 'react';
import { useIPAM } from '../../context/IPAMContext';
import { X, BookmarkCheck, Zap, Copy, Check, CheckCircle2, AlertCircle } from 'lucide-react';
import { Subnet } from '../../types/ipam';

interface ReserveNextIPModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSubnetId?: string;
}

export const ReserveNextIPModal: React.FC<ReserveNextIPModalProps> = ({
  isOpen,
  onClose,
  defaultSubnetId,
}) => {
  const { subnets, reserveNextIP, getNextAvailableIP, isDark } = useIPAM();
  const [subnetId, setSubnetId] = useState(defaultSubnetId || subnets[0]?.id || '');
  const [assignedDevice, setAssignedDevice] = useState('');
  const [description, setDescription] = useState('');
  const [previewIP, setPreviewIP] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSubnetId(defaultSubnetId || subnets[0]?.id || '');
    setAssignedDevice('');
    setDescription('');
    setSuccessResult(null);
    setError(null);
  }, [isOpen, defaultSubnetId, subnets]);

  // Load preview IP
  useEffect(() => {
    if (!subnetId || !isOpen) return;
    let isMounted = true;
    getNextAvailableIP(subnetId).then(res => {
      if (isMounted) setPreviewIP(res.nextAvailableIP);
    }).catch(() => {
      if (isMounted) setPreviewIP(null);
    });
    return () => { isMounted = false; };
  }, [subnetId, isOpen]);

  if (!isOpen) return null;

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subnetId) return;

    setLoading(true);
    setError(null);

    try {
      const reserved = await reserveNextIP(subnetId, {
        assignedDevice: assignedDevice.trim() || 'Reserved System Host',
        description: description.trim() || 'Reserved via Quick Reservation Tool',
      });
      setSuccessResult(reserved);
    } catch (err: any) {
      setError(err.message || 'Failed to reserve next IP');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!successResult) return;
    navigator.clipboard.writeText(successResult.ipAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedSubnet = subnets.find(s => s.id === subnetId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden ${
        isDark ? 'bg-slate-900 border-slate-700/60 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2 text-white">
            <BookmarkCheck className="w-5 h-5 text-amber-400" />
            Reserve Next Available IP
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {successResult ? (
          <div className="p-5 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-sm text-white">IP Successfully Reserved!</h3>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                The next unallocated host address in {selectedSubnet?.cidr} has been locked.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-700/50 flex items-center justify-between font-mono">
              <div className="text-left">
                <span className="text-[10px] text-slate-400 uppercase block font-mono">Reserved IP</span>
                <span className="text-base font-bold text-amber-400">{successResult.ipAddress}</span>
              </div>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-all active:scale-95"
            >
              Done & Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleReserve} className="p-5 space-y-3.5 text-xs font-mono">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Subnet Target */}
            <div>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Target Subnet Prefix *</label>
              <select
                required
                value={subnetId}
                onChange={(e) => setSubnetId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-mono font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {subnets.map(s => (
                  <option key={s.id} value={s.id}>{s.cidr} ({s.segmentType})</option>
                ))}
              </select>
            </div>

            {/* Preview Next IP Box */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block font-mono">Next Available IP Candidate</span>
                <span className="font-mono font-bold text-sm text-amber-400">
                  {previewIP || 'Scanning subnet space...'}
                </span>
              </div>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>

            {/* Hostname / Device */}
            <div>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Target Device / Hostname</label>
              <input
                type="text"
                placeholder="e.g. node-staging-99.internal"
                value={assignedDevice}
                onChange={(e) => setAssignedDevice(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Reservation Purpose / Notes</label>
              <textarea
                rows={2}
                placeholder="e.g. Reserved for incoming compute cluster expansion"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                disabled={loading || !previewIP}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-1.5 transition-all active:scale-95"
              >
                <BookmarkCheck className="w-3.5 h-3.5" />
                {loading ? 'Reserving...' : 'Confirm Reservation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
