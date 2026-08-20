import React, { useState } from 'react';
import { IPAMProvider, useIPAM } from './context/IPAMContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { DatacentersView } from './components/DatacentersView';
import { VlansView } from './components/VlansView';
import { SubnetsView } from './components/SubnetsView';
import { IPDirectoryView } from './components/IPDirectoryView';
import { SubnetCalculatorView } from './components/SubnetCalculatorView';
import { ApiExplorerView } from './components/ApiExplorerView';
import { SubnetVisualizerModal } from './components/SubnetVisualizerModal';
import { DatacenterModal } from './components/modals/DatacenterModal';
import { VlanModal } from './components/modals/VlanModal';
import { SubnetModal } from './components/modals/SubnetModal';
import { IPModal } from './components/modals/IPModal';
import { ReserveNextIPModal } from './components/modals/ReserveNextIPModal';
import { BulkGenerateModal } from './components/modals/BulkGenerateModal';
import { Datacenter, VLAN, Subnet, IPAddress } from './types/ipam';

const MainAppContent: React.FC = () => {
  const { activeTab, isDark, loading } = useIPAM();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Modal states
  const [isNewDcOpen, setIsNewDcOpen] = useState(false);
  const [editingDc, setEditingDc] = useState<Datacenter | null>(null);

  const [isNewVlanOpen, setIsNewVlanOpen] = useState(false);
  const [editingVlan, setEditingVlan] = useState<VLAN | null>(null);
  const [defaultDcForVlan, setDefaultDcForVlan] = useState<string | undefined>(undefined);

  const [isNewSubnetOpen, setIsNewSubnetOpen] = useState(false);
  const [editingSubnet, setEditingSubnet] = useState<Subnet | null>(null);
  const [defaultDcForSubnet, setDefaultDcForSubnet] = useState<string | undefined>(undefined);

  const [isNewIPOpen, setIsNewIPOpen] = useState(false);
  const [editingIP, setEditingIP] = useState<IPAddress | null>(null);
  const [defaultSubnetForIP, setDefaultSubnetForIP] = useState<string | undefined>(undefined);

  const [isReserveNextOpen, setIsReserveNextOpen] = useState(false);
  const [reserveNextSubnetId, setReserveNextSubnetId] = useState<string | undefined>(undefined);

  const [isBulkGenerateOpen, setIsBulkGenerateOpen] = useState(false);
  const [bulkGenerateSubnet, setBulkGenerateSubnet] = useState<Subnet | null>(null);

  const [visualizerSubnet, setVisualizerSubnet] = useState<Subnet | null>(null);

  // Handlers
  const handleOpenNewVlan = (dcId?: string) => {
    setDefaultDcForVlan(dcId);
    setEditingVlan(null);
    setIsNewVlanOpen(true);
  };

  const handleOpenEditVlan = (vlan: VLAN) => {
    setEditingVlan(vlan);
    setIsNewVlanOpen(true);
  };

  const handleOpenNewSubnet = (dcId?: string) => {
    setDefaultDcForSubnet(dcId);
    setEditingSubnet(null);
    setIsNewSubnetOpen(true);
  };

  const handleOpenEditSubnet = (subnet: Subnet) => {
    setEditingSubnet(subnet);
    setIsNewSubnetOpen(true);
  };

  const handleOpenNewDatacenter = () => {
    setEditingDc(null);
    setIsNewDcOpen(true);
  };

  const handleOpenEditDatacenter = (dc: Datacenter) => {
    setEditingDc(dc);
    setIsNewDcOpen(true);
  };

  const handleOpenNewIP = (subnetId?: string) => {
    setDefaultSubnetForIP(subnetId);
    setEditingIP(null);
    setIsNewIPOpen(true);
  };

  const handleOpenEditIP = (ip: IPAddress) => {
    setEditingIP(ip);
    setIsNewIPOpen(true);
  };

  const handleOpenReserveNext = (subnetId?: string) => {
    setReserveNextSubnetId(subnetId);
    setIsReserveNextOpen(true);
  };

  const handleOpenBulkGenerate = (subnet?: Subnet | null) => {
    setBulkGenerateSubnet(subnet || null);
    setIsBulkGenerateOpen(true);
  };

  const handleOpenVisualizer = (subnet: Subnet) => {
    setVisualizerSubnet(subnet);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${isDark ? 'bg-[#0F172A] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
          <span className="text-sm font-medium text-slate-400 font-mono">Bootstrapping IPAM Enterprise Grid...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-full overflow-hidden font-sans antialiased ${
      isDark ? 'bg-[#0F172A] text-slate-300 dark' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* Navigation Sidebar */}
      <Sidebar 
        collapsed={sidebarCollapsed} 
        setCollapsed={setSidebarCollapsed} 
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Global Header */}
        <Header 
          onOpenNewSubnetModal={() => handleOpenNewSubnet()}
          onOpenReserveNextModal={() => handleOpenReserveNext()}
          onOpenNewDatacenterModal={handleOpenNewDatacenter}
        />

        {/* Scrollable View Canvas */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              onOpenSubnetVisualizer={handleOpenVisualizer}
              onOpenNewDatacenterModal={handleOpenNewDatacenter}
              onOpenNewSubnetModal={() => handleOpenNewSubnet()}
              onOpenReserveNextModal={() => handleOpenReserveNext()}
            />
          )}

          {activeTab === 'datacenters' && (
            <DatacentersView
              onOpenNewDatacenterModal={handleOpenNewDatacenter}
              onOpenEditDatacenterModal={handleOpenEditDatacenter}
              onOpenSubnetVisualizer={handleOpenVisualizer}
              onOpenNewSubnetModalForDC={handleOpenNewSubnet}
              onOpenNewVlanModalForDC={handleOpenNewVlan}
            />
          )}

          {activeTab === 'vlans' && (
            <VlansView
              onOpenNewVlanModal={() => handleOpenNewVlan()}
              onOpenEditVlanModal={handleOpenEditVlan}
            />
          )}

          {activeTab === 'subnets' && (
            <SubnetsView
              onOpenNewSubnetModal={() => handleOpenNewSubnet()}
              onOpenEditSubnetModal={handleOpenEditSubnet}
              onOpenSubnetVisualizer={handleOpenVisualizer}
              onOpenReserveNextModal={handleOpenReserveNext}
              onOpenBulkGenerateModal={handleOpenBulkGenerate}
            />
          )}

          {activeTab === 'ips' && (
            <IPDirectoryView
              onOpenNewIPModal={() => handleOpenNewIP()}
              onOpenEditIPModal={handleOpenEditIP}
              onOpenReserveNextModal={handleOpenReserveNext}
              onOpenBulkGenerateModal={() => handleOpenBulkGenerate(null)}
            />
          )}

          {activeTab === 'calculator' && (
            <SubnetCalculatorView />
          )}

          {activeTab === 'api-docs' && (
            <ApiExplorerView />
          )}
        </main>
      </div>

      {/* Interactive Modals */}
      <SubnetVisualizerModal
        subnet={visualizerSubnet}
        onClose={() => setVisualizerSubnet(null)}
      />

      <DatacenterModal
        isOpen={isNewDcOpen}
        onClose={() => setIsNewDcOpen(false)}
        datacenterToEdit={editingDc}
      />

      <VlanModal
        isOpen={isNewVlanOpen}
        onClose={() => setIsNewVlanOpen(false)}
        vlanToEdit={editingVlan}
        defaultDatacenterId={defaultDcForVlan}
      />

      <SubnetModal
        isOpen={isNewSubnetOpen}
        onClose={() => setIsNewSubnetOpen(false)}
        subnetToEdit={editingSubnet}
        defaultDatacenterId={defaultDcForSubnet}
      />

      <IPModal
        isOpen={isNewIPOpen}
        onClose={() => setIsNewIPOpen(false)}
        ipToEdit={editingIP}
        defaultSubnetId={defaultSubnetForIP}
      />

      <ReserveNextIPModal
        isOpen={isReserveNextOpen}
        onClose={() => setIsReserveNextOpen(false)}
        defaultSubnetId={reserveNextSubnetId}
      />

      <BulkGenerateModal
        isOpen={isBulkGenerateOpen}
        onClose={() => setIsBulkGenerateOpen(false)}
        subnet={bulkGenerateSubnet}
      />
    </div>
  );
};

export default function App() {
  return (
    <IPAMProvider>
      <MainAppContent />
    </IPAMProvider>
  );
}
