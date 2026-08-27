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
import { SubnetCalculatorView } from './components/SubnetCalculatorView';
import { ApiExplorerView } from './components/ApiExplorerView';
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
import { Sun, Moon, AlertTriangle, Database, RefreshCw, FileCode } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { activeTab, isDark, loading, error, isAuthenticated, toggleTheme, retryDatabaseConnection } = useIPAM();
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

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${isDark ? 'bg-[#0F172A] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
          <span className="text-sm font-medium text-slate-400 font-mono">Connecting to MySQL Database...</span>
        </div>
      </div>
    );
  }

  // Dedicated Database Error Screen if MySQL failed to connect
  if (error) {
    return (
      <div className={`min-h-screen w-full flex flex-col justify-between p-4 sm:p-6 transition-colors font-sans antialiased ${
        isDark ? 'bg-[#0F172A] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}>
        <div className="flex items-center justify-between max-w-4xl w-full mx-auto">
          <BeyondIPLogo size="md" variant="full" />
          <button
            id="btn-error-theme-toggle"
            onClick={toggleTheme}
            className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-all ${
              isDark ? 'border-slate-700 bg-slate-800 text-amber-400 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="font-medium">{isDark ? 'Light' : 'Dark'}</span>
          </button>
        </div>

        <div className="max-w-2xl w-full mx-auto my-8">
          <div className={`rounded-2xl border p-6 sm:p-8 shadow-2xl space-y-6 ${
            isDark ? 'bg-slate-900/90 border-rose-500/30' : 'bg-white border-rose-200 shadow-rose-100'
          }`}>
            <div className="flex items-center gap-4 pb-4 border-b border-rose-500/20">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Database Connection Error
                </h1>
                <p className="text-xs text-rose-400 font-medium">
                  Failed to establish connection with MySQL server
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1.5">
              <span className="text-xs font-semibold text-rose-300 uppercase tracking-wider font-mono">
                Error Details
              </span>
              <p className="text-sm font-mono text-rose-400 break-all">
                {error}
              </p>
            </div>

            <div className={`p-4 rounded-xl border space-y-2 text-xs ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-center gap-2 font-semibold text-indigo-400">
                <FileCode className="w-4 h-4" />
                <span>Configuration File: <code>config/mysql.config.json</code></span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Please verify or update your host, port, credentials, and database name in <strong><code>/config/mysql.config.json</code></strong>. Once saved, click below to retry the connection.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                id="btn-retry-db-connection"
                onClick={handleRetryConnection}
                disabled={isRetryingDb}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isRetryingDb ? 'animate-spin' : ''}`} />
                <span>{isRetryingDb ? 'Retrying Connection...' : 'Retry Connection'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-3 border-t border-slate-200 dark:border-slate-800/60 max-w-4xl w-full mx-auto">
          <span>BeyondIP Enterprise &bull; Strict MySQL Storage Mode</span>
        </div>
      </div>
    );
  }

  // Standalone Auth Layout when logged out
  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen w-full flex flex-col justify-between p-4 sm:p-6 transition-colors font-sans antialiased ${
        isDark ? 'bg-[#0F172A] text-slate-100 dark' : 'bg-slate-50 text-slate-900'
      }`}>
        {/* Top Bar with Brand & Theme Toggle */}
        <div className="flex items-center justify-between max-w-5xl w-full mx-auto">
          <BeyondIPLogo size="md" variant="full" />

          <button
            id="btn-auth-theme-toggle"
            onClick={toggleTheme}
            className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-all ${
              isDark ? 'border-slate-700 bg-slate-800 text-amber-400 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            }`}
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="font-medium">{isDark ? 'Light' : 'Dark'}</span>
          </button>
        </div>

        {/* Auth View (Sign In or Sign Up) */}
        <div className="w-full flex-1 flex items-center justify-center py-6">
          {activeTab === 'signup' ? <SignUpView /> : <SignInView />}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-3 border-t border-slate-200 dark:border-slate-800/60 max-w-5xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Nexus IPAM &bull; Enterprise Network Grid & Subnet Orchestration</span>
          <span className="font-mono text-[11px]">TLS 1.3 &bull; Encrypted Session</span>
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
              onOpenReserveNextModal={() => handleOpenReserveNext()}
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
