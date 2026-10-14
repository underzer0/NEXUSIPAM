import React, { useState, useEffect } from 'react';
import { useIPAM } from '../../context/IPAMContext';
import { Check, CheckCircle2, Copy } from 'lucide-react';
import { IPAddress } from '../../types/ipam';
import { Field, FormActions, FormError, Modal, fieldInput, muted, primaryButton, secondaryButton } from '../ui';

interface ReserveNextIPModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSubnetId?: string;
}

export const ReserveNextIPModal: React.FC<ReserveNextIPModalProps> = ({ isOpen, onClose, defaultSubnetId }) => {
  const { subnets, reserveNextIP, getNextAvailableIP } = useIPAM();
  const [subnetId, setSubnetId] = useState('');
  const [assignedDevice, setAssignedDevice] = useState('');
  const [description, setDescription] = useState('');
  // undefined = still looking, null = subnet is full
  const [previewIP, setPreviewIP] = useState<string | null | undefined>(undefined);
  const [reserved, setReserved] = useState<IPAddress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSubnetId(defaultSubnetId || subnets[0]?.id || '');
    setAssignedDevice('');
    setDescription('');
    setReserved(null);
    setError(null);
  }, [isOpen, defaultSubnetId, subnets]);

  useEffect(() => {
    if (!subnetId || !isOpen) return;
    let live = true;
    setPreviewIP(undefined);
    getNextAvailableIP(subnetId)
      .then((res) => live && setPreviewIP(res?.availableIP ?? null))
      .catch(() => live && setPreviewIP(null));
    return () => {
      live = false;
    };
  }, [subnetId, isOpen, getNextAvailableIP]);

  if (!isOpen) return null;

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setReserved(await reserveNextIP(subnetId, { assignedDevice: assignedDevice.trim(), description: description.trim() }));
    } catch (err: any) {
      setError(err.message || 'Failed to reserve an IP.');
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!reserved) return;
    navigator.clipboard.writeText(reserved.ipAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal title="Reserve next free IP" onClose={onClose}>
      {reserved ? (
        <div className="space-y-5 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <div>
            <p className={`text-sm ${muted}`}>Reserved</p>
            <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white">{reserved.ipAddress}</p>
          </div>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={copy} className={secondaryButton}>
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" onClick={onClose} className={primaryButton}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleReserve} className="space-y-4">
          <FormError message={error} />
          <Field label="Subnet">
            <select required value={subnetId} onChange={(e) => setSubnetId(e.target.value)} className={`${fieldInput} font-mono`}>
              {subnets.map((s) => (
                <option key={s.id} value={s.id}>{s.cidr}</option>
              ))}
            </select>
          </Field>
          <div className="rounded-xl bg-slate-100 p-4 text-center dark:bg-slate-800">
            <p className={`text-xs ${muted}`}>Next free address</p>
            <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">
              {previewIP === undefined ? 'Looking…' : previewIP ?? 'This subnet is full'}
            </p>
          </div>
          <Field label="Device (optional)">
            <input autoFocus placeholder="node-99.internal" value={assignedDevice} onChange={(e) => setAssignedDevice(e.target.value)} className={`${fieldInput} font-mono`} />
          </Field>
          <Field label="Note (optional)">
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={fieldInput} />
          </Field>
          <FormActions onCancel={onClose} loading={loading} disabled={!previewIP} submitLabel="Reserve" />
        </form>
      )}
    </Modal>
  );
};
