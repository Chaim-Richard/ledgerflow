import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import { useLedgerStore } from '../stores/useLedgerStore';

/**
 * Specialized financial rounding to prevent decimal loss in tax calculations
 */
export function roundCents(cents: number): number {
  return Math.round(cents);
}

/**
 * Safe currency formatter with fallback
 */
export function formatCurrency(cents: number | undefined | null, currency?: string): string {
  if (cents === undefined || cents === null || isNaN(cents)) return '$0.00';
  
  let targetCurrency = currency;
  if (!targetCurrency) {
    try {
      targetCurrency = useLedgerStore.getState().baseCurrency || 'USD';
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
  } catch (e) {}

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
 * Returns YYYY-MM-DD string in local user timezone to prevent UTC shift off-by-one errors
 */
export function getLocalDateISO(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  if (typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(String(value))) return String(value);
  let str = String(value);
  // If string starts with formula trigger characters, prefix with single quote
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  // Escape double quotes and enclose in quotes
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
 */
export function safeConfirm(message: string): boolean {
  try {
    // If window is available and confirm exists, use it
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(message);
    }
    return true;
  } catch (error) {
    console.warn('[SANDBOX CAUGHT] window.confirm execution prevented by environment. Auto-approving request.', error);
    return true;
  }
}
