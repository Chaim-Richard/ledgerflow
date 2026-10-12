/**
 * A-60: write a snapshot of the rule packs, or a readable diff against the newest one (by hand).
 *
 *   npm run diff:rule-packs -- --snapshot          write docs/eval/rule-pack-snapshots/<date>.json
 *   npm run diff:rule-packs                        diff now against the newest snapshot
 *   npm run diff:rule-packs -- <snapshot.json>     diff against a named snapshot
 *
 * Both write a dated markdown report under docs/eval/. The unit tests cover the pure diff; this file
 * only reads the packs and the snapshot directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import { taxRulePacks } from '../src/lib/rules/packs/index';
import { diffRuleSnapshots, packDiffMarkdown, snapshotRule, type RuleSnapshot } from '../src/lib/rules/packDiff';

const SNAPSHOT_DIR = path.join(process.cwd(), 'docs/eval/rule-pack-snapshots');

function currentSnapshot(): RuleSnapshot[] {
  return taxRulePacks().flatMap(pack => pack.rules.map(rule => snapshotRule(pack.id, rule)));
}

function newestSnapshot(explicit?: string): { file: string; rules: RuleSnapshot[] } | null {
  if (explicit) {
    const file = path.resolve(explicit);
    return { file, rules: JSON.parse(fs.readFileSync(file, 'utf8')).rules as RuleSnapshot[] };
  }
  if (!fs.existsSync(SNAPSHOT_DIR)) return null;
  const files = fs.readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith('.json')).sort();
  if (!files.length) return null;
  const file = path.join(SNAPSHOT_DIR, files[files.length - 1]);
  return { file, rules: JSON.parse(fs.readFileSync(file, 'utf8')).rules as RuleSnapshot[] };
}

function main() {
  const today = new Date().toISOString().slice(0, 10);
  const rules = currentSnapshot();
  if (process.argv.includes('--snapshot')) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    const file = path.join(SNAPSHOT_DIR, `${today}.json`);
    fs.writeFileSync(file, `${JSON.stringify({ date: today, rules }, null, 2)}\n`);
    console.log(`wrote ${path.relative(process.cwd(), file)} (${rules.length} rules)`);
    return;
  }
  const explicit = process.argv.slice(2).find(arg => !arg.startsWith('--'));
  const before = newestSnapshot(explicit);
  if (!before) throw new Error('No snapshot yet: run npm run diff:rule-packs -- --snapshot first.');
  const beforeDate = JSON.parse(fs.readFileSync(before.file, 'utf8')).date as string | undefined;
  const diff = diffRuleSnapshots(before.rules, rules, { beforeDate, afterDate: today });
  fs.mkdirSync(path.join(process.cwd(), 'docs/eval'), { recursive: true });
  const out = path.join(process.cwd(), 'docs/eval', `rule-pack-diff-${today}.md`);
  fs.writeFileSync(out, packDiffMarkdown(diff));
  console.log(`${diff.added.length} added, ${diff.ended.length} ended, ${diff.changed.length} changed against ${path.basename(before.file)}`);
  console.log(`wrote ${path.relative(process.cwd(), out)}`);
}

main();
