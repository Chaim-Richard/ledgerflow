import React, { useEffect, useState } from 'react';

/**
 * Public status page at /status (L-17, BO-06): each part of LedgerFlow and whether it works,
 * from GET /api/v1/public/status. Needs no sign-in, so people can check it when they can't log in.
 */

type ComponentState = 'operational' | 'degraded' | 'down' | 'not_configured';

interface StatusComponent {
  id: string;
  name: string;
  state: ComponentState;
  detail: string;
}

interface SystemStatus {
  state: 'operational' | 'degraded' | 'down';
  checkedAt: string;
  components: StatusComponent[];
}

const STATE_LABEL: Record<ComponentState, string> = {
  operational: 'Working',
  degraded: 'Problems',
  down: 'Not working',
  not_configured: 'Not set up',
};

const STATE_STYLE: Record<ComponentState, string> = {
  operational: 'bg-emerald-100 text-emerald-900',
  degraded: 'bg-amber-100 text-amber-900',
  down: 'bg-red-100 text-red-900',
  not_configured: 'bg-gray-100 text-gray-700',
};

const HEADLINE: Record<SystemStatus['state'], string> = {
  operational: 'Everything is working',
  degraded: 'Some parts have problems',
  down: 'LedgerFlow is not working right now',
};

export default function StatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const [check, setCheck] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch('/api/v1/public/status')
      .then(res => { if (!res.ok) throw new Error(String(res.status)); return res.json() as Promise<SystemStatus>; })
      .then(data => { if (alive) { setStatus(data); setUnreachable(false); } })
      .catch(() => { if (alive) setUnreachable(true); });
    return () => { alive = false; };
  }, [check]);

  // look again every minute
  useEffect(() => {
    const timer = setInterval(() => setCheck(n => n + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const overall: SystemStatus['state'] | null = unreachable ? 'down' : status?.state ?? null;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-1">
          <p className="text-sm font-semibold text-gray-600">LedgerFlow</p>
          <h1 className="text-2xl font-bold">System status</h1>
        </header>

        <section aria-live="polite" className="bg-white rounded-xl border border-gray-200 p-6">
          {overall === null ? (
            <p className="text-gray-700">Checking…</p>
          ) : (
            <>
              <p className={`text-lg font-semibold ${overall === 'operational' ? 'text-emerald-800' : overall === 'degraded' ? 'text-amber-800' : 'text-red-800'}`}>
                {unreachable ? 'The server is not answering' : HEADLINE[overall]}
              </p>
              {status && !unreachable && (
                <p className="text-sm text-gray-600 mt-1">Checked {new Date(status.checkedAt).toLocaleString()}</p>
              )}
            </>
          )}
        </section>

        {status && !unreachable && (
          <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" aria-label="Parts of LedgerFlow">
            {status.components.map(c => (
              <li key={c.id} className="flex items-start justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-gray-600">{c.detail}</p>
                </div>
                <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${STATE_STYLE[c.state]}`}>{STATE_LABEL[c.state]}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between text-sm text-gray-600">
          <button type="button" onClick={() => setCheck(n => n + 1)} className="underline text-gray-800">Check again</button>
          <a href="/" className="underline text-gray-800">Back to LedgerFlow</a>
        </div>
      </div>
    </main>
  );
}
