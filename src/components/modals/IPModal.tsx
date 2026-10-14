import React, { useState, useEffect } from 'react';
import { useIPAM } from '../../context/IPAMContext';
import { IPAddress, IPStatus } from '../../types/ipam';
import { isIPInSubnet, isValidIP } from '../../utils/ipCalculator';
import { Field, FormActions, FormError, Modal, fieldInput } from '../ui';

interface IPModalProps {
  isOpen: boolean;
  onClose: () => void;
  ipToEdit?: IPAddress | null;
  defaultSubnetId?: string;
}

const STATUSES: IPStatus[] = ['Active', 'Reserved', 'Available'];

export const IPModal: React.FC<IPModalProps> = ({ isOpen, onClose, ipToEdit, defaultSubnetId }) => {
  const { subnets, createIP, updateIP } = useIPAM();
  const [subnetId, setSubnetId] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [status, setStatus] = useState<IPStatus>('Active');
  const [assignedDevice, setAssignedDevice] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSubnetId(ipToEdit?.subnetId ?? defaultSubnetId ?? subnets[0]?.id ?? '');
    setIpAddress(ipToEdit?.ipAddress ?? '');
    setStatus(ipToEdit?.status ?? 'Active');
    setAssignedDevice(ipToEdit?.assignedDevice ?? '');
    setDescription(ipToEdit?.description ?? '');
    setError(null);
  }, [ipToEdit, isOpen, defaultSubnetId, subnets]);

  if (!isOpen) return null;

  const selectedSubnet = subnets.find((s) => s.id === subnetId);
  const rawIp = ipAddress.trim();
  const validationMsg =
    rawIp && selectedSubnet
      ? !isValidIP(rawIp)
        ? 'Not a valid IP address.'
        : !isIPInSubnet(rawIp, selectedSubnet.cidr)
          ? `This address isn't inside ${selectedSubnet.cidr}.`
          : null
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawIp || !subnetId) return setError('Pick a subnet and enter an address.');
    if (validationMsg) return setError(validationMsg);

    setLoading(true);
    setError(null);
    try {
      const data = { ipAddress: rawIp, status, assignedDevice: assignedDevice.trim(), description: description.trim() };
      if (ipToEdit) await updateIP(ipToEdit.id, data);
      else await createIP({ ...data, subnetId });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save IP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={ipToEdit ? `Edit ${ipToEdit.ipAddress}` : 'Assign IP'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />
        {!ipToEdit && (
          <>
            <Field label="Subnet">
              <select required value={subnetId} onChange={(e) => setSubnetId(e.target.value)} className={`${fieldInput} font-mono`}>
                {subnets.map((s) => (
                  <option key={s.id} value={s.id}>{s.cidr}</option>
                ))}
              </select>
            </Field>
            <Field label="Address" hint={validationMsg && <span className="text-rose-600 dark:text-rose-400">{validationMsg}</span>}>
              <input
                required
                autoFocus
                spellCheck={false}
                placeholder={selectedSubnet?.cidr.includes(':') ? '2001:db8::10' : '10.10.10.25'}
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className={`${fieldInput} font-mono`}
              />
            </Field>
          </>
        )}

        <div className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</span>
          <div role="radiogroup" aria-label="Status" className="grid grid-cols-3 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={status === s}
                onClick={() => setStatus(s)}
                className={`rounded-lg py-1.5 text-sm font-semibold transition cursor-pointer ${
                  status === s ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <Field label="Device (optional)">
          <input autoFocus={!!ipToEdit} placeholder="web-01.dc1" value={assignedDevice} onChange={(e) => setAssignedDevice(e.target.value)} className={`${fieldInput} font-mono`} />
        </Field>
        <Field label="Description (optional)">
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={`${fieldInput} resize-none`} />
        </Field>
        <FormActions onCancel={onClose} loading={loading} disabled={!!validationMsg} submitLabel={ipToEdit ? 'Save' : 'Assign IP'} />
      </form>
    </Modal>
  );
};
