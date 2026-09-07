import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';

/**
 * Specialized financial rounding to prevent decimal loss in tax calculations
 */
export function roundCents(cents: number): number {
  return Math.sign(cents) * Math.round(Math.abs(cents));
}

/**
 * Safely parses string or numeric monetary inputs into integer cents without floating point precision errors.
 */
export function parseAmountToCents(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    return Math.round(val * 100);
  }
  const cleanStr = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleanStr);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

/**
 * Safe currency formatter with fallback
 */
export function formatCurrency(cents: number | undefined | null, currency?: string): string {
  if (cents === undefined || cents === null || isNaN(cents)) return '$0.00';
  
  let targetCurrency = currency;
  if (!targetCurrency) {
    try {
      targetCurrency = (typeof window !== 'undefined' && (window as any).__ledgerBaseCurrency) || 'USD';
    } catch {
      targetCurrency = 'USD';
    }
  }

  let divisor = 100;
  try {
    const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: targetCurrency });
    if (formatter.resolvedOptions().maximumFractionDigits === 0) {
      divisor = 1;
    }
  } catch (_e) {
    // Unsupported currency fallback
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: targetCurrency,
  }).format(cents / divisor);
}

/**
 * Safe currency formatter for amounts already in dollars
 */
export function formatDollars(dollars: number | undefined | null, currency?: string): string {
  if (dollars === undefined || dollars === null || isNaN(dollars)) return '$0.00';
  return formatCurrency(dollars * 100, currency);
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
 * Returns YYYY-MM-DD string in local user timezone to prevent UTC shift off-by-one errors
 */
export function getLocalDateISO(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into a local midnight Date object
 * Prevents UTC off-by-one errors from standard new Date('YYYY-MM-DD')
 */
export function parseLocalDate(s: string): Date {
  if (!s) return new Date();
  if (s.includes('T')) return new Date(s); // Handle full ISO strings if they somehow appear
  const parts = s.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(s);
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

