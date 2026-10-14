import React, { useState, useEffect } from 'react';
import { useIPAM } from '../../context/IPAMContext';
import { VLAN } from '../../types/ipam';
import { Field, FormActions, FormError, Modal, fieldInput } from '../ui';

interface VlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  vlanToEdit?: VLAN | null;
  defaultDatacenterId?: string;
}

export const VlanModal: React.FC<VlanModalProps> = ({ isOpen, onClose, vlanToEdit, defaultDatacenterId }) => {
  const { datacenters, createVlan, updateVlan } = useIPAM();
  const [vlanId, setVlanId] = useState('100');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [datacenterId, setDatacenterId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setVlanId(String(vlanToEdit?.vlanId ?? 100));
    setName(vlanToEdit?.name ?? '');
    setDescription(vlanToEdit?.description ?? '');
    setDatacenterId(vlanToEdit?.datacenterId ?? defaultDatacenterId ?? datacenters[0]?.id ?? '');
    setError(null);
  }, [vlanToEdit, isOpen, defaultDatacenterId, datacenters]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tag = Number(vlanId);
    if (!name.trim()) return setError('Name is required.');
    if (!Number.isInteger(tag) || tag < 1 || tag > 4094) return setError('VLAN ID must be a whole number from 1 to 4094.');
    if (!datacenterId) return setError('Pick a datacenter.');

    setLoading(true);
    setError(null);
    try {
      const data = { vlanId: tag, name: name.trim(), description: description.trim(), datacenterId };
      if (vlanToEdit) await updateVlan(vlanToEdit.id, data);
      else await createVlan(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save VLAN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={vlanToEdit ? `Edit VLAN ${vlanToEdit.vlanId}` : 'New VLAN'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Datacenter">
          <select required value={datacenterId} onChange={(e) => setDatacenterId(e.target.value)} className={fieldInput}>
            {datacenters.map((dc) => (
              <option key={dc.id} value={dc.id}>{dc.name}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Field label="VLAN ID">
            <input type="number" min={1} max={4094} required value={vlanId} onChange={(e) => setVlanId(e.target.value)} className={`${fieldInput} font-mono`} />
          </Field>
          <Field label="Name">
            <input required autoFocus placeholder="App servers" value={name} onChange={(e) => setName(e.target.value)} className={fieldInput} />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-zinc-500 dark:text-zinc-400">IDs only need to be unique within a datacenter.</p>
        <Field label="Description (optional)">
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={`${fieldInput} resize-none`} />
        </Field>
        <FormActions onCancel={onClose} loading={loading} submitLabel={vlanToEdit ? 'Save' : 'Create VLAN'} />
      </form>
    </Modal>
  );
};
