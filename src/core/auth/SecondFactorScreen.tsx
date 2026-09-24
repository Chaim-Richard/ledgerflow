import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface SecondFactorScreenProps {
  onVerify: (code: string) => Promise<void>;
  onCancel: () => void;
}

/** The code step of two-step login, shown after the password when the account has an authenticator app. */
export function SecondFactorScreen({ onVerify, onCancel }: SecondFactorScreenProps) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <button type="button" onClick={onCancel} className="w-full text-sm text-neutral-600 underline underline-offset-2">
          Use a different account
        </button>
      </form>
    </main>
  );
}
