/**
 * A-59: the by-hand rule-pack source check (never in the unit suite, never in CI).
 *
 *   npm run check:rule-sources            check every unique source URL and write docs/eval/
 *   npm run check:rule-sources -- --dry  list the URLs and write the report without any request
 *
 * The report is dated and committed under docs/eval/. It records what the pages answered on that day —
 * not that a rule is still right. The unit tests never call this; they cover the report's shape.
 */
import fs from 'node:fs';
import path from 'node:path';
import { allTaxRules } from '../src/lib/rules/packs/index';
import { checkRuleSources, sourceReportMarkdown, sourceReportSummary } from '../src/lib/rules/sourceCheck';

async function main() {
  const dryRun = process.argv.includes('--dry') || process.argv.includes('--dry-run');
  const today = new Date().toISOString().slice(0, 10);
  const report = await checkRuleSources(allTaxRules(), today, { dryRun, fetchImpl: fetch, timeoutMs: 15_000 });
  const dir = path.join(process.cwd(), 'docs/eval');
  fs.mkdirSync(dir, { recursive: true });
  const markdownPath = path.join(dir, `rule-pack-sources-${today}${dryRun ? '-dry-run' : ''}.md`);
  fs.writeFileSync(markdownPath, sourceReportMarkdown(report));
  const jsonPath = path.join(dir, `rule-pack-sources-${today}${dryRun ? '-dry-run' : ''}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(sourceReportSummary(report));
  for (const entry of report.entries.sort((a, b) => (a.result.status < b.result.status ? -1 : 1))) {
    if (entry.result.status !== 'answered') console.log(`${entry.result.status}\t${entry.url}\t${entry.result.detail}`);
  }
  console.log(`wrote ${path.relative(process.cwd(), markdownPath)}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
