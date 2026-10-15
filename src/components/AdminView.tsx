import React, { useCallback, useEffect, useState } from 'react';
import { Check, KeyRound, ShieldCheck, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { useIPAM } from '../context/IPAMContext';
import { UserProfile } from '../types/ipam';
import { Segmented, card, chip, chipNeutral, iconButton, muted, primaryButton, secondaryButton } from './ui';

type Account = Pick<UserProfile, 'id' | 'name' | 'email' | 'role' | 'access' | 'status' | 'datacenterIds' | 'createdAt'>;

const initials = (n: string) => {
  const parts = (n || 'User').trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
};

const api = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Request failed');
  return json.data;
};

// Datacenter chips: click to give or take away edit rights.
const DcPicker: React.FC<{ value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const { datacenters } = useIPAM();
  if (datacenters.length === 0) return <span className={`text-xs ${muted}`}>No datacenters yet</span>;
  return (
    <div role="group" aria-label="Datacenters this user can edit" className="flex flex-wrap gap-1.5">
      {datacenters.map((dc) => {
        const on = value.includes(dc.id);
        return (
          <button
            key={dc.id}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((id) => id !== dc.id) : [...value, dc.id])}
            className={`${chip} border transition cursor-pointer disabled:cursor-default disabled:opacity-50 ${
              on
                ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                : 'border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600'
            }`}
          >
            {on && <Check className="h-3 w-3" aria-hidden />}
            {dc.name}
          </button>
        );
      })}
    </div>
  );
};

export const AdminView: React.FC = () => {
  const { currentUser } = useIPAM();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Datacenters picked for a pending request before it is approved.
  const [grants, setGrants] = useState<Record<string, string[]>>({});

  const load = useCallback(() => {
    api('/api/admin/users').then(setAccounts, (err) => setError(err.message));
  }, []);
  useEffect(load, [load]);

  const update = async (id: string, patch: Partial<Pick<Account, 'access' | 'status' | 'datacenterIds'>>) => {
    setBusyId(id);
    setError(null);
    try {
      const updated: Account = await api(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
      setAccounts((prev) => prev?.map((a) => (a.id === id ? updated : a)) ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (a: Account, verb: string) => {
    if (!window.confirm(`${verb} ${a.name} (${a.email})?`)) return;
    setBusyId(a.id);
    setError(null);
    try {
      await api(`/api/admin/users/${a.id}`, { method: 'DELETE' });
      setAccounts((prev) => prev?.filter((x) => x.id !== a.id) ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (a: Account) => {
    const password = window.prompt(`Temporary password for ${a.name} (at least 6 characters). They should change it on their profile.`);
    if (password === null) return;
    setBusyId(a.id);
    setError(null);
    try {
      await api(`/api/admin/users/${a.id}/password`, { method: 'PUT', body: JSON.stringify({ password }) });
      window.alert(`Password reset. ${a.name} has been signed out everywhere.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (!accounts) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-cyan-500" />}
      </div>
    );
  }

  const pending = accounts.filter((a) => a.status === 'pending');
  const others = accounts.filter((a) => a.status !== 'pending');

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6 md:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
        Accounts <span className={`font-mono text-base font-medium ${muted}`}>{others.length}</span>
      </h1>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
            Requests waiting <span className="font-mono">{pending.length}</span>
          </h2>
          {pending.map((a) => (
            <div key={a.id} className={`${card} space-y-3 border-amber-400/40! p-4`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 font-mono text-xs font-bold text-amber-700 dark:text-amber-300">
                  {initials(a.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900 dark:text-white">{a.name}</p>
                  <p className={`truncate text-xs ${muted}`}>
                    {a.email} · asked {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button type="button" disabled={busyId === a.id} onClick={() => remove(a, 'Reject the request from')} className={`${secondaryButton} disabled:opacity-50`}>
                  <UserX className="h-4 w-4" /> Reject
                </button>
                <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => update(a.id, { status: 'active', datacenterIds: grants[a.id] ?? [] })}
                  className={`${primaryButton} disabled:opacity-50`}
                >
                  <UserCheck className="h-4 w-4" /> Approve
                </button>
              </div>
              <div className="space-y-1.5">
                <p className={`text-xs ${muted}`}>Can edit subnets, VLANs and IPs in:</p>
                <DcPicker value={grants[a.id] ?? []} onChange={(ids) => setGrants((g) => ({ ...g, [a.id]: ids }))} />
              </div>
            </div>
          ))}
        </section>
      )}

      {others.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 p-12 text-center`}>
          <Users className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
          <p className={`text-sm ${muted}`}>No accounts yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {others.map((a) => {
            const isSelf = a.id === currentUser.id;
            const busy = busyId === a.id;
            const disabled = a.status === 'disabled';
            return (
              <li key={a.id} className={`${card} space-y-3 p-4 ${disabled ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                      a.access === 'admin' ? 'bg-cyan-500 text-zinc-950' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    {initials(a.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium text-zinc-900 dark:text-white">
                      {a.name}
                      {isSelf && <span className={chipNeutral}>you</span>}
                      {disabled && <span className={`${chip} bg-rose-500/10 text-rose-700 dark:text-rose-300`}>disabled</span>}
                    </p>
                    <p className={`truncate text-xs ${muted}`}>
                      {a.email}
                      {a.role && ` · ${a.role}`}
                    </p>
                  </div>
                  <Segmented
                    label={`Access for ${a.name}`}
                    options={['member', 'admin'] as const}
                    value={a.access}
                    onChange={(access) => !isSelf && !busy && update(a.id, { access })}
                    render={(v) => (v === 'admin' ? 'Admin' : 'Member')}
                  />
                  {!isSelf && (
                    <div className="flex">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => resetPassword(a)}
                        className={iconButton}
                        title="Reset password"
                        aria-label={`Reset password for ${a.name}`}
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => update(a.id, { status: disabled ? 'active' : 'disabled' })}
                        className={iconButton}
                        title={disabled ? 'Enable' : 'Disable'}
                        aria-label={`${disabled ? 'Enable' : 'Disable'} ${a.name}`}
                      >
                        {disabled ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(a, 'Delete')}
                        className={`${iconButton} hover:text-rose-600! dark:hover:text-rose-400!`}
                        title="Delete"
                        aria-label={`Delete ${a.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                {a.access === 'admin' ? (
                  <p className={`flex items-center gap-1.5 text-xs ${muted}`}>
                    <ShieldCheck className="h-3.5 w-3.5 text-cyan-500" aria-hidden /> Can edit everything, including datacenters and accounts.
                  </p>
                ) : (
                  <DcPicker value={a.datacenterIds} disabled={busy} onChange={(datacenterIds) => update(a.id, { datacenterIds })} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
