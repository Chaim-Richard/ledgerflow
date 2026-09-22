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
