
/**
 * LedgerFlow High-Precision Telemetry System
 * Tracks micro-timing for component 'opens', module imports, and mathematical execution.
 */

export class PerformanceTelemetry {
  private static markers: Map<string, number> = new Map();

  static start(label: string) {
    this.markers.set(label, performance.now());
  }

  static end(label: string) {
    const startTime = this.markers.get(label);
    if (!startTime) return null;
    
    const duration = performance.now() - startTime;
    this.markers.delete(label);
    return duration;
  }

  /**
   * Specifically for tracking component "opening" (mount time)
   */
  static traceComponent(_name: string) {
    const start = performance.now();
    let captured = false;
    
    return () => {
      if (captured) return;
      captured = true;
      const duration = performance.now() - start;
      return duration;
    };
  }
}
