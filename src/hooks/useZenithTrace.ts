import { useMemo, useEffect } from 'react';
import { ZenithTelemetry } from '../lib/telemetry';

/**
 * Zenith High-Precision Trace Hook
 * Simplifies component performance monitoring with a single call.
 * Uses useMemo to capture start time and useEffect to trigger telemetry.
 */
export function useZenithTrace(componentName: string) {
  const trace = useMemo(() => ZenithTelemetry.traceComponent(componentName), [componentName]);
  
  useEffect(() => {
    trace();
  }, [trace]);
}
