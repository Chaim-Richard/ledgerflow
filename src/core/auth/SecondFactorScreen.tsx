import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface SecondFactorScreenProps {
  onVerify: (code: string) => Promise<void>;
  onCancel: () => void;
  /** L-85: uses a recovery code (removes the authenticator); resolves with the error message, or '' when it worked */
  onRecover?: (code: string) => Promise<string>;
}

/** The code step of two-step login, shown after the password when the account has an authenticator app. */
export function SecondFactorScreen({ onVerify, onCancel, onRecover }: SecondFactorScreenProps) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');

  const recover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRecover || recoveryCode.trim().length < 10 || busy) return;
    setBusy(true);
    setError(null);
    const problem = await onRecover(recoveryCode.trim());
    setBusy(false);
    if (problem) setError(problem);
  };

  if (recovering) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F9F9F7] p-6" aria-label="Use a recovery code">
        <form onSubmit={recover} className="w-full max-w-sm bg-white border border-neutral-200 rounded-2xl shadow-sm p-8 space-y-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-700" aria-hidden="true" />
            <h1 className="text-lg font-semibold text-neutral-900">Use a recovery code</h1>
          </div>
          <p className="text-sm text-neutral-600">Enter one of the recovery codes you saved. It works once: it turns off two-step login so you can sign in, then set it up again with your new phone.</p>
          <div className="space-y-1.5">
            <label htmlFor="recovery-code" className="block text-xs font-medium text-neutral-700">Recovery code</label>
            <input id="recovery-code" type="text" autoComplete="off" spellCheck={false} maxLength={20} value={recoveryCode}
              onChange={e => setRecoveryCode(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? 'recovery-error' : undefined}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-center font-mono text-lg text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600" />
            {error && <p id="recovery-error" role="alert" className="text-xs text-red-700">{error}</p>}
          </div>
          <button type="submit" disabled={busy || recoveryCode.trim().length < 10} className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {busy ? 'Checking…' : 'Use this code'}
          </button>
          <button type="button" onClick={() => { setRecovering(false); setError(null); }} className="w-full text-sm text-neutral-600 underline underline-offset-2">
            Back to the authenticator code
          </button>
        </form>
      </main>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onVerify(code);
    } catch {
      setError('That code did not work. Enter the newest code from your authenticator app.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F9F9F7] p-6" aria-label="Two-step verification">
      <form onSubmit={submit} className="w-full max-w-sm bg-white border border-neutral-200 rounded-2xl shadow-sm p-8 space-y-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-700" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-neutral-900">Two-step verification</h1>
        </div>
        <p className="text-sm text-neutral-600">Enter the 6-digit code from your authenticator app.</p>
        <div className="space-y-1.5">
          <label htmlFor="second-factor-code" className="block text-xs font-medium text-neutral-700">Code</label>
          <input
            id="second-factor-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'second-factor-error' : undefined}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-center text-lg tracking-[0.4em] tabular-nums text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          {error && <p id="second-factor-error" role="alert" className="text-xs text-red-700">{error}</p>}
        </div>
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Verify'}
        </button>
        {onRecover && (
          <button type="button" onClick={() => { setRecovering(true); setError(null); }} className="w-full text-sm text-neutral-600 underline underline-offset-2">
            Lost your phone? Use a recovery code
          </button>
        )}
        <button type="button" onClick={onCancel} className="w-full text-sm text-neutral-600 underline underline-offset-2">
          Use a different account
        </button>
      </form>
    </main>
  );
}
