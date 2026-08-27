import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { 
  UserPlus, 
  Mail, 
  Lock, 
  User, 
  Building2, 
  Server, 
  MapPin, 
  Phone, 
  CheckCircle, 
  AlertTriangle, 
  ShieldCheck, 
  Sparkles, 
  ArrowLeft,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';

export const SignUpView: React.FC = () => {
  const { signUpUser, setActiveTab, datacenters, isDark } = useIPAM();

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('Senior Network Engineer');
  const [department, setDepartment] = useState('Infrastructure Engineering');
  const [organization, setOrganization] = useState('BeyondIP Enterprise');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [primaryDatacenterId, setPrimaryDatacenterId] = useState(datacenters[0]?.id || '');
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score += 25;
    if (/[A-Z]/.test(pass)) score += 25;
    if (/[0-9]/.test(pass)) score += 25;
    if (/[^A-Za-z0-9]/.test(pass)) score += 25;
    return score;
  };

  const strengthScore = getPasswordStrength(password);

  const getStrengthLabel = (score: number) => {
    if (score <= 25) return { label: 'Weak', color: 'bg-rose-500 text-rose-400' };
    if (score <= 50) return { label: 'Fair', color: 'bg-amber-500 text-amber-400' };
    if (score <= 75) return { label: 'Good', color: 'bg-blue-500 text-blue-400' };
    return { label: 'Strong (Enterprise Ready)', color: 'bg-emerald-500 text-emerald-400' };
  };

  const strengthInfo = getStrengthLabel(strengthScore);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!name.trim()) {
      setErrorMessage('Please provide your Full Name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid enterprise email address.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must contain at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    if (!agreedToTerms) {
      setErrorMessage('Please agree to the Enterprise Network Security and Access Policy.');
      return;
    }

    setIsSubmitting(true);

    try {
      await signUpUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role.trim(),
        department: department.trim(),
        organization: organization.trim(),
        location: location.trim(),
        phone: phone.trim(),
        primaryDatacenterId: primaryDatacenterId || (datacenters[0]?.id || ''),
        password,
      });

      // Redirect directly to User Profile view
      setActiveTab('profile');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleOptions = [
    'Principal Network Architect',
    'Senior Network Engineer',
    'Cloud Infrastructure Lead',
    'SecOps Administrator',
    'Site Reliability Engineer (SRE)',
    'DevOps Automation Engineer',
    'Datacenter Operations Specialist',
    'Network Operations Center (NOC) Analyst',
    'Systems & Network Administrator',
    'Infrastructure Security Lead'
  ];

  return (
    <div id="signup-page" className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-fadeIn pb-24 md:pb-12">
      
      {/* Top Header Card */}
      <div className={`rounded-2xl border p-6 shadow-xl relative overflow-hidden transition-all ${
        isDark 
          ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/50 border-slate-700/60' 
          : 'bg-gradient-to-r from-white via-indigo-50/40 to-purple-50/40 border-slate-200'
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Create Engineer Account
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Enterprise Access
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Register a new network architect or systems engineer to manage IP allocations and subnets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('signin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                isDark ? 'border-slate-700 text-indigo-400 hover:bg-slate-800' : 'border-slate-300 text-indigo-600 hover:bg-slate-100'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center gap-3 animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className={`rounded-2xl border p-6 shadow-sm transition-colors ${
          isDark ? 'bg-[#1E293B]/70 border-slate-700/60' : 'bg-white border-slate-200'
        }`}>
          
          <h2 className="text-base font-semibold text-slate-900 dark:text-white pb-3 mb-5 border-b border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" /> Account Credentials & Identity
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="signup-input-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Elena Vance"
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
                  id="signup-input-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. e.vance@nexus.io"
                  className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                    isDark 
                      ? 'bg-slate-900/90 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                  }`}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Password <span className="text-rose-500">*</span></span>
                {password && (
                  <span className={`text-[10px] font-bold ${strengthInfo.color}`}>
                    {strengthInfo.label}
                  </span>
                )}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="signup-input-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={`w-full pl-9 pr-10 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                    isDark 
                      ? 'bg-slate-900/90 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Bar */}
              {password && (
                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      strengthScore <= 25 ? 'bg-rose-500' :
                      strengthScore <= 50 ? 'bg-amber-500' :
                      strengthScore <= 75 ? 'bg-blue-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${strengthScore}%` }}
                  />
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Confirm Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="signup-input-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                    isDark 
                      ? 'bg-slate-900/90 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                  }`}
                />
              </div>
            </div>
          </div>

          <h2 className="text-base font-semibold text-slate-900 dark:text-white pt-6 pb-3 my-5 border-t border-slate-200 dark:border-slate-700/60 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" /> Role & Datacenter Affiliation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Role */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Engineering Role / Specialization
              </label>
              <select
                id="signup-select-role"
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

            {/* Primary Datacenter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Primary Datacenter Assignment
              </label>
              <div className="relative">
                <Server className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  id="signup-select-dc"
                  value={primaryDatacenterId}
                  onChange={(e) => setPrimaryDatacenterId(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                    isDark 
                      ? 'bg-slate-900/90 border-slate-700 text-white focus:border-indigo-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500'
                  }`}
                >
                  {datacenters.length === 0 ? (
                    <option value="">Default / Unassigned (Can create Datacenter later)</option>
                  ) : (
                    datacenters.map(dc => (
                      <option key={dc.id} value={dc.id}>
                        {dc.name} — {dc.location}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Department
              </label>
              <input
                id="signup-input-department"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Core Infrastructure Engineering"
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
                Geographic Office / Base
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="signup-input-location"
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
          </div>

          {/* Terms & Compliance */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700/60">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-400">
                I agree to the <span className="text-indigo-400 font-medium">Enterprise Infrastructure Access Policy</span>. All IP allocation actions, subnet updates, and deletion events are permanently logged in the IPAM audit trail.
              </span>
            </label>
          </div>

          {/* Submit Actions */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setActiveTab('signin')}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Already registered? <span className="text-indigo-400 font-semibold underline">Sign In with your credentials</span>
            </button>

            <button
              id="btn-submit-signup"
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating Account...' : 'Create Enterprise Account'}</span>
            </button>
          </div>

        </div>
      </form>

    </div>
  );
};
