import React, { useState, useMemo } from 'react';
import { useIPAM } from '../../context/IPAMContext';
import { ActivityLog } from '../../types/ipam';
import { 
  Activity, 
  X, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  PlusCircle, 
  Edit3, 
  Bookmark, 
  Layers, 
  Building2, 
  Network, 
  Hash, 
  Copy, 
  Check, 
  ExternalLink,
  Calendar
} from 'lucide-react';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEntityFilter?: string;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  isOpen,
  onClose,
  initialEntityFilter,
}) => {
  const { 
    activityLogs, 
    fetchBootstrapData, 
    setActiveTab, 
    setFilters, 
    isDark 
  } = useIPAM();

  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<'ALL' | 'CREATE' | 'UPDATE' | 'DELETE' | 'RESERVE'>('ALL');
  const [entityFilter, setEntityFilter] = useState<'ALL' | 'Datacenter' | 'VLAN' | 'Subnet' | 'IP'>(
    (initialEntityFilter as any) || 'ALL'
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchBootstrapData();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      // Action filter
      if (actionFilter !== 'ALL' && log.action !== actionFilter) {
        return false;
      }
      // Entity filter
      if (entityFilter !== 'ALL' && log.entityType !== entityFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = log.title.toLowerCase().includes(q);
        const matchesDetail = log.detail.toLowerCase().includes(q);
        const matchesId = log.entityId.toLowerCase().includes(q);
        const matchesType = log.entityType.toLowerCase().includes(q);
        const matchesAction = log.action.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDetail && !matchesId && !matchesType && !matchesAction) {
          return false;
        }
      }
      return true;
    });
  }, [activityLogs, actionFilter, entityFilter, searchQuery]);

  const handleNavigateToEntity = (log: ActivityLog) => {
    onClose();
    if (log.entityType === 'IP') {
      setActiveTab('ips');
      // If the detail or title mentions an IP address, filter by it
      const ipMatch = log.detail.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/) || log.title.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
      if (ipMatch) {
        setFilters(prev => ({ ...prev, search: ipMatch[0] }));
      }
    } else if (log.entityType === 'Subnet') {
      setActiveTab('subnets');
      const cidrMatch = log.detail.match(/\b(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}\b/) || log.title.match(/\b(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}\b/);
      if (cidrMatch) {
        setFilters(prev => ({ ...prev, search: cidrMatch[0] }));
      }
    } else if (log.entityType === 'VLAN') {
      setActiveTab('vlans');
    } else if (log.entityType === 'Datacenter') {
      setActiveTab('datacenters');
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `nexus-audit-trail-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Action', 'EntityType', 'EntityID', 'Title', 'Detail'];
    const rows = filteredLogs.map(log => [
      `"${log.timestamp}"`,
      `"${log.action}"`,
      `"${log.entityType}"`,
      `"${log.entityId}"`,
      `"${log.title.replace(/"/g, '""')}"`,
      `"${log.detail.replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `nexus-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <PlusCircle className="w-3 h-3" /> CREATE
          </span>
        );
      case 'UPDATE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Edit3 className="w-3 h-3" /> UPDATE
          </span>
        );
      case 'DELETE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Trash2 className="w-3 h-3" /> DELETE
          </span>
        );
      case 'RESERVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Bookmark className="w-3 h-3" /> RESERVE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-slate-500/10 text-slate-400 border border-slate-500/20">
            {action}
          </span>
        );
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'Datacenter':
        return <Building2 className="w-3.5 h-3.5 text-amber-400" />;
      case 'VLAN':
        return <Layers className="w-3.5 h-3.5 text-purple-400" />;
      case 'Subnet':
        return <Network className="w-3.5 h-3.5 text-emerald-400" />;
      case 'IP':
        return <Hash className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const now = new Date();
      const past = new Date(isoString);
      const diffMs = now.getTime() - past.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour}h ago`;
      const diffDays = Math.floor(diffHour / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isDark 
            ? 'bg-[#1E293B] border-slate-700/80 text-slate-100' 
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50'
        }`}
      >
        {/* Modal Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'border-slate-700/80 bg-slate-900/40' : 'border-slate-200 bg-slate-50/70'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-bold">Network Alerts & Audit Stream</h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live Synchronized
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Comprehensive historical log of all CIDR allocations, reservation leases, and network infrastructure modifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                isDark 
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300' 
                  : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
              }`}
              title="Refresh Audit Logs"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
              <span className="hidden md:inline">Sync</span>
            </button>

            <button
              onClick={onClose}
              className={`p-2 rounded-xl border transition-colors ${
                isDark 
                  ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white' 
                  : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          isDark ? 'border-slate-700/60 bg-slate-900/20' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className={`relative flex-1 min-w-[200px] max-w-sm rounded-xl border ${
              isDark ? 'bg-slate-900/60 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
            }`}>
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search audit trail, IPs, CIDRs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-transparent focus:outline-none placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Action Filter Pills */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] font-semibold text-slate-400 mr-1 hidden sm:inline">Action:</span>
              {(['ALL', 'CREATE', 'UPDATE', 'DELETE', 'RESERVE'] as const).map((act) => (
                <button
                  key={act}
                  onClick={() => setActionFilter(act)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all ${
                    actionFilter === act
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : isDark
                      ? 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/50'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  {act}
                </button>
              ))}
            </div>

            {/* Entity Filter */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] font-semibold text-slate-400 mr-1 hidden lg:inline">Entity:</span>
              {(['ALL', 'Datacenter', 'VLAN', 'Subnet', 'IP'] as const).map((ent) => (
                <button
                  key={ent}
                  onClick={() => setEntityFilter(ent)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    entityFilter === ent
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isDark
                      ? 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/50'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  {ent}
                </button>
              ))}
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                isDark 
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300' 
                  : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
              }`}
              title="Download audit trail as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportJSON}
              disabled={filteredLogs.length === 0}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                isDark 
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300' 
                  : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
              }`}
              title="Download audit trail as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {/* Audit Log Content Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-500/10 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-300">No matching audit events found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {activityLogs.length === 0 
                  ? 'No network infrastructure changes or allocations have been recorded yet.'
                  : 'Try clearing your search query or loosening your filter criteria.'}
              </p>
              {(searchQuery || actionFilter !== 'ALL' || entityFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActionFilter('ALL');
                    setEntityFilter('ALL');
                  }}
                  className="mt-3 text-xs font-semibold text-indigo-400 hover:underline"
                >
                  Reset all filters
                </button>
              )}
            </div>
          ) : (
            filteredLogs.map((log) => {
              const relTime = formatRelativeTime(log.timestamp);
              const exactTime = new Date(log.timestamp).toLocaleString();

              return (
                <div
                  key={log.id}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                    isDark 
                      ? 'bg-slate-900/60 border-slate-700/60 hover:border-slate-600' 
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center flex-wrap gap-2">
                      {getActionBadge(log.action)}
                      
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                      }`}>
                        {getEntityIcon(log.entityType)}
                        {log.entityType}
                      </span>

                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {log.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px] shrink-0">
                      <span className="flex items-center gap-1" title={exactTime}>
                        <Clock className="w-3.5 h-3.5" />
                        {relTime || exactTime}
                      </span>
                      <span className="text-slate-600 hidden sm:inline">•</span>
                      <span className="hidden sm:inline text-slate-500 text-[10px]">
                        {exactTime}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 dark:text-slate-300 leading-relaxed font-sans pl-0.5">
                    {log.detail}
                  </p>

                  {/* Footer metadata & quick navigation */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>Entity ID:</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {log.entityId}
                      </span>
                      <button
                        onClick={() => handleCopy(log.id, log.entityId)}
                        className="text-slate-400 hover:text-slate-200 p-0.5"
                        title="Copy Entity ID"
                      >
                        {copiedId === log.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    <button
                      onClick={() => handleNavigateToEntity(log)}
                      className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      <span>View in {log.entityType === 'IP' ? 'IP Directory' : log.entityType === 'Subnet' ? 'Subnets' : log.entityType === 'VLAN' ? 'VLANs' : 'Datacenters'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className={`p-3 sm:p-4 border-t flex items-center justify-between text-xs text-slate-400 shrink-0 font-mono ${
          isDark ? 'border-slate-700/80 bg-slate-900/40' : 'border-slate-200 bg-slate-50/70'
        }`}>
          <div>
            Showing <span className="font-bold text-slate-200">{filteredLogs.length}</span> of <span className="font-bold text-slate-200">{activityLogs.length}</span> recorded events
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-semibold text-xs transition-colors"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
