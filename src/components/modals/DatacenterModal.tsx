import React, { useState, useEffect } from 'react';
import { useIPAM } from '../../context/IPAMContext';
import { Datacenter } from '../../types/ipam';
import { Field, FormActions, FormError, Modal, fieldInput } from '../ui';

interface DatacenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  datacenterToEdit?: Datacenter | null;
}

export const DatacenterModal: React.FC<DatacenterModalProps> = ({ isOpen, onClose, datacenterToEdit }) => {
  const { createDatacenter, updateDatacenter } = useIPAM();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(datacenterToEdit?.name ?? '');
    setLocation(datacenterToEdit?.location ?? '');
    setDescription(datacenterToEdit?.description ?? '');
    setError(null);
  }, [datacenterToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) return setError('Name and location are required.');

    setLoading(true);
    setError(null);
    try {
      const data = { name: name.trim(), location: location.trim(), description: description.trim() };
      if (datacenterToEdit) await updateDatacenter(datacenterToEdit.id, data);
      else await createDatacenter(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save datacenter.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={datacenterToEdit ? 'Edit datacenter' : 'New datacenter'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Name">
          <input required autoFocus placeholder="US-East-1" value={name} onChange={(e) => setName(e.target.value)} className={fieldInput} />
        </Field>
        <Field label="Location">
          <input required placeholder="Ashburn, VA" value={location} onChange={(e) => setLocation(e.target.value)} className={fieldInput} />
        </Field>
        <Field label="Description (optional)">
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`${fieldInput} resize-none`} />
        </Field>
        <FormActions onCancel={onClose} loading={loading} submitLabel={datacenterToEdit ? 'Save' : 'Create datacenter'} />
      </form>
    </Modal>
  );
};
