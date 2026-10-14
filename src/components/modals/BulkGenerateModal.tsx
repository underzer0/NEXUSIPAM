import React, { useState, useEffect } from 'react';
import { useIPAM } from '../../context/IPAMContext';
import { Subnet, IPStatus } from '../../types/ipam';
import { Field, FormActions, FormError, Modal, fieldInput } from '../ui';

interface BulkGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  subnet?: Subnet | null;
}

export const BulkGenerateModal: React.FC<BulkGenerateModalProps> = ({ isOpen, onClose, subnet }) => {
  const { subnets, bulkGenerateIPs } = useIPAM();
  const [subnetId, setSubnetId] = useState('');
  const [count, setCount] = useState('10');
  const [startingOffset, setStartingOffset] = useState('1');
  const [status, setStatus] = useState<IPStatus>('Available');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSubnetId(subnet?.id ?? subnets[0]?.id ?? '');
    setError(null);
  }, [subnet, isOpen, subnets]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(count);
    const offset = Number(startingOffset);
    if (!subnetId) return setError('Pick a subnet.');
    if (!Number.isInteger(n) || n < 1 || n > 100) return setError('Count must be from 1 to 100.');
    if (!Number.isInteger(offset) || offset < 1) return setError('Start must be 1 or more.');

    setLoading(true);
    setError(null);
    try {
      await bulkGenerateIPs(subnetId, { count: n, startingOffset: offset, status });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add IPs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Bulk add IPs" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Subnet">
          <select required value={subnetId} onChange={(e) => setSubnetId(e.target.value)} className={`${fieldInput} font-mono`}>
            {subnets.map((s) => (
              <option key={s.id} value={s.id}>{s.cidr}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="How many">
            <input type="number" min={1} max={100} required value={count} onChange={(e) => setCount(e.target.value)} className={fieldInput} />
          </Field>
          <Field label="Start at host #" hint="1 is the first usable address">
            <input type="number" min={1} required value={startingOffset} onChange={(e) => setStartingOffset(e.target.value)} className={fieldInput} />
          </Field>
        </div>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as IPStatus)} className={fieldInput}>
            <option value="Available">Available</option>
            <option value="Reserved">Reserved</option>
            <option value="Active">Active</option>
          </select>
        </Field>
        <FormActions onCancel={onClose} loading={loading} submitLabel={`Add ${count || 0} IPs`} />
      </form>
    </Modal>
  );
};
