import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { computeQualityMetrics, QualityMetrics } from '../../scripts/quality-metrics.js';

describe('Quality Ratchet Suite', () => {
  it('should not regress against quality-baseline.json', () => {
    const baselinePath = path.join(process.cwd(), 'quality-baseline.json');
    assert.ok(fs.existsSync(baselinePath), 'quality-baseline.json must exist');

    const baseline: QualityMetrics = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const current = computeQualityMetrics();

    // every metric must have a baseline: a metric missing from the file (renamed, or added without one) would
    // otherwise never be checked at all (audit 22 Oct, §5.4)
    const missing = Object.keys(current).filter(key => !(key in baseline));
    assert.deepEqual(missing, [], `metrics with no baseline in quality-baseline.json: ${missing.join(', ')} (run scripts/update-ratchet.ts)`);

    for (const key of Object.keys(current) as (keyof QualityMetrics)[]) {
      const currentVal = current[key];
      const baselineVal = baseline[key];

      if (baselineVal !== undefined && baselineVal !== Infinity) {
        assert.ok(
          currentVal <= baselineVal,
          `Quality regression detected for '${key}': current value ${currentVal} exceeds baseline ${baselineVal}`
        );
      }
    }
  });
});
