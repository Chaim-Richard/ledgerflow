import fs from 'node:fs';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility gate for the journey specs, with a baseline that may only go down.
 *
 * `e2e/a11y-baseline.json` and `e2e/contrast-baseline.json` already work this way for the whole
 * screens: a screen may not get worse, and the number is lowered when the screen is fixed. The
 * journey screens had no baseline (the contrast suite visits the Reports tab's landing screen, not
 * the individual statements), so this file carries the numbers the journeys measured, per screen and
 * width, and refuses anything new or any increase.
 *
 * The entries that are not zero are **known product issues**, reported to the lead:
 *   - `color-contrast` on the profit & loss and trial balance screens (small upper-case labels and
 *     muted figures in light mode);
 *   - `scrollable-region-focusable` on the trial balance at phone width (the table scrolls, but the
 *     scrolling area cannot be reached with a keyboard).
 * Nothing here is an exemption for a new screen: a new screen starts at zero.
 */

const BASELINE_PATH = path.resolve(process.cwd(), 'e2e/journey-a11y-baseline.json');

export type AllowedViolations = Record<string, number>;

function readBaseline(): Record<string, AllowedViolations> {
  if (!fs.existsSync(BASELINE_PATH)) return {};
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as Record<string, AllowedViolations>;
}

/** id → number of offending nodes, for the serious and critical rules only (what the gate is about). */
function seriousNodes(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
  const counts: AllowedViolations = {};
  for (const violation of violations) {
    if (violation.impact !== 'serious' && violation.impact !== 'critical') continue;
    counts[violation.id] = (counts[violation.id] ?? 0) + violation.nodes.length;
  }
  return counts;
}

/**
 * Runs axe, attaches the whole result to the report, and fails when a screen has more serious or
 * critical violations than its baseline entry allows — or any it did not have before.
 */
export async function expectNoNewAccessibilityIssues(
  page: Page,
  key: string,
  testInfo: TestInfo,
  options: { exclude?: string } = {},
): Promise<void> {
  let builder = new AxeBuilder({ page });
  if (options.exclude) builder = builder.exclude(options.exclude);
  const result = await builder.analyze();
  await testInfo.attach(`axe-${key}`, { body: JSON.stringify(result.violations, null, 2), contentType: 'application/json' });

  const found = seriousNodes(result.violations);
  const allowed = readBaseline()[key] ?? {};

  const over: string[] = [];
  for (const [id, nodes] of Object.entries(found)) {
    const limit = allowed[id] ?? 0;
    if (nodes > limit) over.push(`${id}: ${nodes} node${nodes === 1 ? '' : 's'} (baseline ${limit})`);
  }

  expect(over.join('; '), `serious or critical accessibility issues on ${key}`).toBe('');
}
