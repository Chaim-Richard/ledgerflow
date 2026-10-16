/** Shared validation helpers for operational warehouse records. */
export interface WorkflowActor {
  uid: string;
  name: string;
  role: string;
}

export function encodedPathPart(value: string): string {
  try {
    // encodeURIComponent leaves dots alone, but a dot in a Supabase JSON-path segment is a separator.
    return encodeURIComponent(value).replace(/\./g, '%2E');
  } catch {
    // A lone UTF-16 surrogate is invalid for encodeURIComponent; encode every code unit losslessly.
    let encoded = '';
    for (let index = 0; index < value.length; index += 1) encoded += value.charCodeAt(index).toString(16).padStart(4, '0');
    return encoded;
  }
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

export function isIsoTime(value: string): boolean {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

export function isWorkspaceWriter(actor: WorkflowActor): boolean {
  return Boolean(actor.uid.trim()) && ['owner', 'accountant', 'bookkeeper'].includes(actor.role);
}

export function displayName(value: string): string {
  return value.trim().slice(0, 120);
}

const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomWarehouseToken(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('Secure ID generation is unavailable in this browser.');
  const bytes = new Uint8Array(12);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, byte => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]).join('');
}
