import React, { useState, useEffect } from 'react';
import { useIPAM } from '../../context/IPAMContext';
import { X, Network, Building2, Layers, Globe, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Subnet, SegmentType } from '../../types/ipam';
import { parseCIDR, isPrivateRFC1918 } from '../../utils/ipCalculator';

interface SubnetModalProps {
  isOpen: boolean;
  onClose: () => void;
  subnetToEdit?: Subnet | null;
  defaultDatacenterId?: string;
}

export const SubnetModal: React.FC<SubnetModalProps> = ({
  isOpen,
  onClose,
  subnetToEdit,
  defaultDatacenterId,
}) => {
  const { datacenters, vlans, createSubnet, updateSubnet, isDark } = useIPAM();
  const [cidr, setCidr] = useState('');
  const [datacenterId, setDatacenterId] = useState(defaultDatacenterId || datacenters[0]?.id || '');
  const [vlanId, setVlanId] = useState<string>('');
  const [segmentType, setSegmentType] = useState<SegmentType>('Private');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Filter VLANs to those strictly in the selected datacenter
  const availableVlans = vlans.filter(v => v.datacenterId === datacenterId);

  useEffect(() => {
    if (subnetToEdit) {
      setCidr(subnetToEdit.cidr);
      setDatacenterId(subnetToEdit.datacenterId);
      setVlanId(subnetToEdit.vlanId || '');
      setSegmentType(subnetToEdit.segmentType);
      setDescription(subnetToEdit.description);
    } else {
      setCidr('10.10.100.0/24');
      setDatacenterId(defaultDatacenterId || datacenters[0]?.id || '');
      setVlanId('');
      setSegmentType('Private');
      setDescription('');
    }
    setError(null);
  }, [subnetToEdit, isOpen, defaultDatacenterId, datacenters]);

  // Auto-detect RFC 1918 when CIDR changes
  useEffect(() => {
    if (cidr.includes('/')) {
      const baseIp = cidr.split('/')[0];
      if (baseIp) {
        const isPriv = isPrivateRFC1918(baseIp);
        setSegmentType(isPriv ? 'Private' : 'Public');
      }
    }
  }, [cidr]);

  if (!isOpen) return null;

  // Real-time calculation preview
  let calcPreview = null;
  try {
    if (cidr.trim()) {
      calcPreview = parseCIDR(cidr.trim());
    }
  } catch {
    calcPreview = null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cidr.trim()) {
      setError('CIDR Prefix is required (e.g. 10.10.10.0/24).');
      return;
    }
    if (!datacenterId) {
      setError('Please select a Datacenter.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (subnetToEdit) {
        await updateSubnet(subnetToEdit.id, {
          cidr: cidr.trim(),
          datacenterId,
          vlanId: vlanId ? vlanId : null,
          segmentType,
          description: description.trim(),
        });
      } else {
        await createSubnet({
          cidr: cidr.trim(),
          datacenterId,
          vlanId: vlanId ? vlanId : null,
          segmentType,
          description: description.trim(),
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save subnet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className={`relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${
        isDark ? 'bg-slate-900 border-slate-700/60 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2 text-white">
            <Network className="w-5 h-5 text-indigo-400" />
            {subnetToEdit ? 'Edit Subnet Allocation' : 'Allocate New Subnet Prefix'}
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

          {/* Datacenter Target */}
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Datacenter Scope *</label>
            <select
              required
              value={datacenterId}
              onChange={(e) => {
                setDatacenterId(e.target.value);
                setVlanId(''); // reset vlan if DC changes
              }}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {datacenters.map(dc => (
                <option key={dc.id} value={dc.id}>{dc.name} ({dc.location})</option>
              ))}
            </select>
          </div>

          {/* CIDR Prefix */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase font-semibold text-slate-400">Subnet CIDR Prefix *</label>
              <span className="text-[10px] text-indigo-400 font-mono">IPv4 (e.g. 10.10.10.0/24)</span>
            </div>
            <input
              type="text"
              required
              placeholder="e.g. 10.10.100.0/24 or 192.168.50.0/26"
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-mono font-bold text-xs text-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Calculation Live Preview */}
          {calcPreview && (
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-mono space-y-1 text-indigo-300">
              <div className="flex justify-between">
                <span>Netmask: {calcPreview.netmask}</span>
                <span>Usable: {calcPreview.usableHosts} IPs</span>
              </div>
              <div className="text-slate-400">
                Range: {calcPreview.firstUsableHost} – {calcPreview.lastUsableHost}
              </div>
            </div>
          )}

          {/* VLAN Binding */}
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Associated VLAN (Optional)</label>
            <select
              value={vlanId}
              onChange={(e) => setVlanId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">None (Un-tagged / Routed L3 Subnet)</option>
              {availableVlans.map(v => (
                <option key={v.id} value={v.id}>VLAN {v.vlanId} - {v.name}</option>
              ))}
            </select>
          </div>

          {/* Segment Type (Public vs Private) */}
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Segment Routing Classification *</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSegmentType('Private')}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-medium transition-all ${
                  segmentType === 'Private'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500/40'
                    : 'bg-slate-950/60 border-slate-700/60 text-slate-400 hover:bg-slate-800/40'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="text-xs">Private (RFC 1918)</span>
              </button>

              <button
                type="button"
                onClick={() => setSegmentType('Public')}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-medium transition-all ${
                  segmentType === 'Public'
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300 ring-1 ring-purple-500/40'
                    : 'bg-slate-950/60 border-slate-700/60 text-slate-400 hover:bg-slate-800/40'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="text-xs">Publicly Routed</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Description / Subnet Purpose</label>
            <textarea
              rows={2}
              placeholder="e.g. Kubernetes worker node pool subnet with DHCP disabled"
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
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? 'Saving...' : subnetToEdit ? 'Save Changes' : 'Allocate Subnet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
