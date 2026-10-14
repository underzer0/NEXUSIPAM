import React, { useEffect, useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { Check, Copy, KeyRound, LogOut, RefreshCw, Save } from 'lucide-react';
import { UserProfile } from '../types/ipam';
import { card, chip, input, muted, primaryButton, secondaryButton } from './ui';

const ROLE_OPTIONS = ['IT Engineer', 'Junior Network Admin', 'Senior Network Admin', 'Expert Network Architect', 'IT Manager', 'Director'];

type Form = Pick<UserProfile, 'name' | 'email' | 'role' | 'department' | 'organization' | 'location' | 'phone' | 'bio' | 'primaryDatacenterId'>;

const formFrom = (u: UserProfile): Form => ({
  name: u.name || '',
  email: u.email || '',
  role: u.role || ROLE_OPTIONS[0],
  department: u.department || '',
  organization: u.organization || '',
  location: u.location || '',
  phone: u.phone || '',
  bio: u.bio || '',
  primaryDatacenterId: u.primaryDatacenterId || '',
});

const initials = (n: string) => {
  const parts = (n || 'User').trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
};

// The full key exists only in this component's state, right after it is made; the server keeps a hash.
const ApiKeyCard: React.FC<{ masked: string }> = ({ masked: initialMasked }) => {
  const [masked, setMasked] = useState(initialMasked);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (masked && !window.confirm('Make a new key? The current one stops working right away.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/user/generate-api-key', { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setNewKey(json.data.apiKey);
      setMasked(json.data.user.apiKey);
    } catch (err: any) {
      setError(err.message || 'Could not create a key.');
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className={`${card} space-y-4 p-6`}>
      <div className="flex flex-wrap items-center gap-3">
        <KeyRound className="h-5 w-5 text-cyan-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-zinc-900 dark:text-white">API key</h2>
          <p className={`text-sm ${muted}`}>Lets scripts call the API as you.</p>
        </div>
        <button id="btn-generate-api-key" type="button" onClick={generate} disabled={busy} className={`${secondaryButton} disabled:opacity-50`}>
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> {masked ? 'Replace key' : 'Create key'}
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {newKey ? (
        <div className="space-y-2 rounded-xl bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Copy it now. It won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm text-zinc-900 dark:bg-zinc-950 dark:text-white">{newKey}</code>
            <button type="button" onClick={copy} className={secondaryButton} aria-label="Copy API key">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ) : (
        masked && <code className={`block font-mono text-sm ${muted}`}>{masked}</code>
      )}

      {masked && (
        <pre className="overflow-x-auto rounded-xl bg-zinc-900 p-4 font-mono text-xs text-zinc-200">
          {`curl -H "Authorization: Bearer ${newKey ?? '<your key>'}" \\\n  ${window.location.origin}/api/subnets`}
        </pre>
      )}
    </section>
  );
};

export const UserProfileView: React.FC = () => {
  const { currentUser, updateCurrentUser, signOut, datacenters } = useIPAM();

  const [form, setForm] = useState<Form>(() => formFrom(currentUser));
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => setForm(formFrom(currentUser)), [currentUser]);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const dirty = JSON.stringify(form) !== JSON.stringify(formFrom(currentUser));
  // Keep roles assigned elsewhere (e.g. at sign-up) selectable instead of silently replacing them.
  const roles = ROLE_OPTIONS.includes(form.role) ? ROLE_OPTIONS : [form.role, ...ROLE_OPTIONS];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSaved(false);
    if (!form.name.trim()) return setErrorMessage('Name is required.');
    if (!form.email.includes('@')) return setErrorMessage('Enter a valid email address.');

    setIsSaving(true);
    try {
      const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, String(v ?? '').trim()])) as Form;
      await updateCurrentUser({ ...trimmed, email: trimmed.email.toLowerCase() });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const field = (label: string, key: keyof Form, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="space-y-1.5">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <input id={`profile-input-${key}`} value={form[key] ?? ''} onChange={set(key)} className={`${input} w-full`} {...props} />
    </label>
  );

  return (
    <div id="user-profile-page" className="mx-auto max-w-4xl space-y-6 p-4 pb-24 sm:p-6 md:p-8 md:pb-12">
      {/* Identity */}
      <div className={`${card} flex flex-col gap-5 p-6 sm:flex-row sm:items-center`}>
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-cyan-600 text-xl font-bold text-white" aria-hidden>
          {initials(currentUser.name)}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{currentUser.name}</h1>
            <span className={`${chip} bg-cyan-500/10 text-cyan-700 dark:text-cyan-300`}>{currentUser.role}</span>
          </div>
          <p className={`truncate text-sm ${muted}`}>
            {currentUser.email}
            {currentUser.organization && ` · ${currentUser.organization}`}
          </p>
        </div>
        <button id="btn-profile-signout" type="button" onClick={() => signOut()} className={`${secondaryButton} hover:border-rose-300 hover:text-rose-600 dark:hover:text-rose-400`}>
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      {/* Details */}
      <form onSubmit={handleSave} className={`${card} space-y-6 p-6`}>
        <h2 className="font-semibold text-zinc-900 dark:text-white">Your details</h2>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {field('Name', 'name', { required: true, autoComplete: 'name' })}
          {field('Email', 'email', { type: 'email', required: true, autoComplete: 'email' })}
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Role</span>
            <select id="profile-select-role" value={form.role} onChange={set('role')} className={`${input} w-full`}>
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          {field('Phone', 'phone', { type: 'tel', autoComplete: 'tel' })}
          {field('Department', 'department')}
          {field('Organization', 'organization', { autoComplete: 'organization' })}
          {field('Location', 'location')}
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Main datacenter</span>
            <select id="profile-select-dc" value={form.primaryDatacenterId} onChange={set('primaryDatacenterId')} className={`${input} w-full`}>
              <option value="">None</option>
              {datacenters.map((dc) => (
                <option key={dc.id} value={dc.id}>{dc.name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">About you</span>
          <textarea id="profile-input-bio" rows={3} value={form.bio} onChange={set('bio')} className={`${input} w-full`} />
        </label>

        {errorMessage && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{errorMessage}</p>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-5 dark:border-zinc-800">
          <span role="status" className="mr-auto text-sm text-emerald-600 dark:text-emerald-400">
            {saved && 'Saved.'}
          </span>
          <button type="button" disabled={!dirty} onClick={() => setForm(formFrom(currentUser))} className={`${secondaryButton} disabled:opacity-40`}>
            Discard
          </button>
          <button id="btn-save-profile" type="submit" disabled={isSaving || !dirty} className={`${primaryButton} disabled:opacity-40`}>
            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      <ApiKeyCard key={currentUser.id} masked={currentUser.apiKey ?? ''} />
    </div>
  );
};
