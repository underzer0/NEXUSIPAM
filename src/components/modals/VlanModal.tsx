import React, { useState, useEffect } from 'react';
import { useIPAM } from '../../context/IPAMContext';
import { X, Layers, Building2, Info } from 'lucide-react';
import { VLAN } from '../../types/ipam';

interface VlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  vlanToEdit?: VLAN | null;
  defaultDatacenterId?: string;
}

export const VlanModal: React.FC<VlanModalProps> = ({
  isOpen,
  onClose,
  vlanToEdit,
  defaultDatacenterId,
}) => {
  const { datacenters, vlans, createVlan, updateVlan, isDark } = useIPAM();
  const [vlanId, setVlanId] = useState<number>(100);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [datacenterId, setDatacenterId] = useState(defaultDatacenterId || datacenters[0]?.id || '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (vlanToEdit) {
      setVlanId(vlanToEdit.vlanId);
      setName(vlanToEdit.name);
      setDescription(vlanToEdit.description);
      setDatacenterId(vlanToEdit.datacenterId);
    } else {
      setVlanId(100);
      setName('');
      setDescription('');
      setDatacenterId(defaultDatacenterId || datacenters[0]?.id || '');
    }
    setError(null);
  }, [vlanToEdit, isOpen, defaultDatacenterId, datacenters]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('VLAN Name is required.');
      return;
    }
    if (vlanId < 1 || vlanId > 4094) {
      setError('VLAN ID must be a valid 802.1Q tag between 1 and 4094.');
      return;
    }
    if (!datacenterId) {
      setError('Please select a Datacenter for this VLAN.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (vlanToEdit) {
        await updateVlan(vlanToEdit.id, {
          vlanId: Number(vlanId),
          name: name.trim(),
          description: description.trim(),
          datacenterId,
        });
      } else {
        await createVlan({
          vlanId: Number(vlanId),
          name: name.trim(),
          description: description.trim(),
          datacenterId,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save VLAN.');
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
            <Layers className="w-5 h-5 text-purple-400" />
            {vlanToEdit ? 'Edit VLAN Scope' : 'Create Virtual LAN (VLAN)'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs font-mono">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              {error}
            </div>
          )}

          {/* Datacenter Target */}
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Datacenter Location *</label>
            <select
              required
              value={datacenterId}
              onChange={(e) => setDatacenterId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {datacenters.map(dc => (
                <option key={dc.id} value={dc.id}>{dc.name} ({dc.location})</option>
              ))}
            </select>
          </div>

          {/* VLAN Tag ID */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] uppercase font-semibold text-slate-400">VLAN ID (Tag 1–4094) *</label>
              <span className="text-[10px] text-purple-400 font-mono font-bold">802.1Q VID</span>
            </div>
            <input
              type="number"
              min="1"
              max="4094"
              required
              value={vlanId}
              onChange={(e) => setVlanId(parseInt(e.target.value, 10))}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-mono font-bold text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">VLAN Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. DMZ-Edge-Traffic, App-Tier, DB-Cluster"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Optional layer-2 routing or security segment notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              VLAN IDs are unique per Datacenter. You can reuse ID {vlanId} in other Datacenters without conflict.
            </span>
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
              {loading ? 'Saving...' : vlanToEdit ? 'Save Changes' : 'Create VLAN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
