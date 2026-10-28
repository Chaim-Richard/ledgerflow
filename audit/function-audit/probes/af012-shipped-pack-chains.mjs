/**
 * AF-012 reachability: does any shipped tax pack contain an override whose target is itself an override?
 *
 * Run from the repository root:   npx tsx audit/function-audit/probes/af012-shipped-pack-chains.mjs
 *
 * Measured at 50ee1205: 18 packs, 584 rules, 67 overrides, 221 exclusions, 0 chained overrides, 0 dangling
 * targets. That is why AF-012 is P2-latent rather than a wrong tax figure today — and why nothing would
 * notice the first chained override a future pack adds (the linter has no chain/cycle rule).
 */
import { allTaxRules, taxRulePacks } from '../../../src/lib/rules/packs/index';

const rules = allTaxRules();
const overrides = rules.filter(rule => rule.combine === 'override');
const overrideIds = new Set(overrides.map(rule => rule.id));
const ids = new Set(rules.map(rule => rule.id));
const chained = overrides.filter(rule => (rule.targets || []).some(target => overrideIds.has(target)));
const dangling = rules.flatMap(rule => (rule.targets || []).filter(target => !ids.has(target)).map(target => `${rule.id}->${target}`));

console.log(`packs: ${taxRulePacks().length}, rules: ${rules.length}, overrides: ${overrides.length}`);
console.log(`override targets that are themselves overrides: ${chained.length}${chained.length ? ` -> ${chained.map(r => r.id).join(',')}` : ''}`);
console.log(`dangling targets: ${dangling.length}`);
