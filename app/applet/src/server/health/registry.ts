import { HEALTH_PROBES } from './probes';
import { CachedProbeResult, HealthProbeDefinition } from './types';

const probeCache = new Map<string, CachedProbeResult>();

async function executeProbeWithTimeout(probeDef: HealthProbeDefinition): Promise<CachedProbeResult> {
  const cached = probeCache.get(probeDef.name);
  const now = Date.now();

  if (cached && (now - cached.lastCheckedAt) < probeDef.cacheTtlMs) {
    return cached;
  }

  const probePromise = probeDef.probe();
  const timeoutPromise = new Promise<CachedProbeResult>((resolve) => {
    setTimeout(() => {
      resolve({
        status: 'error',
        latencyMs: probeDef.timeoutMs,
        error: `Probe timed out after ${probeDef.timeoutMs}ms`,
        lastCheckedAt: now
      });
    }, probeDef.timeoutMs);
  });

  try {
    const res = await Promise.race([probePromise, timeoutPromise]);
    const cachedResult: CachedProbeResult = {
      ...res,
      lastCheckedAt: now
    };
    probeCache.set(probeDef.name, cachedResult);
    return cachedResult;
  } catch (err: any) {
    const errorResult: CachedProbeResult = {
      status: 'error',
      latencyMs: probeDef.timeoutMs,
      error: err.message || String(err),
      lastCheckedAt: now
    };
    probeCache.set(probeDef.name, errorResult);
    return errorResult;
  }
}

export async function runHealthCheck() {
  const results: Record<string, CachedProbeResult & { tier: number }> = {};
  let allTier1Passing = true;

  for (const probeDef of HEALTH_PROBES) {
    const result = await executeProbeWithTimeout(probeDef);
    results[probeDef.name] = {
      ...result,
      tier: probeDef.tier
    };

    if (probeDef.tier === 1 && result.status === 'error') {
      allTier1Passing = false;
    }
  }

  return {
    status: allTier1Passing ? 'healthy' : 'unhealthy',
    statusCode: allTier1Passing ? 200 : 503,
    timestamp: new Date().toISOString(),
    probes: results
  };
}
