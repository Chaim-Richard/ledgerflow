import React, { useEffect, useState } from 'react';
import { formatDuration, timerMinutes } from '../../lib/timeEntries';

const key = (workspaceId: string) => `lf_time_timer:${workspaceId}`;
interface Running { startedAt: number; description: string }
function read(workspaceId: string): Running | null {
  try {
    const v = JSON.parse(localStorage.getItem(key(workspaceId)) || 'null');
    return v && typeof v.startedAt === 'number' ? { startedAt: v.startedAt, description: String(v.description || '') } : null;
  } catch { return null; }
}

/**
 * The timer (V-02) on Time: Start, and it runs in this browser even if the page is closed; Stop
 * puts how long it ran (whole minutes, rounded up) and what it was for into the Log time form.
 */
export default function TimeTimer({ workspaceId, description, onStop }: { workspaceId: string; description: string; onStop: (minutes: number, description: string) => void }) {
  const [running, setRunning] = useState<Running | null>(() => read(workspaceId));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = () => {
    const next = { startedAt: Date.now(), description };
    setRunning(next);
    setNow(next.startedAt);
    try { localStorage.setItem(key(workspaceId), JSON.stringify(next)); } catch { /* runs for this visit only */ }
  };
  const stop = () => {
    if (!running) return;
    onStop(timerMinutes(running.startedAt, Date.now()), running.description);
    setRunning(null);
    try { localStorage.removeItem(key(workspaceId)); } catch { /* nothing kept */ }
  };
  const seconds = running ? Math.max(0, Math.floor((now - running.startedAt) / 1000)) : 0;
  return running ? (
    <div className="flex items-center gap-2 text-sm">
      <span role="timer" aria-label="Timer" className="font-mono text-[var(--text)]">{formatDuration(Math.floor(seconds / 60))}:{String(seconds % 60).padStart(2, '0')}</span>
      {running.description && <span className="text-xs text-[var(--muted)]"><bdi>{running.description}</bdi></span>}
      <button type="button" onClick={stop} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">Stop the timer</button>
    </div>
  ) : (
    <button type="button" onClick={start} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]">Start a timer</button>
  );
}
