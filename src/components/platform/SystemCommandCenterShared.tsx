

import { auth } from '../../firebase';

import type { User, Workspace } from '../../types';

export type AdminUser = Pick<User, 'uid' | 'email' | 'role'> & {
  customLimit?: number | null;
  computeCreditLimit?: number | null;
};

export type TenantTelemetry = Required<Pick<Workspace,
  'id' | 'name' | 'concurrentUserLimit' | 'activeUserCount' | 'seatCount' | 'maxSeats' |
  'computeCreditBalance' | 'apiQuotaTotalCentsUsed' | 'apiQuotaMonthlyLimitCents' |
  'creditCostMultiplier' | 'quotaCentsMultiplier' | 'customKeyCreditCharge' | 'customKeyCentsCharge'
>> & {
  plan: NonNullable<Workspace['plan']> | 'sandbox';
  bypassBilling: boolean;
  txCount: number;
  requestCount: number;
  errorCount: number;
};

export interface TelemetryLog {
  id?: string;
  timestamp: string;
  statusCode: number;
  method: string;
  path: string;
  ip: string;
  apiKeyUsed?: string;
  simulated?: boolean;
}

export interface CommandCenterTelemetry {
  status: 'success';
  tenants: TenantTelemetry[];
  liveLogs: TelemetryLog[];
}

export function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Unexpected error';
}

export const fetchWithAuth = async (url: string, options: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {}) => {
  const token = await auth.currentUser?.getIdToken();
  const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
  return fetch(url, { ...options, headers });
};

export function withOccurrenceKeys<T>(items: T[], keyForItem: (item: T) => string) {
  const occurrences = new Map<string, number>();
  return items.map(item => {
    const contentKey = keyForItem(item);
    const occurrence = occurrences.get(contentKey) ?? 0;
    occurrences.set(contentKey, occurrence + 1);
    return { item, key: JSON.stringify([contentKey, occurrence]) };
  });
}
