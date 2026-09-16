export type HealthTier = 1 | 2;

export interface HealthProbeResult {
  status: 'ok' | 'degraded' | 'error';
  latencyMs: number;
  message?: string;
  error?: string;
}

export interface HealthProbeDefinition {
  name: string;
  tier: HealthTier;
  cacheTtlMs: number;
  timeoutMs: number;
  probe: () => Promise<HealthProbeResult>;
}

export interface CachedProbeResult extends HealthProbeResult {
  lastCheckedAt: number;
}
