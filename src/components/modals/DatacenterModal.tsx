import React, { useState, useEffect } from 'react';
import { useIPAM } from '../../context/IPAMContext';
import { X, Building2, MapPin, AlignLeft } from 'lucide-react';
import { Datacenter } from '../../types/ipam';

interface DatacenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  datacenterToEdit?: Datacenter | null;
}

export const DatacenterModal: React.FC<DatacenterModalProps> = ({
  isOpen,
  onClose,
  datacenterToEdit,
}) => {
  const { createDatacenter, updateDatacenter, isDark } = useIPAM();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (datacenterToEdit) {
      setName(datacenterToEdit.name);
      setLocation(datacenterToEdit.location);
      setDescription(datacenterToEdit.description);
    } else {
      setName('');
      setLocation('');
      setDescription('');
    }
    setError(null);
  }, [datacenterToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) {
      setError('Datacenter Name and Location are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (datacenterToEdit) {
        await updateDatacenter(datacenterToEdit.id, {
          name: name.trim(),
          location: location.trim(),
          description: description.trim(),
        });
      } else {
        await createDatacenter({
          name: name.trim(),
          location: location.trim(),
          description: description.trim(),
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save datacenter.');
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
            <Building2 className="w-5 h-5 text-indigo-400" />
            {datacenterToEdit ? 'Edit Datacenter Site' : 'Add New Datacenter Site'}
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

          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Site / Datacenter Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. DC-East or US-East-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Geographic Location *</label>
            <input
              type="text"
              required
              placeholder="e.g. Ashburn, VA, USA"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border dark:bg-slate-950/80 dark:border-slate-700/60 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Description / Infrastructure Scope</label>
            <textarea
              rows={3}
              placeholder="e.g. Primary production tier with redundant 100G edge spine-leaf fabric"
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
              {loading ? 'Saving...' : datacenterToEdit ? 'Save Changes' : 'Create Datacenter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
