import { useEffect, useId, useRef, useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';
import { useDialog } from '../../hooks/useDialog';
import { sendFeedback, FEEDBACK_APP_VERSION } from '../../lib/feedbackTicket';
import { toast } from 'sonner';
import { pageLabel } from '../../config/pageLabels';

export default function FeedbackWidget() {
  const uid = useAuthStore(s => s.user?.uid);
  const workspaceId = useAuthStore(s => s.currentWorkspaceId);
  return <FeedbackForm key={`${workspaceId}:${uid}`} workspaceId={workspaceId} uid={uid} />;
}
function FeedbackForm({ workspaceId, uid }: { workspaceId: string | null; uid?: string }) {
  const screen = useUIStore(s => s.activeTab);
  const reportTab = useUIStore(s => s.activeReportTab);
  const settingsTab = useUIStore(s => s.activeSettingsTab);
  const [origin, setOrigin] = useState('');
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const inputId = useId();
  const close = () => { if (!pending.current) setOpen(false); };
  const { dialogProps, titleId } = useDialog(close, open);
  const sub = screen === 'reports' ? reportTab : screen === 'settings' ? settingsTab : undefined;
  const path = sub ? `${screen}/${sub}` : screen;
  const currentScreen = `${pageLabel({ tab: screen, sub })} (${path})`;
  useEffect(() => {
    function show() { setOrigin(currentScreen); setError(''); setOpen(true); }
    window.addEventListener('ledgerflow:feedback', show);
    return () => window.removeEventListener('ledgerflow:feedback', show);
  }, [currentScreen]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!workspaceId || !uid || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      await sendFeedback(workspaceId, uid, origin, body);
      const state = useAuthStore.getState();
      if (!mounted.current || state.currentWorkspaceId !== workspaceId || state.user?.uid !== uid) return;
      setBody(''); setOpen(false); toast.success('Feedback saved as a support ticket');
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not send feedback. Your text is kept; try again.'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <>
    {screen !== 'help' && <button type="button" className="fixed bottom-4 right-4 z-[40] min-h-11 px-4 rounded-lg border bg-[var(--surface)] shadow text-sm" onClick={() => { setOrigin(currentScreen); setError(''); setOpen(true); }}>Send feedback</button>}
    {open && <div {...dialogProps} className="fixed inset-0 z-[700] bg-black/60 flex items-center justify-center p-4">
      <form onSubmit={event => void submit(event)} className="bg-[var(--surface)] p-6 rounded-xl w-full max-w-lg space-y-4">
        <h2 id={titleId} className="text-xl font-bold">Send feedback</h2>
        <p className="text-sm">Screen: {origin} · App version: {FEEDBACK_APP_VERSION}</p>
        <label htmlFor={inputId} className="block">What happened?</label>
        <textarea id={inputId} required maxLength={5000} rows={6} className="w-full border rounded p-3" value={body} onChange={event => setBody(event.target.value)} disabled={busy} />
        {!uid && <p role="status">Sign in to a workspace to send feedback. Guest feedback cannot be saved.</p>}
        {error && <p role="alert">{error}</p>}
        <div className="flex flex-wrap gap-3"><button type="button" className="btn-secondary min-h-11" onClick={close} disabled={busy}>Cancel</button><button type="submit" className="btn-primary min-h-11" disabled={busy || !uid || !workspaceId || !body.trim()}>{busy ? 'Sending…' : 'Send'}</button></div>
      </form>
    </div>}
  </>;
}
