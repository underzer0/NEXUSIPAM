import React, { useState, useEffect } from 'react';
import { useIPAM } from '../../context/IPAMContext';
import { X, Hash, Network, AlertCircle, CheckCircle2 } from 'lucide-react';
import { IPAddress, IPStatus, Subnet } from '../../types/ipam';
import { isIPInSubnet, isValidIPv4 } from '../../utils/ipCalculator';

interface IPModalProps {
  isOpen: boolean;
  onClose: () => void;
  ipToEdit?: IPAddress | null;
  defaultSubnetId?: string;
}

export const IPModal: React.FC<IPModalProps> = ({
  isOpen,
  onClose,
  ipToEdit,
  defaultSubnetId,
}) => {
  const { subnets, createIP, updateIP, isDark } = useIPAM();
  const [subnetId, setSubnetId] = useState(defaultSubnetId || subnets[0]?.id || '');
  const [ipAddress, setIpAddress] = useState('');
  const [status, setStatus] = useState<IPStatus>('Active');
  const [assignedDevice, setAssignedDevice] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedSubnet = subnets.find(s => s.id === subnetId);

  useEffect(() => {
    if (ipToEdit) {
      setSubnetId(ipToEdit.subnetId);
      setIpAddress(ipToEdit.ipAddress);
      setStatus(ipToEdit.status);
      setAssignedDevice(ipToEdit.assignedDevice);
      setDescription(ipToEdit.description);
    } else {
      setSubnetId(defaultSubnetId || subnets[0]?.id || '');
      setIpAddress('');
      setStatus('Active');
      setAssignedDevice('');
      setDescription('');
    }
    setError(null);
  }, [ipToEdit, isOpen, defaultSubnetId, subnets]);

  if (!isOpen) return null;

  // Validation
  let validationMsg = null;
  if (ipAddress.trim() && selectedSubnet) {
    if (!isValidIPv4(ipAddress.trim())) {
      validationMsg = 'Invalid IPv4 address format';
    } else if (!isIPInSubnet(ipAddress.trim(), selectedSubnet.cidr)) {
      validationMsg = `IP does not fall inside subnet CIDR ${selectedSubnet.cidr}`;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipAddress.trim() || !subnetId) {
      setError('Subnet and IP Address are required.');
      return;
    }
    if (validationMsg) {
      setError(validationMsg);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (ipToEdit) {
        await updateIP(ipToEdit.id, {
          status,
          assignedDevice: assignedDevice.trim(),
          description: description.trim(),
        });
      } else {
        await createIP({
          ipAddress: ipAddress.trim(),
          subnetId,
          status,
          assignedDevice: assignedDevice.trim(),
          description: description.trim(),
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save IP assignment.');
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
            <Hash className="w-5 h-5 text-indigo-400" />
            {ipToEdit ? 'Edit IP Assignment' : 'Assign IP Address'}
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

          {/* Subnet Target */}
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Parent Subnet CIDR *</label>
            <select
              required
              disabled={!!ipToEdit}
              value={subnetId}
              onChange={(e) => setSubnetId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-mono font-medium text-slate-200 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {subnets.map(s => (
                <option key={s.id} value={s.id}>{s.cidr} ({s.segmentType})</option>
              ))}
            </select>
          </div>

          {/* IP Address */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase font-semibold text-slate-400">IPv4 Host Address *</label>
              {selectedSubnet && (
                <span className="text-[10px] text-slate-400 font-mono">Inside {selectedSubnet.cidr}</span>
              )}
            </div>
            <input
              type="text"
              required
              disabled={!!ipToEdit}
              placeholder="e.g. 10.10.10.25"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-mono font-bold text-xs text-indigo-400 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {validationMsg && (
              <span className="text-rose-400 text-[11px] mt-1 block">{validationMsg}</span>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Allocation Status *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as IPStatus)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Active">Active (Assigned to Live Host)</option>
              <option value="Reserved">Reserved (Holding / Staging)</option>
              <option value="Available">Available (Unused Pool)</option>
            </select>
          </div>

          {/* Hostname / Device */}
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Assigned Device / Hostname</label>
            <input
              type="text"
              placeholder="e.g. web-app-ingress-01.dc1"
              value={assignedDevice}
              onChange={(e) => setAssignedDevice(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Description / Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Primary TLS termination interface"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              disabled={loading || !!validationMsg}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? 'Saving...' : ipToEdit ? 'Save Changes' : 'Assign IP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
