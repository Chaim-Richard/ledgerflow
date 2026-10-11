import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { TwoStepLoginSettings } from '../../components/platform/settings/SecuritySettings';

/**
 * Shown instead of the books when a workspace this person belongs to requires two-step login and
 * this session has not passed it (Y-30): which workspaces, the authenticator setup, and Continue
 * once it is set up (the setup signs the session in with the code).
 */
export default function TwoStepSetupScreen({ workspaces, onContinue, onSignOut }: {
  workspaces: Array<{ id: string; name: string }>;
  onContinue: () => void;
  onSignOut: () => void;
}) {
  const names = workspaces.map(w => w.name || 'A workspace');
  const list = names.length <= 1 ? names[0] || 'A workspace you belong to' : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return (
    <main className="min-h-[100dvh] bg-[var(--ink)] text-[var(--text)] flex items-start justify-center p-4 sm:p-10">
      <div className="w-full max-w-xl space-y-5">
        <div className="space-y-2">
          <h1 className="text-2xl font-black flex items-center gap-2"><ShieldCheck aria-hidden="true" className="w-6 h-6" /> Set up two-step login</h1>
          <p className="text-sm text-[var(--muted)]">
            {list} {names.length > 1 ? 'require' : 'requires'} two-step login. Add an authenticator app (Google Authenticator, 1Password, Authy…) to your account to continue; you will then sign in with a code from it.
          </p>
        </div>
        <TwoStepLoginSettings />
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onContinue} className="min-h-11 px-5 rounded-xl bg-[var(--text)] text-[var(--ink)] font-bold">Continue</button>
          <button type="button" onClick={onSignOut} className="min-h-11 px-5 rounded-xl border border-[var(--line)]">Sign out</button>
        </div>
      </div>
    </main>
  );
}
