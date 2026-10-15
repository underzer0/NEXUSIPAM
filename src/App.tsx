import React, { useState } from 'react';
import { IPAMProvider, useIPAM } from './context/IPAMContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DashboardView } from './components/DashboardView';
import { DatacentersView } from './components/DatacentersView';
import { VlansView } from './components/VlansView';
import { SubnetsView } from './components/SubnetsView';
import { IPDirectoryView } from './components/IPDirectoryView';
import { ToolsView } from './components/ToolsView';
import { AdminView } from './components/AdminView';
import { UserProfileView } from './components/UserProfileView';
import { SignUpView } from './components/SignUpView';
import { SignInView } from './components/SignInView';
import { SubnetVisualizerModal } from './components/SubnetVisualizerModal';
import { DatacenterModal } from './components/modals/DatacenterModal';
import { VlanModal } from './components/modals/VlanModal';
import { SubnetModal } from './components/modals/SubnetModal';
import { IPModal } from './components/modals/IPModal';
import { ReserveNextIPModal } from './components/modals/ReserveNextIPModal';
import { BulkGenerateModal } from './components/modals/BulkGenerateModal';
import { AuditLogModal } from './components/modals/AuditLogModal';
import { Datacenter, VLAN, Subnet, IPAddress } from './types/ipam';
import { BeyondIPLogo } from './components/BeyondIPLogo';
import { Sun, Moon, AlertTriangle, RefreshCw } from 'lucide-react';
import { card, iconButton, muted, primaryButton } from './components/ui';

const MainAppContent: React.FC = () => {
  const { activeTab, isDark, loading, error, isAuthenticated, isAdmin, toggleTheme, retryDatabaseConnection } = useIPAM();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRetryingDb, setIsRetryingDb] = useState(false);

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

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditEntityFilter, setAuditEntityFilter] = useState<string | undefined>(undefined);

  // Handlers
  const handleOpenAuditLogs = (entityFilter?: string) => {
    setAuditEntityFilter(entityFilter);
    setIsAuditModalOpen(true);
  };

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

  const handleRetryConnection = async () => {
    setIsRetryingDb(true);
    try {
      await retryDatabaseConnection();
    } finally {
      setIsRetryingDb(false);
    }
  };

  const themeButton = (
    <button type="button" onClick={toggleTheme} className={`${iconButton} border border-zinc-200 dark:border-zinc-800`} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  // Shared frame for the screens shown before the main app is available.
  const bare = (children: React.ReactNode) => (
    <div className="flex min-h-screen flex-col p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <BeyondIPLogo size="md" variant="full" />
        {themeButton}
      </div>
      <div className="flex flex-1 items-center justify-center py-6">{children}</div>
    </div>
  );

  if (error) {
    return bare(
      <div className={`${card} w-full max-w-lg space-y-5 p-6`}>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 shrink-0 text-rose-500" />
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Can’t reach the database</h1>
        </div>
        <p className="break-words rounded-xl bg-rose-500/10 p-3 font-mono text-sm text-rose-700 dark:text-rose-300">{error}</p>
        <p className={`text-sm ${muted}`}>
          Check the host, port, user and password in <code className="font-mono">config/mysql.config.json</code>, then try again.
        </p>
        <div className="flex justify-end">
          <button id="btn-retry-db-connection" type="button" onClick={handleRetryConnection} disabled={isRetryingDb} className={`${primaryButton} disabled:opacity-50`}>
            <RefreshCw className={`h-4 w-4 ${isRetryingDb ? 'animate-spin' : ''}`} />
            {isRetryingDb ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return bare(activeTab === 'signup' ? <SignUpView /> : <SignInView />);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Navigation Sidebar */}
      <Sidebar 
        collapsed={sidebarCollapsed} 
        setCollapsed={setSidebarCollapsed} 
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Global Header */}
        <Header 
          onOpenNewSubnetModal={() => handleOpenNewSubnet()}
          onOpenReserveNextModal={() => handleOpenReserveNext()}
          onOpenNewDatacenterModal={handleOpenNewDatacenter}
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
          onOpenAuditLogs={() => handleOpenAuditLogs()}
        />

        {/* Scrollable View Canvas */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          {activeTab === 'dashboard' && (
            <DashboardView
              onOpenSubnetVisualizer={handleOpenVisualizer}
              onOpenNewDatacenterModal={handleOpenNewDatacenter}
              onOpenNewSubnetModal={() => handleOpenNewSubnet()}
              onOpenAuditLogs={handleOpenAuditLogs}
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
              onOpenBulkGenerateModal={() => handleOpenBulkGenerate(null)}
            />
          )}

          {activeTab === 'tools' && <ToolsView />}
          {activeTab === 'admin' && isAdmin && <AdminView />}

          {activeTab === 'profile' && (
            <UserProfileView />
          )}

          {activeTab === 'signup' && (
            <SignUpView />
          )}

          {activeTab === 'signin' && (
            <SignInView />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <MobileBottomNav onOpenMenu={() => setIsMobileMenuOpen(true)} />
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

      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        initialEntityFilter={auditEntityFilter}
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
