import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { AuthShell, PasswordInput, fieldLabel } from './SignInView';
import { input, linkButton, primaryButton } from './ui';

export const SignUpView: React.FC = () => {
  const { signUpUser, setActiveTab } = useIPAM();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    // Same 6-character minimum the server enforces.
    if (password.length < 6) return setErrorMessage('Use at least 6 characters for your password.');
    if (password !== confirmPassword) return setErrorMessage('The passwords don’t match.');

    setIsSubmitting(true);
    try {
      await signUpUser({ name: name.trim(), email: email.trim().toLowerCase(), password });
      // Role, team and location are filled in on the profile page.
      setActiveTab('profile');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create the account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      error={errorMessage}
      footer={
        <>
          Already have an account?{' '}
          <button type="button" onClick={() => setActiveTab('signin')} className={linkButton}>
            Sign in
          </button>
        </>
      }
    >
      <form id="signup-page" onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className={fieldLabel}>Name</span>
          <input id="signup-input-name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={`${input} w-full`} />
        </label>
        <label className="block space-y-1.5">
          <span className={fieldLabel}>Email</span>
          <input
            id="signup-input-email"
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
          <PasswordInput id="signup-input-password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className={fieldLabel}>Confirm password</span>
          <PasswordInput
            id="signup-input-confirm-password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>
        <button id="btn-submit-signup" type="submit" disabled={isSubmitting} className={`${primaryButton} w-full disabled:opacity-50`}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
};
