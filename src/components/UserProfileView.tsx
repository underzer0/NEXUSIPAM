import React, { useState, useEffect } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { 
  User, 
  Mail, 
  Shield, 
  Building2, 
  MapPin, 
  Phone, 
  Key, 
  Copy, 
  Check, 
  RefreshCw, 
  Bell, 
  Server, 
  AlertTriangle, 
  Lock, 
  Save, 
  CheckCircle2,
  LogOut,
  UserPlus
} from 'lucide-react';
import { UserProfile } from '../types/ipam';

export const UserProfileView: React.FC = () => {
  const { 
    currentUser, 
    updateCurrentUser, 
    generateNewApiKey, 
    signOut,
    setActiveTab,
    datacenters, 
    subnets, 
    ips, 
    isDark 
  } = useIPAM();

  // Form State
  const [name, setName] = useState(currentUser.name || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [role, setRole] = useState(currentUser.role || 'Network Architect');
  const [department, setDepartment] = useState(currentUser.department || 'Core Infrastructure');
  const [organization, setOrganization] = useState(currentUser.organization || 'BeyondIP Global Networks');
  const [location, setLocation] = useState(currentUser.location || 'Ashburn, VA / Remote');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [primaryDatacenterId, setPrimaryDatacenterId] = useState(currentUser.primaryDatacenterId || 'dc-east');

  // Preferences & Toggles
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(currentUser.twoFactorEnabled ?? true);
  const [emailNotifications, setEmailNotifications] = useState(currentUser.emailNotifications ?? true);
  const [collisionAlerts, setCollisionAlerts] = useState(currentUser.collisionAlerts ?? true);
  const [exhaustionAlerts, setExhaustionAlerts] = useState(currentUser.exhaustionAlerts ?? true);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);
  const [activeSection, setActiveSection] = useState<'profile' | 'security' | 'notifications'>('profile');

  // Keep state synchronized if currentUser changes
  useEffect(() => {
    setName(currentUser.name || '');
    setEmail(currentUser.email || '');
    setRole(currentUser.role || 'Network Architect');
    setDepartment(currentUser.department || 'Core Infrastructure');
    setOrganization(currentUser.organization || 'Nexus Global Networks');
    setLocation(currentUser.location || 'Ashburn, VA / Remote');
    setPhone(currentUser.phone || '');
    setBio(currentUser.bio || '');
    setPrimaryDatacenterId(currentUser.primaryDatacenterId || 'dc-east');
    setTwoFactorEnabled(currentUser.twoFactorEnabled ?? true);
    setEmailNotifications(currentUser.emailNotifications ?? true);
    setCollisionAlerts(currentUser.collisionAlerts ?? true);
    setExhaustionAlerts(currentUser.exhaustionAlerts ?? true);
  }, [currentUser]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);
    setSaveSuccess(false);

    if (!name.trim()) {
      setErrorMessage('Full name is required.');
      setIsSaving(false);
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid work email address.');
      setIsSaving(false);
      return;
    }

    try {
      await updateCurrentUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role.trim(),
        department: department.trim(),
        organization: organization.trim(),
        location: location.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        primaryDatacenterId,
        twoFactorEnabled,
        emailNotifications,
        collisionAlerts,
        exhaustionAlerts,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save profile changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyApiKey = () => {
    if (currentUser.apiKey) {
      navigator.clipboard.writeText(currentUser.apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    }
  };

  const handleRegenerateKey = async () => {
    if (window.confirm('Are you sure you want to regenerate your API token? Any automated scripts using the existing token will need to be updated.')) {
      setIsRegeneratingKey(true);
      try {
        await generateNewApiKey();
      } catch (err: any) {
        alert(err.message || 'Failed to regenerate API key');
      } finally {
        setIsRegeneratingKey(false);
      }
    }
  };

  // User initials helper
  const getInitials = (n: string) => {
    const parts = (n || 'User').trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (parts[0] || 'U').substring(0, 2).toUpperCase();
  };

  // Associated datacenter statistics
  const primaryDC = datacenters.find(d => d.id === primaryDatacenterId);
  const dcSubnets = subnets.filter(s => s.datacenterId === primaryDatacenterId);
  const dcIPs = ips.filter(i => dcSubnets.some(s => s.id === i.subnetId));

  const roleOptions = [
    'IT Engineer',
    'Junior Network Admin',
    'Senior Network Admin',
    'Expert Network Architect',
    'IT Manager',
    'Director',
  ];

  return (
    <div id="user-profile-page" className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-6 animate-fadeIn pb-24 md:pb-12">
      
      {/* Top Banner & User Card */}
      <div className={`rounded-2xl border p-6 shadow-xl relative overflow-hidden transition-all ${
        isDark 
          ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border-slate-700/60' 
          : 'bg-gradient-to-r from-white via-indigo-50/30 to-purple-50/40 border-slate-200'
      }`}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Avatar Badge */}
            <div className="relative group">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-lg shadow-indigo-500/25 border-2 border-white/20">
                {getInitials(name || currentUser.name)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center" title="Online Active Session">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
              </div>
            </div>

            {/* Identity Info */}
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {name || currentUser.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-mono">
                  {role || currentUser.role}
                </span>
              </div>
              
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 font-mono">
                <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="font-medium text-slate-700 dark:text-slate-300">{email || currentUser.email}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans font-semibold">
                  Verified Identity
                </span>
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {organization} • {department}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {location}
                </span>
              </div>
            </div>
          </div>

          {/* User Session Info Pill & Sign Out Action */}
          <div className="flex flex-wrap items-center gap-2">
            <div className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
              isDark 
                ? 'bg-slate-800/80 border-slate-700 text-slate-300' 
                : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="hidden sm:inline">Active Session</span>
            </div>

            <button
              id="btn-profile-signout"
              type="button"
              onClick={async () => {
                await signOut();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isDark 
                  ? 'border-rose-500/30 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20' 
                  : 'border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100'
              }`}
              title="Sign out of this account to switch users"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
          {[
            { id: 'profile' as const, label: 'Profile Information', icon: User },
            { id: 'security' as const, label: 'Security & API Tokens', icon: Shield },
            { id: 'notifications' as const, label: 'Alert Preferences', icon: Bell },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0 ${
                  isActive
                    ? isDark
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold'
                    : isDark
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Success Notification Banner */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-between animate-fadeIn shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">User profile updated successfully!</p>
              <p className="text-xs text-emerald-400/90">All changes have been synchronized across the IPAM grid in real time.</p>
            </div>
          </div>
          <button 
            onClick={() => setSaveSuccess(false)}
            className="text-xs text-emerald-400/80 hover:text-emerald-300 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center gap-3 animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <p className="text-sm">{errorMessage}</p>
        </div>
      )}

      {/* SECTION 1: PROFILE INFORMATION */}
      {activeSection === 'profile' && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className={`rounded-2xl border p-6 shadow-sm transition-colors ${
            isDark ? 'bg-[#1E293B]/70 border-slate-700/60' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 dark:border-slate-700/60">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-400" /> Personal & Engineering Identity
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Update your contact details, organizational role, and datacenter affinity.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                User ID: {currentUser.id}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="profile-input-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                      isDark 
                        ? 'bg-slate-900/90 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Work Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="profile-input-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. alex.morgan@nexus.io"
                    className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                      isDark 
                        ? 'bg-slate-900/90 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>

              {/* Job Title / Role */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Engineering Role / Job Title
                </label>
                <select
                  id="profile-select-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                    isDark 
                      ? 'bg-slate-900/90 border-slate-700 text-white focus:border-indigo-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500'
                  }`}
                >
                  {roleOptions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Emergency Phone / NOC Extension
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="profile-input-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 019-2834"
                    className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                      isDark 
                        ? 'bg-slate-900/90 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Department
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="profile-input-department"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Core Infrastructure Engineering"
                    className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                      isDark 
                        ? 'bg-slate-900/90 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>

              {/* Organization */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Organization / Company
                </label>
                <input
                  id="profile-input-organization"
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Nexus Global Networks"
                  className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                    isDark 
                      ? 'bg-slate-900/90 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                  }`}
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Office Location / Datacenter Base
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="profile-input-location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ashburn, VA / Remote"
                    className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                      isDark 
                        ? 'bg-slate-900/90 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>

              {/* Primary Datacenter Site */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Primary Assigned Datacenter Site
                </label>
                <div className="relative">
                  <Server className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    id="profile-select-dc"
                    value={primaryDatacenterId}
                    onChange={(e) => setPrimaryDatacenterId(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                      isDark 
                        ? 'bg-slate-900/90 border-slate-700 text-white focus:border-indigo-500' 
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500'
                    }`}
                  >
                    {datacenters.map(dc => (
                      <option key={dc.id} value={dc.id}>
                        {dc.name} ({dc.location})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Bio */}
            <div className="mt-5 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Professional Bio & Infrastructure Scope
              </label>
              <textarea
                id="profile-input-bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your network responsibilities, BGP peers, subnets managed, or on-call rotation duties..."
                className={`w-full px-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                  isDark 
                    ? 'bg-slate-900/90 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                }`}
              />
            </div>

            {/* Primary DC Preview Box */}
            {primaryDC && (
              <div className={`mt-6 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                isDark ? 'bg-slate-900/60 border-slate-700/50' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                    DC
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {primaryDC.name} Scope
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {primaryDC.location}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {primaryDC.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Managed Subnets</span>
                    <span className="font-bold text-emerald-400">{dcSubnets.length}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Allocated IPs</span>
                    <span className="font-bold text-indigo-400">{dcIPs.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Save Buttons */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setName(currentUser.name);
                  setEmail(currentUser.email);
                  setRole(currentUser.role);
                  setDepartment(currentUser.department);
                  setBio(currentUser.bio);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Discard Changes
              </button>

              <button
                id="btn-save-profile"
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/25 transition-all disabled:opacity-50 active:scale-95"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSaving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* SECTION 2: SECURITY & API TOKENS */}
      {activeSection === 'security' && (
        <div className="space-y-6">
          {/* REST API Access Key */}
          <div className={`rounded-2xl border p-6 shadow-sm transition-colors ${
            isDark ? 'bg-[#1E293B]/70 border-slate-700/60' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 dark:border-slate-700/60">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-400" /> Enterprise REST API Token
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Use this Bearer Token to automate IP provisioning via CI/CD, Terraform, or Ansible.
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Active Token
              </span>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Active Personal Access Key (Bearer)
              </label>
              
              <div className={`flex items-center justify-between p-3 rounded-xl border font-mono text-xs ${
                isDark ? 'bg-slate-900/90 border-slate-700 text-indigo-300' : 'bg-slate-100 border-slate-300 text-indigo-700'
              }`}>
                <span className="truncate mr-4">
                  {currentUser.apiKey || 'nx_live_9f82b7c4e201a68d'}
                </span>
                
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id="btn-copy-api-key"
                    onClick={handleCopyApiKey}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/30 transition-colors font-sans text-xs font-medium"
                    title="Copy to clipboard"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    id="btn-regenerate-api-key"
                    onClick={handleRegenerateKey}
                    disabled={isRegeneratingKey}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors font-sans text-xs font-medium"
                    title="Generate new token"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRegeneratingKey ? 'animate-spin' : ''}`} />
                    <span>Regenerate</span>
                  </button>
                </div>
              </div>

              {/* cURL Usage Code Block */}
              <div className="mt-4 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Sample cURL API Request
                </span>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
                  <code>
                    curl -X GET http://localhost:3000/api/ips \<br/>
                    &nbsp;&nbsp;-H "Authorization: Bearer {currentUser.apiKey || 'nx_live_9f82b7c4e201a68d'}" \<br/>
                    &nbsp;&nbsp;-H "Content-Type: application/json"
                  </code>
                </div>
              </div>
            </div>
          </div>

          {/* Two Factor Authentication & Password */}
          <div className={`rounded-2xl border p-6 shadow-sm transition-colors ${
            isDark ? 'bg-[#1E293B]/70 border-slate-700/60' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 dark:border-slate-700/60">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" /> Multi-Factor Authentication & Access Control
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enforce hardware keys or authenticator apps (TOTP) for infrastructure change operations.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-700/40 bg-slate-900/40">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-slate-200">Enforce Two-Factor Authentication (2FA)</p>
                  <p className="text-xs text-slate-400">Require an authenticator code when creating or deleting network subnets.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !twoFactorEnabled;
                    setTwoFactorEnabled(next);
                    updateCurrentUser({ twoFactorEnabled: next });
                  }}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    twoFactorEnabled ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    twoFactorEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-700/40 bg-slate-900/40">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-slate-200">Account Password & SSO</p>
                  <p className="text-xs text-slate-400">Password authenticated session with 256-bit hash verification</p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-slate-800 text-emerald-400 border border-emerald-500/20">
                  Password Active
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-rose-400 flex items-center gap-1.5">
                    <LogOut className="w-4 h-4 text-rose-400" /> End Workstation Session
                  </p>
                  <p className="text-xs text-slate-400">
                    Sign out of this account to switch to another profile or secure your workstation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-md shadow-rose-600/20 shrink-0"
                >
                  Sign Out Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: NOTIFICATIONS & ALERTS */}
      {activeSection === 'notifications' && (
        <div className={`rounded-2xl border p-6 shadow-sm transition-colors ${
          isDark ? 'bg-[#1E293B]/70 border-slate-700/60' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 dark:border-slate-700/60">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" /> Network Alerting & Event Broadcasts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure real-time monitoring thresholds for IP collisions and subnet capacity exhaustion.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Subnet Exhaustion Alerts */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-700/40 bg-slate-900/40">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Subnet Capacity Exhaustion Alerts (&gt;80%)
                </p>
                <p className="text-xs text-slate-400">
                  Receive instant alerts when any CIDR block in {primaryDC?.name || 'your datacenter'} reaches critical utilization.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !exhaustionAlerts;
                  setExhaustionAlerts(next);
                  updateCurrentUser({ exhaustionAlerts: next });
                }}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                  exhaustionAlerts ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  exhaustionAlerts ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* IP Collision Alerts */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-700/40 bg-slate-900/40">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-rose-400" />
                  IP Address Collision & Conflict Detection
                </p>
                <p className="text-xs text-slate-400">
                  Block duplicate IP assignment attempts and log audit warnings immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !collisionAlerts;
                  setCollisionAlerts(next);
                  updateCurrentUser({ collisionAlerts: next });
                }}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                  collisionAlerts ? 'bg-rose-500' : 'bg-slate-700'
                }`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  collisionAlerts ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Email Digest */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-700/40 bg-slate-900/40">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-400" />
                  Daily IPAM Summary & Audit Digest
                </p>
                <p className="text-xs text-slate-400">
                  Send morning report of all created/deleted IPs and VLAN assignments to {email || currentUser.email}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !emailNotifications;
                  setEmailNotifications(next);
                  updateCurrentUser({ emailNotifications: next });
                }}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                  emailNotifications ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  emailNotifications ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
