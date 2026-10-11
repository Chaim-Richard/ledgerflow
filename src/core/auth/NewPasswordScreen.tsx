import React, { useId, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { MIN_PASSWORD_LENGTH, passwordProblem } from '../../lib/passwordPolicy';

/**
 * After a password-reset link (Y-31): the person is signed in by the link and chooses a new
 * password here, typed twice, under the same rules as sign-up, before the app opens.
 */
export default function NewPasswordScreen({ email, onSave, onSignOut }: { email: string; onSave: (password: string) => Promise<void>; onSignOut: () => void }) {
  const id = useId();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(password, email) || (password !== again ? 'The two passwords are not the same' : null);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError('');
    try {
      await onSave(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The password could not be saved');
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full min-h-11 px-3 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-900';
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F9F9F7] p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm" aria-labelledby={`${id}-title`}>
        <h1 id={`${id}-title`} className="text-lg font-semibold text-neutral-900 flex items-center gap-2"><KeyRound aria-hidden="true" className="w-5 h-5" /> Choose a new password</h1>
        <p className="text-sm text-neutral-600">For {email || 'your account'}. At least {MIN_PASSWORD_LENGTH} characters; not a common password or your email name.</p>
        <div className="space-y-1">
          <label htmlFor={`${id}-new`} className="block text-xs font-medium text-neutral-700">New password</label>
          <input id={`${id}-new`} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={field} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-again`} className="block text-xs font-medium text-neutral-700">The same again</label>
          <input id={`${id}-again`} type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} className={field} />
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="w-full min-h-11 rounded-lg bg-neutral-900 text-white font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save the new password'}</button>
        <button type="button" onClick={onSignOut} className="w-full min-h-11 rounded-lg text-sm text-neutral-600 hover:underline">Sign out instead</button>
      </form>
    </main>
  );
}
