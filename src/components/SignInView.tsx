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
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Beyond<span className={`text-transparent bg-clip-text font-extrabold ${isDark ? 'bg-gradient-to-r from-indigo-400 via-cyan-400 to-teal-300' : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600'}`}>IP</span>
          </h1>
          <p className={`text-xs font-semibold mt-1 uppercase tracking-wider ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
            Enterprise Edition Authentication
          </p>
          <p className={`text-xs mt-2 max-w-xs mx-auto ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Sign in to manage multi-region datacenters, VLANs, RFC 1918 allocations, and IP directories.
          </p>
        </div>

        {/* Authentication Card */}
        <div className={`rounded-2xl border p-6 sm:p-8 shadow-xl backdrop-blur-sm transition-colors ${
          isDark 
            ? 'bg-slate-800/90 border-slate-700 shadow-black/40' 
            : 'bg-white border-slate-200 shadow-slate-200/50'
        }`}>
          {errorMessage && (
            <div className={`mb-5 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn ${
              isDark ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed font-medium">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                Work Email Address
              </label>
              <div className="relative">
                <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
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
                      ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:ring-indigo-500 focus:border-indigo-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-indigo-500 focus:border-indigo-500'
                  }`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`block text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  Password
                </label>
              </div>
              <div className="relative">
                <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
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
                      ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:ring-indigo-500 focus:border-indigo-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-indigo-500 focus:border-indigo-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute inset-y-0 right-0 pr-3.5 flex items-center transition-colors cursor-pointer ${
                    isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Security Status */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className={`flex items-center gap-2 cursor-pointer select-none ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-400 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                />
                <span>Remember this terminal</span>
              </label>

              <div className={`flex items-center gap-1 text-[11px] font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>256-bit TLS</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="btn-submit-signin"
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2 cursor-pointer shadow-md shadow-indigo-500/20"
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
          <div className={`mt-6 pt-5 border-t text-center ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Need a new engineer account?{' '}
              <button
                id="btn-goto-signup"
                type="button"
                onClick={() => setActiveTab('signup')}
                className={`font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer ${
                  isDark ? 'text-indigo-400' : 'text-indigo-600'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 inline" />
                <span>Create an account</span>
              </button>
            </p>
          </div>
        </div>

        {/* Security & Infrastructure Footer */}
        <div className={`mt-8 flex items-center justify-center gap-4 text-[11px] font-mono ${
          isDark ? 'text-slate-400' : 'text-slate-600'
        }`}>
          <div className="flex items-center gap-1">
            <Server className={`w-3.5 h-3.5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            <span>Multi-DC High Availability</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Globe2 className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <span>RFC 1918 + Public BGP</span>
          </div>
        </div>
      </div>
    </div>
  );
};
