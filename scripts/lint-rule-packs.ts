/**
 * A-110: lint every rule in every pack (by hand and from CI).
 *
 *   npm run lint:rule-packs            the table of problems; exit 1 when there is any
 *   npm run lint:rule-packs -- --quiet just the counts; exit 1 when there is any problem
 *
 * The pure check lives in `src/lib/rules/lint.ts` and is covered by `src/tests/rule-pack-lint.test.ts`,
 * which the unit suite (and so CI) already fails on. This script is for a person: it names each
 * problem with its pack and rule so a broken pack can be fixed without reading the test output.
 */
import { taxRulePacks } from '../src/lib/rules/packs/index';
import { lintRule, ruleLintLines, type RuleLintProblem } from '../src/lib/rules/lint';

function main() {
  const clean = process.argv.includes('--quiet');
  const problems: RuleLintProblem[] = [];
  let rules = 0;
  for (const pack of taxRulePacks()) {
    for (const rule of pack.rules) {
      rules += 1;
      problems.push(...lintRule(rule, { pack: pack.id }));
    }
    if (!pack.id || !pack.name) problems.push({ pack: pack.id, field: 'shape', problem: 'the pack needs an id and a name' });
  }
  if (!clean) for (const line of ruleLintLines(problems)) console.log(line);
  console.log(`${rules} rule(s) checked, ${problems.length} problem(s)`);
  if (problems.length) process.exitCode = 1;
}

main();
