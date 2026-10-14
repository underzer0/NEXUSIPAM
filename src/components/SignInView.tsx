import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useIPAM } from '../context/IPAMContext';
import { BeyondIPLogo } from './BeyondIPLogo';
import { card, input, linkButton, muted, primaryButton } from './ui';

// Shared frame for the sign-in and sign-up pages.
export const AuthShell: React.FC<{ title: string; error: string | null; footer: React.ReactNode; children: React.ReactNode }> = ({
  title,
  error,
  footer,
  children,
}) => (
  <div className="flex min-h-[85vh] items-center justify-center px-4 py-10">
    <div className="w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <BeyondIPLogo size="xl" variant="icon" />
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
      </div>
      <div className={`${card} space-y-5 p-6`}>
        {error && (
          <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}
        {children}
      </div>
      <p className={`text-center text-sm ${muted}`}>{footer}</p>
    </div>
  </div>
);

export const PasswordInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${input} w-full pr-10`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};

export const fieldLabel = 'text-sm font-medium text-slate-700 dark:text-slate-300';

export const SignInView: React.FC = () => {
  const { signIn, setActiveTab } = useIPAM();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      setErrorMessage(err.message || 'Sign-in failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in to BeyondIP"
      error={errorMessage}
      footer={
        <>
          New here?{' '}
          <button id="btn-goto-signup" type="button" onClick={() => setActiveTab('signup')} className={linkButton}>
            Create an account
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className={fieldLabel}>Email</span>
          <input
            id="signin-email-input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${input} w-full`}
          />
        </label>
        <label className="block space-y-1.5">
          <span className={fieldLabel}>Password</span>
          <PasswordInput id="signin-password-input" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button id="btn-submit-signin" type="submit" disabled={isLoading} className={`${primaryButton} w-full disabled:opacity-50`}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
};
