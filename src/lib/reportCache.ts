export interface CachedReport<T> {
  key: string;
  timestamp: number;
  data: T;
  ttlMs: number;
}

const cacheMap = new Map<string, CachedReport<any>>();
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getCachedReport<T>(key: string): T | null {
  const cached = cacheMap.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > cached.ttlMs) {
    cacheMap.delete(key);
    return null;
  }

  return cached.data as T;
}

export function setCachedReport<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  cacheMap.set(key, {
    key,
    timestamp: Date.now(),
    data,
    ttlMs
  });
}

export function invalidateReportCache(prefix?: string): void {
  if (!prefix) {
    cacheMap.clear();
    return;
  }

  for (const key of cacheMap.keys()) {
    if (key.startsWith(prefix)) {
      cacheMap.delete(key);
    }
  }
}
