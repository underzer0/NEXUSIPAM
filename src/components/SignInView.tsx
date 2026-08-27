import React, { useState } from 'react';
import { 
  Network, 
  Lock, 
  Mail, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  AlertCircle, 
  Server, 
  UserPlus, 
  Globe2
} from 'lucide-react';
import { useIPAM } from '../context/IPAMContext';
import { BeyondIPLogo } from './BeyondIPLogo';

export const SignInView: React.FC = () => {
  const { signIn, setActiveTab, isDark, users } = useIPAM();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please provide your corporate or engineering email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-[85vh] flex flex-col justify-center items-center px-4 py-8 transition-colors ${
      isDark ? 'text-slate-100' : 'text-slate-900'
    }`}>
      {/* Main Container */}
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="mb-4 transform hover:scale-105 transition-transform duration-200">
            <BeyondIPLogo size="xl" variant="icon" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            BeyondIP
          </h1>
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-1 uppercase tracking-wider">
            Enterprise Edition Authentication
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-xs mx-auto">
            Sign in to manage multi-region datacenters, VLANs, RFC 1918 allocations, and IP directories.
          </p>
        </div>

        {/* Authentication Card */}
        <div className={`rounded-2xl border p-6 sm:p-8 shadow-xl backdrop-blur-sm transition-colors ${
          isDark 
            ? 'bg-[#1E293B]/80 border-slate-700/80 shadow-black/40' 
            : 'bg-white border-slate-200/80 shadow-slate-200/50'
        }`}>
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="signin-email-input"
                  type="email"
                  required
                  placeholder="engineer@nexus.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 transition-all ${
                    isDark 
                      ? 'bg-slate-900/80 border-slate-700 text-white placeholder-slate-500 focus:ring-indigo-500 focus:border-indigo-500' 
                      : 'bg-slate-50/80 border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-indigo-500 focus:border-indigo-500'
                  }`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="signin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-10 pr-11 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 transition-all ${
                    isDark 
                      ? 'bg-slate-900/80 border-slate-700 text-white placeholder-slate-500 focus:ring-indigo-500 focus:border-indigo-500' 
                      : 'bg-slate-50/80 border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-indigo-500 focus:border-indigo-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Security Status */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                />
                <span>Remember this terminal</span>
              </label>

              <div className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>256-bit TLS</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="btn-submit-signin"
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-500/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Workstation</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Sign Up Action */}
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-700/60 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Need a new engineer account?{' '}
              <button
                id="btn-goto-signup"
                type="button"
                onClick={() => setActiveTab('signup')}
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5 inline" />
                <span>Create an account</span>
              </button>
            </p>
          </div>
        </div>

        {/* Security & Infrastructure Footer */}
        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-1">
            <Server className="w-3.5 h-3.5 text-indigo-400" />
            <span>Multi-DC High Availability</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Globe2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>RFC 1918 + Public BGP</span>
          </div>
        </div>
      </div>
    </div>
  );
};
