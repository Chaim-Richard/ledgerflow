import { FlaskConical } from 'lucide-react';
import { testEnvironmentBannerShown } from '../../lib/testEnvironment';

/**
 * G-05: the invited testers' builds say plainly that they are a test environment for made-up books, and how to report
 * a problem (G-06: the existing feedback form, `ledgerflow:feedback`). When it shows: src/lib/testEnvironment.ts.
 */
export default function TestEnvironmentBanner({ shown = testEnvironmentBannerShown() }: { shown?: boolean }) {
  if (!shown) return null;
  return (
    <div role="note" aria-label="Test environment"
      className="shrink-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-1.5 bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-50 text-xs sm:text-sm border-b border-amber-300 dark:border-amber-700">
      <FlaskConical aria-hidden="true" className="w-4 h-4 shrink-0" />
      <span><strong>Test environment.</strong> Use made-up books only: no real customers, payments or tax filings.</span>
      <button type="button" onClick={() => window.dispatchEvent(new window.Event('ledgerflow:feedback'))}
        className="min-h-8 px-2 rounded underline underline-offset-2 font-semibold hover:bg-amber-200 dark:hover:bg-amber-800">
        Report a problem
      </button>
    </div>
  );
}
