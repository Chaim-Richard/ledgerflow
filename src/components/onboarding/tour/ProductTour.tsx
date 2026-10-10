import React, { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useUIStore } from '../../../stores/useUIStore';
import { useDialog } from '../../../hooks/useDialog';
import { markTourDone, TOUR_EVENT, TOUR_STEPS, tourDone } from '../../../lib/productTour';

/**
 * The product tour (P-08): opens once for a signed-in person whose workspace is set up and who has not
 * seen it in this browser, and whenever Help → "Take the tour" asks. Each step can show its screen;
 * Back, Next and Skip; Escape skips. A dialog: announced, keyboard only, focus returns after.
 */
export default function ProductTour() {
  const uid = useAuthStore(s => s.user?.uid);
  const isGuest = useAuthStore(s => s.isGuest);
  const setupDone = useAuthStore(s => Boolean(s.getCurrentWorkspace()?.setupCompletedAt));
  const goToPage = useUIStore(s => s.goToPage);
  // asked for from Help, or closed in this session
  const [asked, setAsked] = useState(false);
  const [closed, setClosed] = useState(false);
  const [step, setStep] = useState(0);
  const firstRun = Boolean(uid && !isGuest && setupDone && !tourDone(uid));
  const open = asked || (firstRun && !closed);

  useEffect(() => {
    const start = () => { setStep(0); setAsked(true); };
    window.addEventListener(TOUR_EVENT, start);
    return () => window.removeEventListener(TOUR_EVENT, start);
  }, []);

  const close = useCallback(() => { if (uid) markTourDone(uid); setAsked(false); setClosed(true); }, [uid]);
  const { dialogProps, titleId } = useDialog(close, open);
  if (!open) return null;
  const current = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;

  return (
    <div {...dialogProps} className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xl space-y-3">
        <p className="text-xs text-[var(--muted)]">Step {step + 1} of {TOUR_STEPS.length}</p>
        <h2 id={titleId} className="text-lg font-bold text-[var(--text)]">{current.title}</h2>
        <p className="text-sm text-[var(--text)]">{current.text}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <button type="button" onClick={close} className="text-sm text-[var(--muted)] hover:underline">Skip the tour</button>
          <div className="flex gap-2">
            {current.page && (
              <button type="button" onClick={() => goToPage(current.page!)} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-semibold text-[var(--text)]">Show me</button>
            )}
            {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-semibold text-[var(--text)]">Back</button>}
            <button type="button" onClick={() => (last ? close() : setStep(step + 1))} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white">{last ? 'Done' : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
