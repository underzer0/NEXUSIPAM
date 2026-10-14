import React, { useState, useEffect } from 'react';
import { useIPAM } from '../../context/IPAMContext';
import { Subnet, SegmentType } from '../../types/ipam';
import { parseCIDR, isPrivateRFC1918, isValidCIDR } from '../../utils/ipCalculator';
import { Field, FormActions, FormError, Modal, chip, fieldInput, muted } from '../ui';

interface SubnetModalProps {
  isOpen: boolean;
  onClose: () => void;
  subnetToEdit?: Subnet | null;
  defaultDatacenterId?: string;
}

const PRESETS = ['10.10.100.0/24', '172.16.50.0/26', 'fd00:10:10::/64', '2001:db8:1000::/64'];

export const SubnetModal: React.FC<SubnetModalProps> = ({ isOpen, onClose, subnetToEdit, defaultDatacenterId }) => {
  const { datacenters, vlans, createSubnet, updateSubnet } = useIPAM();
  const [cidr, setCidr] = useState('');
  const [datacenterId, setDatacenterId] = useState('');
  const [vlanId, setVlanId] = useState('');
  const [segmentType, setSegmentType] = useState<SegmentType>('Private');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCidr(subnetToEdit?.cidr ?? '10.10.100.0/24');
    setDatacenterId(subnetToEdit?.datacenterId ?? defaultDatacenterId ?? datacenters[0]?.id ?? '');
    setVlanId(subnetToEdit?.vlanId ?? '');
    setSegmentType(subnetToEdit?.segmentType ?? 'Private');
    setDescription(subnetToEdit?.description ?? '');
    setError(null);
  }, [subnetToEdit, isOpen, defaultDatacenterId, datacenters]);

  if (!isOpen) return null;

  // Guess Private/Public only while the user types, so editing never overrides a saved choice.
  const changeCidr = (value: string) => {
    setCidr(value);
    const base = value.split('/')[0];
    if (value.includes('/') && base) setSegmentType(isPrivateRFC1918(base) ? 'Private' : 'Public');
  };

  const trimmed = cidr.trim();
  let preview: ReturnType<typeof parseCIDR> | null = null;
  try {
    if (isValidCIDR(trimmed)) preview = parseCIDR(trimmed);
  } catch {}

  const availableVlans = vlans.filter((v) => v.datacenterId === datacenterId).sort((a, b) => a.vlanId - b.vlanId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCIDR(trimmed)) return setError('Enter a valid CIDR, like 10.10.10.0/24 or 2001:db8::/64.');
    if (!datacenterId) return setError('Pick a datacenter.');

    setLoading(true);
    setError(null);
    try {
      const data = { cidr: trimmed, datacenterId, vlanId: vlanId || null, segmentType, description: description.trim() };
      if (subnetToEdit) await updateSubnet(subnetToEdit.id, data);
      else await createSubnet(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save subnet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={subnetToEdit ? `Edit ${subnetToEdit.cidr}` : 'New subnet'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />
        <Field
          label="CIDR"
          hint={
            preview ? (
              <span className="font-mono">
                {preview.ipVersion} · {preview.usableHostsFormatted ?? preview.usableHosts.toLocaleString()} usable · {preview.firstUsableHost} – {preview.lastUsableHost}
              </span>
            ) : trimmed ? (
              <span className="text-rose-600 dark:text-rose-400">Not a valid CIDR yet</span>
            ) : null
          }
        >
          <input required autoFocus spellCheck={false} value={cidr} onChange={(e) => changeCidr(e.target.value)} className={`${fieldInput} font-mono`} />
        </Field>
        {!subnetToEdit && (
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => changeCidr(p)}
                className={`${chip} bg-zinc-100 font-mono text-zinc-700 hover:bg-cyan-500/10 hover:text-cyan-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:text-cyan-300 cursor-pointer`}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Datacenter">
            <select
              required
              value={datacenterId}
              onChange={(e) => {
                setDatacenterId(e.target.value);
                setVlanId(''); // VLANs belong to one datacenter
              }}
              className={fieldInput}
            >
              {datacenters.map((dc) => (
                <option key={dc.id} value={dc.id}>{dc.name}</option>
              ))}
            </select>
          </Field>
          <Field label="VLAN">
            <select value={vlanId} onChange={(e) => setVlanId(e.target.value)} className={fieldInput}>
              <option value="">None</option>
              {availableVlans.map((v) => (
                <option key={v.id} value={v.id}>{v.vlanId} · {v.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Segment</span>
          <div role="radiogroup" aria-label="Segment" className="grid grid-cols-2 rounded-xl bg-zinc-200/70 p-1 dark:bg-zinc-800">
            {(['Private', 'Public'] as SegmentType[]).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={segmentType === s}
                onClick={() => setSegmentType(s)}
                className={`rounded-lg py-1.5 text-sm font-semibold transition cursor-pointer ${
                  segmentType === s ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white' : `${muted} hover:text-zinc-900 dark:hover:text-white`
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <Field label="Description (optional)">
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={`${fieldInput} resize-none`} />
        </Field>
        <FormActions onCancel={onClose} loading={loading} submitLabel={subnetToEdit ? 'Save' : 'Create subnet'} />
      </form>
    </Modal>
  );
};
