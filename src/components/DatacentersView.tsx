import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { Building2, Edit, Hash, Layers, MapPin, Network, Plus, Trash2 } from 'lucide-react';
import { Datacenter, Subnet } from '../types/ipam';
import { Bar, card, chip, formatCount, iconButton, linkButton, muted, percentLabel, percentOf, primaryButton, secondaryButton, usableOf } from './ui';

interface DatacentersViewProps {
  onOpenNewDatacenterModal: () => void;
  onOpenEditDatacenterModal: (dc: Datacenter) => void;
  onOpenSubnetVisualizer: (subnet: Subnet) => void;
  onOpenNewSubnetModalForDC?: (dcId: string) => void;
  onOpenNewVlanModalForDC?: (dcId: string) => void;
}

export const DatacentersView: React.FC<DatacentersViewProps> = ({
  onOpenNewDatacenterModal,
  onOpenEditDatacenterModal,
  onOpenSubnetVisualizer,
  onOpenNewSubnetModalForDC,
  onOpenNewVlanModalForDC,
}) => {
  const { datacenters, vlans, subnets, ips, deleteDatacenter, setActiveTab, setFilters } = useIPAM();

  const [selectedDcId, setSelectedDcId] = useState<string | null>(datacenters[0]?.id || null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Used IPs per subnet, computed once for every card and list below.
  const usedBySubnet = new Map<string, number>();
  for (const ip of ips) {
    if (ip.status !== 'Available') usedBySubnet.set(ip.subnetId, (usedBySubnet.get(ip.subnetId) ?? 0) + 1);
  }
  const subnetRows = subnets.map((sub) => {
    const used = usedBySubnet.get(sub.id) ?? 0;
    const usable = usableOf(sub.cidr);
    return { sub, used, usable, percent: percentOf(used, usable) };
  });

  const dcStats = (dcId: string) => {
    const rows = subnetRows.filter((r) => r.sub.datacenterId === dcId);
    const used = rows.reduce((t, r) => t + r.used, 0);
    const usable = rows.reduce((t, r) => t + r.usable, 0);
    return { rows, used, percent: percentOf(used, usable), vlanCount: vlans.filter((v) => v.datacenterId === dcId).length };
  };

  const activeDc = datacenters.find((d) => d.id === selectedDcId) || datacenters[0];

  const handleDelete = async (dc: Datacenter) => {
    if (!window.confirm(`Delete datacenter ${dc.name}?`)) return;
    try {
      setDeleteError(null);
      await deleteDatacenter(dc.id);
      if (selectedDcId === dc.id) setSelectedDcId(datacenters.find((d) => d.id !== dc.id)?.id || null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete datacenter');
    }
  };

  const active = activeDc ? dcStats(activeDc.id) : null;
  const activeVlans = activeDc ? vlans.filter((v) => v.datacenterId === activeDc.id) : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Datacenters <span className={`text-lg font-medium ${muted}`}>{datacenters.length}</span>
        </h1>
        <button id="btn-add-datacenter" type="button" onClick={onOpenNewDatacenterModal} className={primaryButton}>
          <Plus className="h-4 w-4" /> New datacenter
        </button>
      </div>

      {deleteError && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-600 dark:text-rose-400">
          {deleteError}
        </div>
      )}

      {datacenters.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 p-12 text-center`}>
          <Building2 className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className={`text-sm ${muted}`}>No datacenters yet.</p>
          <button type="button" onClick={onOpenNewDatacenterModal} className={primaryButton}>
            Create the first one
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {datacenters.map((dc) => {
            const { rows, used, percent, vlanCount } = dcStats(dc.id);
            const isSelected = activeDc?.id === dc.id;
            return (
              <div
                key={dc.id}
                className={`${card} relative transition ${isSelected ? 'border-indigo-500! ring-2 ring-indigo-500/30' : 'hover:border-slate-300 dark:hover:border-slate-700'}`}
              >
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedDcId(dc.id)}
                  className="flex w-full flex-col gap-3 p-5 text-left cursor-pointer"
                >
                  <span className="pr-16">
                    <span className="block truncate font-semibold text-slate-900 dark:text-white">{dc.name}</span>
                    <span className={`flex items-center gap-1 text-xs ${muted}`}>
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{dc.location}</span>
                    </span>
                  </span>
                  <Bar percent={percent} label={`${dc.name} utilization`} />
                  <span className={`flex justify-between text-xs tabular-nums ${muted}`}>
                    <span>{vlanCount} VLANs · {rows.length} subnets · {used} IPs</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{percentLabel(percent)}</span>
                  </span>
                </button>
                <div className="absolute right-3 top-3 flex">
                  <button type="button" onClick={() => onOpenEditDatacenterModal(dc)} className={`${iconButton} p-1.5`} title="Edit" aria-label={`Edit ${dc.name}`}>
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(dc)}
                    className={`${iconButton} p-1.5 hover:text-rose-600! dark:hover:text-rose-400!`}
                    title="Delete"
                    aria-label={`Delete ${dc.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected datacenter */}
      {activeDc && active && (
        <section className={`${card} space-y-6 p-5 sm:p-6`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{activeDc.name}</h2>
              <p className={`text-sm ${muted}`}>{activeDc.description || activeDc.location}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setFilters((prev) => ({ ...prev, datacenterId: activeDc.id }));
                  setActiveTab('ips');
                }}
                className={secondaryButton}
              >
                <Hash className="h-4 w-4" /> View IPs
              </button>
              {onOpenNewVlanModalForDC && (
                <button type="button" onClick={() => onOpenNewVlanModalForDC(activeDc.id)} className={secondaryButton}>
                  <Plus className="h-4 w-4" /> VLAN
                </button>
              )}
              {onOpenNewSubnetModalForDC && (
                <button type="button" onClick={() => onOpenNewSubnetModalForDC(activeDc.id)} className={primaryButton}>
                  <Plus className="h-4 w-4" /> Subnet
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <Layers className="h-4 w-4 text-purple-500" /> VLANs <span className={`text-sm font-medium ${muted}`}>{activeVlans.length}</span>
              </h3>
              {activeVlans.length === 0 ? (
                <p className={`py-6 text-center text-sm ${muted}`}>No VLANs here yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeVlans.map((vlan) => (
                    <li key={vlan.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className={`${chip} bg-purple-500/10 font-mono text-purple-700 dark:text-purple-300`}>{vlan.vlanId}</span>
                      <span className="truncate font-medium text-slate-800 dark:text-slate-100">{vlan.name}</span>
                      <span className={`ml-auto shrink-0 text-xs ${muted}`}>
                        {active.rows.filter((r) => r.sub.vlanId === vlan.id).length} subnets
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <Network className="h-4 w-4 text-indigo-500" /> Subnets <span className={`text-sm font-medium ${muted}`}>{active.rows.length}</span>
              </h3>
              {active.rows.length === 0 ? (
                <p className={`py-6 text-center text-sm ${muted}`}>No subnets here yet.</p>
              ) : (
                <ul className="space-y-1">
                  {active.rows.map(({ sub, used, usable, percent }) => (
                    <li key={sub.id}>
                      <button
                        type="button"
                        onClick={() => onOpenSubnetVisualizer(sub)}
                        className="grid w-full grid-cols-[1fr_6rem] items-center gap-x-4 gap-y-1 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                      >
                        <span className="truncate font-mono text-sm font-semibold text-slate-900 dark:text-white">{sub.cidr}</span>
                        <span className={`text-right text-xs tabular-nums ${muted}`}>
                          {used} / {formatCount(usable)}
                        </span>
                        <span className="col-span-2">
                          <Bar percent={percent} label={`${sub.cidr} utilization`} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {active.rows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('subnets')}
                  className={`${linkButton} mt-3`}
                >
                  Manage subnets
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
