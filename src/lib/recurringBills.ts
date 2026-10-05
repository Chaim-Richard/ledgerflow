/**
 * Recurring bills (BE-08): the schedule saved when a new bill is set to repeat. The daily job
 * (src/server/services/recurringService.ts) copies the bill as a draft on each next date; the
 * team checks it (adds the vendor's bill number) and saves it, which posts it like any bill.
 */
import type { Bill, RecurringTransaction } from '../types';
import { calculateNextOccurrence } from './recurringEngine';
import { getLocalDateISO } from './utils';

const DAY_MS = 86_400_000;

export function recurringBillSchedule(bill: Partial<Bill>, frequency: RecurringTransaction['frequency']) {
  const start = (bill.date || getLocalDateISO()).slice(0, 10);
  const anchorDay = Number(start.split('-')[2]) || 1;
  const due = bill.dueDate ? String(bill.dueDate).slice(0, 10) : '';
  const dueDays = due ? Math.max(0, Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS)) : 30;
  // what is copied each time: the vendor, lines, tax and currency (not the number, dates, status or payments)
  const { id: _id, number: _number, status: _status, date: _date, dueDate: _due, amountPaidCents: _paid, settledByRecordsCents: _settled,
    paymentDate: _paymentDate, paidAt: _paidAt, paymentToken: _token, reversalEventId: _reversal, isLocked: _locked, lockedAt: _lockedAt,
    posted: _posted, createdAt: _created, updatedAt: _updated, metadata: _metadata, ...billTemplate } = bill;
  return {
    description: `Recurring bill: ${bill.vendorName || 'Vendor'}`,
    amountCents: bill.amountCents || 0,
    frequency,
    nextOccurrence: calculateNextOccurrence(start, frequency, anchorDay),
    anchorDay,
    isActive: true,
    status: 'active',
    type: 'bill',
    payee: bill.vendorName || '',
    billTemplate: { ...billTemplate, dueDays },
    template: { description: `Bill: ${bill.vendorName || 'Vendor'}`, amountCents: bill.amountCents || 0, vendorId: bill.vendorId, tags: ['recurring', 'bill'] },
  };
}
