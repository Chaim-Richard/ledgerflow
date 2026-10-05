import { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import type { Bill, RecurringTransaction, Vendor } from '../../types';
import { cadenceLabel, expectedBills, scheduledBillVendors, type ExpectedBill } from '../../lib/expectedBills';
import { formatCurrency, formatDate, getLocalDateISO } from '../../lib/utils';

interface ExpectedBillsProps {
  bills: Bill[];
  vendors: Vendor[];
  schedules: RecurringTransaction[];
  canEdit: boolean;
  /** Opens the bill form for this vendor (filled from their latest bill). */
  onRecord: (expected: ExpectedBill) => void;
  /** "Not expected any more": the vendor stops being watched. */
  onDismiss: (expected: ExpectedBill) => void;
}

/**
 * Bills that should have arrived, or will soon (K-21), above the bill list. Learned from the
 * vendor's own rhythm; "Record bill" opens the bill form with their latest bill's lines.
 */
export default function ExpectedBills({ bills, vendors, schedules, canEdit, onRecord, onDismiss }: ExpectedBillsProps) {
  const today = getLocalDateISO();
  const expected = useMemo(() => expectedBills(bills, vendors, today, { scheduledVendorIds: scheduledBillVendors(schedules as never) }), [bills, vendors, schedules, today]);
  if (!expected.length) return null;
  const amount = (e: ExpectedBill) => (e.minCents === e.maxCents
    ? formatCurrency(e.typicalCents, e.currency)
    : `${formatCurrency(e.minCents, e.currency)}–${formatCurrency(e.maxCents, e.currency)}`);
  return (
    <section aria-labelledby="expected-bills-title" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 id="expected-bills-title" className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
        <CalendarClock aria-hidden="true" className="h-4 w-4" /> Expected bills
      </h2>
      <ul className="mt-2 divide-y divide-[var(--line)]">
        {expected.map(e => (
          <li key={e.vendorId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="text-[var(--text)]">
              <span className="font-semibold">{e.vendorName}</span>{' '}
              <span className="text-[var(--muted)]">usually {amount(e)}, {cadenceLabel(e.cadenceDays)} · last {formatDate(e.lastDate)}</span>{' '}
              <span className={e.late ? 'font-semibold text-[var(--neg)]' : 'text-[var(--muted)]'}>
                {e.late ? `expected ${formatDate(e.expectedDate)}, ${e.daysLate} day${e.daysLate === 1 ? '' : 's'} late` : `expected by ${formatDate(e.expectedDate)}`}
              </span>
            </span>
            {canEdit && (
              <span className="flex gap-2">
                <button type="button" onClick={() => onRecord(e)} aria-label={`Record the bill from ${e.vendorName}`}
                  className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-bold hover:border-[var(--brass-line)]">Record bill</button>
                <button type="button" onClick={() => onDismiss(e)} aria-label={`Stop expecting bills from ${e.vendorName}`}
                  className="rounded-md px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]">Not expected</button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
