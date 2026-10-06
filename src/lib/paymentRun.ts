/**
 * Payment runs (K-24): every open bill due by a date, paid together (one payment per vendor, as the
 * bulk payment does, src/lib/bulkDocuments.ts) and a bank file to upload to the bank: one line per
 * vendor with where the money goes, how much, and which bills it pays. Vendors keep their bank
 * details on their page (account name, account number or IBAN, routing / sort code / BIC).
 */
import { calculateAmountDue } from './documentMath';
import { csvMoney, toCsv } from './csvExport';
import type { PlannedPayment } from './bulkDocuments';

export interface VendorBankDetails {
  accountName?: string;
  /** Account number or IBAN */
  accountNumber?: string;
  /** Routing number, sort code or BIC */
  routingCode?: string;
}

interface RunBill {
  id: string;
  vendorId?: string;
  dueDate?: string;
  date?: string;
  status?: string;
  amountCents?: number;
  amountPaidCents?: number;
  depositCents?: number;
}

const NOT_PAYABLE = new Set(['draft', 'void', 'paid', 'rejected', 'cancelled']);

/** Open bills due on or before `date`, oldest due first. */
export function billsDueBy<B extends RunBill>(bills: B[], date: string): B[] {
  return bills
    .filter(b => !NOT_PAYABLE.has(String(b.status || 'pending')) && calculateAmountDue(b) > 0 && String(b.dueDate || b.date || '').slice(0, 10) <= date)
    .sort((a, b) => String(a.dueDate || a.date || '').localeCompare(String(b.dueDate || b.date || '')));
}

/** Spaces and dashes out, upper case. */
export function normalizeAccountNumber(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase();
}

/** An IBAN's check digits are right (ISO 13616, mod 97). */
export function ibanValid(value: string): boolean {
  const iban = normalizeAccountNumber(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

/** Why an account number can't be right, or null. Something that looks like an IBAN must pass its check. */
export function accountNumberProblem(value: string): string | null {
  const v = normalizeAccountNumber(value);
  if (!v) return null;
  if (!/^[A-Z0-9]{4,34}$/.test(v)) return 'Use letters and digits only (4 to 34)';
  if (/^[A-Z]{2}\d{2}/.test(v) && !ibanValid(v)) return 'This IBAN has a typo (its check digits don’t match)';
  return null;
}

/** "•••• 4321" for people who may not see the full number. */
export function maskAccount(value: string | undefined): string {
  const v = normalizeAccountNumber(value || '');
  return v ? `•••• ${v.slice(-4)}` : '';
}

/** The vendors in the run without an account number to pay into. */
export function missingBankDetails(payments: PlannedPayment[], bank: (vendorId: string) => VendorBankDetails | undefined): PlannedPayment[] {
  return payments.filter(p => !bank(p.partyId)?.accountNumber);
}

const BANK_FILE_HEADERS = ['Payee', 'Account name', 'Account number / IBAN', 'Routing / sort code / BIC', 'Amount', 'Currency', 'Payment date', 'Reference'];

/** The bank file's lines: one per vendor payment (CSV, which online banking imports). */
export function bankFileRows(payments: PlannedPayment[], bank: (vendorId: string) => VendorBankDetails | undefined, options: { date: string; currency: string }): { headers: string[]; rows: string[][] } {
  return {
    headers: BANK_FILE_HEADERS,
    rows: payments.map(p => {
      const b = bank(p.partyId) || {};
      return [
        p.partyName, b.accountName || p.partyName, normalizeAccountNumber(b.accountNumber || ''), normalizeAccountNumber(b.routingCode || ''),
        csvMoney(p.amountCents), options.currency, options.date,
        // what the vendor sees on their statement: the bills it pays (banks cut long references)
        p.allocations.map(a => a.label).join(', ').slice(0, 140),
      ];
    }),
  };
}

export function bankFileCsv(payments: PlannedPayment[], bank: (vendorId: string) => VendorBankDetails | undefined, options: { date: string; currency: string }): string {
  const { headers, rows } = bankFileRows(payments, bank, options);
  return toCsv(headers, rows);
}
