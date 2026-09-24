import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import { useAuthStore } from '../stores/useAuthStore';

// Set default rounding mode to HALF_UP (standard financial rounding)
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

/**
 * Specialized financial rounding using Decimal.js to prevent half-cent floating point drift.
 */
export function roundCents(cents: number | string): number {
  if (typeof cents === 'number' && isNaN(cents)) return 0;
  return new Decimal(cents || 0).round().toNumber();
}

/**
 * Safely converts monetary values with exchange rates or tax factors to exact integer cents.
 */
export function calculateFXCents(amountCents: number, exchangeRate: number): number {
  if (!exchangeRate || exchangeRate <= 0) return roundCents(amountCents);
  return new Decimal(amountCents).mul(exchangeRate).round().toNumber();
}

/**
 * Safely parses string or numeric monetary inputs into integer cents without floating point precision errors.
 */
export function parseAmountToCents(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    return new Decimal(val).mul(100).round().toNumber();
  }
  const cleanStr = String(val).replace(/[^0-9.-]/g, '');
  if (!cleanStr || cleanStr === '-') return 0;
  return new Decimal(cleanStr).mul(100).round().toNumber();
}

/**
 * Known 3-decimal currencies per ISO 4217:
 * KWD (Kuwaiti Dinar), BHD (Bahraini Dinar), OMR (Omani Rial),
 * JOD (Jordanian Dinar), TND (Tunisian Dinar), LYD (Libyan Dinar), IQD (Iraqi Dinar).
 */
export const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND', 'IQD']);

export function getCurrencyFractionDigits(currency?: string): number {
  const code = currency?.toUpperCase();
  if (code && THREE_DECIMAL_CURRENCIES.has(code)) {
    return 3;
  }
  if (!code) return 2;
  try {
    const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: code });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
    return typeof fractionDigits === 'number' ? fractionDigits : 2;
  } catch {
    return 2;
  }
}

export function getCurrencyDivisor(currency?: string): number {
  const digits = getCurrencyFractionDigits(currency);
  return Math.pow(10, digits);
}

/**
 * Safe currency formatter with fallback
 */
export function formatCurrency(cents: number | undefined | null, currency?: string): string {
  let targetCurrency = currency;
  if (!targetCurrency) {
    try {
      targetCurrency = (typeof window !== 'undefined' && (window as any).__ledgerBaseCurrency) || 'USD';
    } catch {
      targetCurrency = 'USD';
    }
  }

  const safeCents = (cents === undefined || cents === null || isNaN(cents)) ? 0 : cents;
  const digits = getCurrencyFractionDigits(targetCurrency);
  const divisor = Math.pow(10, digits);

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: targetCurrency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(safeCents / divisor);
  } catch (_e) {
    return `${targetCurrency} ${(safeCents / divisor).toFixed(digits)}`;
  }
}

/**
 * Safe currency formatter for amounts already in dollars / major units
 */
export function formatDollars(dollars: number | undefined | null, currency?: string): string {
  const safeDollars = (dollars === undefined || dollars === null || isNaN(dollars)) ? 0 : dollars;
  const divisor = getCurrencyDivisor(currency);
  return formatCurrency(safeDollars * divisor, currency);
}

/**
 * Masks sensitive PII (Personally Identifiable Information) for Display
 */
export function maskPII(text: string | undefined | null): string {
  if (!text) return "";
  if (text.includes('@')) {
    const parts = text.split('@');
    if (parts.length >= 2) {
      const user = parts[0];
      const domain = parts.slice(1).join('@');
      return `${user.slice(0, 2)}***@${domain}`;
    }
  }
  // Mask potential account numbers
  const digitsOnly = text.replace(/[\s-]/g, '');
  if (/^\d{8,20}$/.test(digitsOnly)) {
    return `****${digitsOnly.slice(-4)}`;
  }
  return text;
}

/**
 * Accurately formats a cents value into a string representing decimal dollars without binary float issues.
 * Used for CSV exports. Example: 1005 -> "10.05"
 */
export function formatDecimal(cents: number): string {
  if (cents === null || cents === undefined || isNaN(cents)) return "0.00";
  const isNegative = cents < 0;
  const absCents = Math.abs(Math.round(cents));
  const dollars = Math.floor(absCents / 100);
  const remainder = absCents % 100;
  return `${isNegative && absCents > 0 ? '-' : ''}${dollars}.${remainder.toString().padStart(2, '0')}`;
}

/**
 * Returns YYYY-MM-DD string in workspace or local user timezone to prevent UTC shift off-by-one errors
 */
export function getLocalDateISO(d: Date = new Date()): string {
  let timezone = '';
  try {
    const state = useAuthStore.getState();
    const activeWorkspace = state?.workspaces?.find((w: any) => w.id === state?.currentWorkspaceId);
    if (activeWorkspace?.timezone) {
      timezone = activeWorkspace.timezone;
    }
  } catch (_e) {
    // Fallback if store is not yet accessible
  }

  if (!timezone) {
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      timezone = 'UTC';
    }
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (y && m && day) {
      return `${y}-${m}-${day}`;
    }
  } catch (_e) {
    // Fallback to standard local Date string formatting
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into a timezone-midnight Date object
 * Prevents UTC off-by-one errors from standard new Date('YYYY-MM-DD')
 */
export function parseLocalDate(s: string): Date {
  if (!s) return new Date();
  let parts: number[] = [];
  if (s.includes('T')) {
    const dObj = new Date(s);
    parts = [dObj.getFullYear(), dObj.getMonth() + 1, dObj.getDate()];
  } else {
    const splitParts = s.split('-');
    if (splitParts.length === 3) {
      parts = splitParts.map(Number);
    }
  }

  if (parts.length === 3) {
    const [y, m, d] = parts;
    const localDate = new Date(y, m - 1, d, 0, 0, 0, 0);

    let timezone = '';
    try {
      const state = useAuthStore.getState();
      const activeWorkspace = state?.workspaces?.find((w: any) => w.id === state?.currentWorkspaceId);
      if (activeWorkspace?.timezone) {
        timezone = activeWorkspace.timezone;
      }
    } catch {
      // Fallback if auth store is unavailable
    }

    if (!timezone) {
      try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      } catch {
        timezone = 'UTC';
      }
    }

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      });

      const utcDateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00Z`;
      const tempDate = new Date(utcDateStr);
      
      const partsArr = formatter.formatToParts(tempDate);
      const fY = Number(partsArr.find(p => p.type === 'year')?.value);
      const fM = Number(partsArr.find(p => p.type === 'month')?.value);
      const fD = Number(partsArr.find(p => p.type === 'day')?.value);
      const fH = Number(partsArr.find(p => p.type === 'hour')?.value);
      const fMin = Number(partsArr.find(p => p.type === 'minute')?.value);

      const formattedDate = new Date(fY, fM - 1, fD, fH, fMin, 0, 0);
      const offsetMs = tempDate.getTime() - formattedDate.getTime();
      
      return new Date(localDate.getTime() + offsetMs);
    } catch (_e) {
      return localDate;
    }
  }
  return new Date(s);
}

export function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? parseLocalDate(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes a string value against CSV/Formula injection attacks.
 * Prevents execution of spreadsheet formulas starting with =, +, -, @, \t, \r
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'number') return String(value);
  
  let str = String(value);
  
  // Purely formatted numbers (like -1,000.00 or -$50.00) are safe from formula injection
  const isSafeNumber = /^-?\$?\s*\d{1,3}(,?\d{3})*(\.\d+)?$/.test(str);
  
  if (!isSafeNumber && /^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  
  return `"${str.replace(/"/g, '""')}"`;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
  AUTH = 'auth',
  SYNC = 'sync'
}

export interface AppErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  timestamp: string;
  context?: Record<string, any>;
  stack?: string;
}

/**
 * Enhanced Error Logger
 * Captures deep context for forensic debugging
 */
export function reportError(error: unknown, operationType: OperationType, path: string | null = null, context?: Record<string, any>) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  
  const errInfo: AppErrorInfo = {
    error: message,
    operationType,
    path,
    timestamp: new Date().toISOString(),
    context,
    stack
  };

  console.error(`[FORENSIC ERROR] ${(operationType || 'UNKNOWN').toUpperCase()}:`, JSON.stringify(errInfo, null, 2));
  
  // UI Feedback
  toast.error(`SYSTEM ERROR: ${(operationType || 'UNKNOWN').toUpperCase()}`, {
    description: message.length > 100 ? message.slice(0, 100) + '...' : message
  });

  return errInfo;
}

/**
 * Async Safety Wrapper
 * Automatically handles errors and reports them
 */
export async function safeAsync<T>(
  promise: Promise<T>, 
  operationType: OperationType, 
  path: string | null = null,
  context?: Record<string, any>
): Promise<[T | null, AppErrorInfo | null]> {
  try {
    const result = await promise;
    return [result, null];
  } catch (error) {
    const errInfo = reportError(error, operationType, path, context);
    return [null, errInfo];
  }
}

/**
 * Reliability Engine: Execute async function with exponential backoff retry logic.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 500
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      if (attempt > maxRetries || (error?.code && error.code === 'permission-denied')) {
        throw error;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
      console.warn(`[RETRY] Operation failed (Attempt ${attempt}/${maxRetries}). Retrying in ${delay.toFixed(0)}ms...`, error);
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

/**
 * Safe confirmation modal dialog helper.
 * Degrades gracefully inside sandboxed browser iframes where window.confirm causes SecurityError.
 * Fails closed (returns false) to prevent accidental execution of destructive actions.
 */
export function safeConfirm(message: string): boolean {
  try {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(message);
    }
    return false;
  } catch (error) {
    console.warn('[SANDBOX CAUGHT] window.confirm execution prevented by environment. Refusing destructive action for safety.', error);
    return false;
  }
}

/**
 * Resolves account name dynamically from chart of accounts using accountId first,
 * falling back to line.accountName or line.accountId if deleted/archived.
 */
export function resolveAccountName(accounts: any[], accountId?: string, fallbackName?: string): string {
  if (!accountId && !fallbackName) return 'Uncategorized';
  if (accountId && Array.isArray(accounts)) {
    const matched = accounts.find(a => a.id === accountId);
    if (matched?.name) return matched.name;
  }
  return fallbackName || accountId || 'Uncategorized';
}



/**
 * Formats a Date into YYYY-MM-DD for a specific timezone (e.g., 'America/New_York', 'Pacific/Auckland').
 */
export function formatTzDate(d: Date = new Date(), timezone = 'UTC'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d); // Output: YYYY-MM-DD in en-CA locale
  } catch (err) {
    return d.toISOString().split('T')[0];
  }
}

