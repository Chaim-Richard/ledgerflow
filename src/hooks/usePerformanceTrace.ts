import { useMemo, useEffect } from 'react';
import { PerformanceTelemetry } from '../lib/telemetry';

/**
 * Clearbook High-Precision Trace Hook
 * Simplifies component performance monitoring with a single call.
 * Uses useMemo to capture start time and useEffect to trigger telemetry.
 */
export function usePerformanceTrace(componentName: string) {
  const trace = useMemo(() => PerformanceTelemetry.traceComponent(componentName), [componentName]);
  
  useEffect(() => {
    trace();
  }, [trace]);
}
