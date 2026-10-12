/**
 * A-40: county, city and district rows as rules. What the test holds:
 *  - a combined figure displaces the state rule it already contains and is never added to it;
 *  - component rows add up (Colorado's home-rule parts, a Texas city plus its transit district);
 *  - a row whose own wording does not say what the place is is reported, not guessed;
 *  - a few published addresses resolve to the rate the publication prints.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { usLocalRatePack, localRateKey } from '../lib/rules/packs/usLocalRatePack';
import { usSalesTaxPack } from '../lib/rules/packs/usSalesTaxPack';
import { evaluateRules } from '../lib/rules/rules';
import { composeFacts, type Fact } from '../lib/rules/facts';
import {
  parseTexasLocalRates, parseCaliforniaLocalRates, parseNewYorkLocalRates,
  parseWashingtonLocalRates, parseColoradoLocalRates,
} from '../lib/tax/stateLocalRateImporters';

const DATE = '2026-10-01';

const texas = parseTexasLocalRates([
  ['Name', 'Local Code', 'Local Rate', 'Total Rate'],
  ['Abilene', '2221012', '.020000', '.082500'],
  ['Taylor Co', '4221000', '.005000', ''],
], '2026-10-01');

const california = parseCaliforniaLocalRates([
  ['Location', 'Rate', 'County', 'Type'],
  ['Alameda', '10.750%', 'Alameda', 'City'],
  ['Alameda', '1.000%', 'Alameda', 'District'],
], '2026-10-01');

const newYork = parseNewYorkLocalRates([
  ['County or other locality', 'Tax rate %', 'Reporting code'],
  ['Albany', '8¼', '0181'],
], '2026-10-01');

const washington = parseWashingtonLocalRates([
  ['ZIP', 'ZIP+4 Low', 'ZIP+4 High', 'Location Code', 'Rate'],
  ['98101', '0000', '9999', '1726', '.103'],
], '2026-10-01');

const colorado = parseColoradoLocalRates([
  ['Jurisdiction', 'Sales Tax Rate', 'Location Code'],
  ['Boulder', '3.86%', '001'],
  ['Denver', '4.81%', '002'],
], '2026-07-01');

const factsFor = (input: { state: string; county?: string; city?: string; district?: string }) => composeFacts({
  books: [
    { attribute: 'country', value: 'US' } as Fact,
    { attribute: 'state', value: input.state } as Fact,
    ...(input.county ? [{ attribute: 'county', value: input.county } as Fact] : []),
    ...(input.city ? [{ attribute: 'city', value: input.city } as Fact] : []),
    ...(input.district ? [{ attribute: 'district', value: input.district } as Fact] : []),
  ],
}, {}, [], DATE);

const rateOf = (outcome: ReturnType<typeof evaluateRules>, id: string) => {
  const applied = outcome.applied.find(a => a.rule.id === id);
  assert.ok(applied, `${id} applies: ${JSON.stringify(outcome.applied.map(a => a.rule.id))}`);
  const effect = applied.rule.effect as { kind: string; rate?: number };
  assert.equal(effect.kind, 'rate');
  return effect.rate as number;
};

test('the row’s own wording decides the key: county suffixes and district words are read as written', () => {
  const [abilene, taylor] = texas.rows;
  assert.deepEqual(localRateKey(abilene), { key: { attribute: 'city', value: 'abilene' } });
  assert.deepEqual(localRateKey(taylor), { key: { attribute: 'county', value: 'taylor' } });
  assert.deepEqual(localRateKey(california.rows[0]), { key: { attribute: 'city', value: 'alameda' } });
  assert.deepEqual(localRateKey(california.rows[1]), { key: { attribute: 'district', value: 'alameda' } });
  assert.deepEqual(localRateKey(newYork.rows[0]), { key: { attribute: 'county', value: 'albany' } });
  assert.deepEqual(localRateKey(washington.rows[0]), { key: { attribute: 'district', value: '1726' } });
  assert.deepEqual(localRateKey(colorado.rows[0]), { key: { attribute: 'city', value: 'boulder' } });
});

test('a row that does not say what it is is reported, never keyed', () => {
  const unnamed = parseCaliforniaLocalRates([['Location', 'Rate'], ['Somewhere', '9.000%']], '2026-10-01');
  assert.equal(localRateKey(unnamed.rows[0]).key, undefined);
  const pack = usLocalRatePack(unnamed.rows);
  assert.equal(pack.rules.length, 0);
  assert.equal(pack.unmapped.length, 1);
  assert.match(pack.unmapped[0].reason, /does not say whether it is a city, county or district/);

  const washingtonWithoutCode = parseWashingtonLocalRates([
    ['ZIP', 'ZIP+4 Low', 'ZIP+4 High', 'Location Code', 'Rate'],
    ['98101', '0000', '9999', '1726', '.103'],
  ], '2026-10-01');
  const stripped = washingtonWithoutCode.rows.map(row => ({ ...row, code: undefined }));
  const noCode = usLocalRatePack(stripped);
  assert.equal(noCode.rules.length, 0);
  assert.match(noCode.unmapped[0].reason, /no location code/);
});

test('a combined figure replaces the state rule it already contains', () => {
  const pack = usLocalRatePack(texas.rows);
  const outcome = evaluateRules([...pack.rules, ...usSalesTaxPack().rules], factsFor({ state: 'TX', city: 'abilene' }), { date: DATE, scope: 'line' });
  assert.equal(rateOf(outcome, 'us-local-tx-abilene-2026-10-01'), 0.0825);
  assert.deepEqual(
    outcome.applied.filter(a => a.rule.id.startsWith('us-sales-')).map(a => a.rule.id), [],
    'the 6.25% Texas state rule and the 8.25% combined figure are never both applied',
  );
  assert.ok(outcome.displaced.some(d => d.rule.id.startsWith('us-sales-tx') && d.by === 'us-local-tx-abilene-2026-10-01'));
  const total = outcome.applied.reduce((sum, a) => sum + ((a.rule.effect as { rate?: number }).rate || 0), 0);
  assert.equal(Math.round(total * 10000) / 10000, 0.0825);
});

test('component rows add to the state rate and to each other', () => {
  const txComponent = parseTexasLocalRates([
    ['Name', 'Local Code', 'Local Rate'],
    ['Taylor Co', '4221000', '.005000'],
  ], '2026-10-01').rows;
  const outcome = evaluateRules([...usLocalRatePack(txComponent).rules, ...usSalesTaxPack().rules], factsFor({ state: 'TX', county: 'taylor' }), { date: DATE, scope: 'line' });
  const state = rateOf(outcome, 'us-sales-tx-2000-01-01');
  const county = rateOf(outcome, 'us-local-tx-taylor-2026-10-01');
  assert.equal(Math.round((state + county) * 10000) / 10000, 0.0675);
  assert.equal(outcome.displaced.length, 0, 'a component switches nothing off');
});

test('the published addresses resolve to the published rates', () => {
  // Alameda, California: city 10.750% (a combined figure, so it stands alone)
  const ca = usLocalRatePack(california.rows);
  const alameda = evaluateRules([...ca.rules, ...usSalesTaxPack().rules], factsFor({ state: 'CA', city: 'alameda', county: 'alameda' }), { date: DATE, scope: 'line' });
  assert.equal(rateOf(alameda, 'us-local-ca-alameda-2026-10-01'), 0.1075);
  assert.equal(alameda.displaced.filter(d => d.rule.id.startsWith('us-sales-ca')).length, 1);
  // the same city's district row (a component) would add if its facts were stated
  const districtOnly = evaluateRules(ca.rules, factsFor({ state: 'CA', district: 'alameda' }), { date: DATE, scope: 'line' });
  assert.equal(rateOf(districtOnly, 'us-local-ca-alameda-2026-10-01'), 0.01);

  // Albany County, New York: 8¼% = 8.25%
  const ny = evaluateRules(usLocalRatePack(newYork.rows).rules, factsFor({ state: 'NY', county: 'albany' }), { date: DATE, scope: 'line' });
  assert.equal(rateOf(ny, 'us-local-ny-albany-2026-10-01'), 0.0825);

  // ZIP 98101, Washington: location code 1726 = 10.3%
  const waPack = usLocalRatePack(washington.rows);
  const wa = evaluateRules(waPack.rules, factsFor({ state: 'WA', district: '1726' }), { date: DATE, scope: 'line' });
  assert.equal(rateOf(wa, 'us-local-wa-1726-2026-10-01'), 0.103);
  const effect = wa.applied[0].rule.effect as { zipRange?: { zip: string; zip4Low: string; zip4High: string } };
  assert.deepEqual(effect.zipRange, { zip: '98101', zip4Low: '0000', zip4High: '9999' });

  // Colorado's home-rule parts add up (they are published as components)
  const co = evaluateRules(usLocalRatePack(colorado.rows).rules, factsFor({ state: 'CO', city: 'boulder' }), { date: DATE, scope: 'line' });
  assert.equal(rateOf(co, 'us-local-co-boulder-2026-07-01'), 0.0386);
});

test('the rules carry the evidence trail: dates, source, row number and edition', () => {
  const withEdition = parseCaliforniaLocalRates(
    [['Location', 'Rate', 'County', 'Type'], ['Alameda', '10.750%', 'Alameda', 'City']],
    '2026-10-01',
    { validTo: '2026-12-31', edition: 'CDTFA 2026 Q4 (verified manually)' },
  );
  const pack = usLocalRatePack(withEdition.rows);
  const rule = pack.rules[0];
  assert.equal(rule.validFrom, '2026-10-01');
  assert.equal(rule.validTo, '2026-12-31');
  assert.match(rule.source.url, /^https:\/\/cdtfa\.ca\.gov\//);
  assert.equal(rule.status, 'calculation');
  const effect = rule.effect as { sourceRow: number; edition?: string; basis: string };
  assert.equal(effect.sourceRow, 2);
  assert.equal(effect.edition, 'CDTFA 2026 Q4 (verified manually)');
  assert.equal(effect.basis, 'combined');
});

test('an import with issues still keys only the rows that survived review', () => {
  const mixed = parseWashingtonLocalRates([
    ['ZIP', 'ZIP+4 Low', 'ZIP+4 High', 'Location Code', 'Rate'],
    ['98101', '0000', '9999', '1726', '.103'],
    ['98101', '0500', '1500', '1727', '.104'],
  ], '2026-10-01');
  assert.equal(mixed.issues.length, 1, 'the overlapping interval is flagged by the importer');
  const pack = usLocalRatePack(mixed.rows);
  assert.equal(pack.rules.length, 2, 'both reviewed rows key by their own location code');
  assert.deepEqual(pack.rules.map(r => (r.effect as { locationCode?: string }).locationCode), ['1726', '1727']);
});
