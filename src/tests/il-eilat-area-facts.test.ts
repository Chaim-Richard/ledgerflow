/**
 * A-99: Eilat and the other Israeli special areas — the facts a book can carry, the rule the pack
 * builds from them, and the rate the line-level tax answer uses. The point of the test is that all
 * three read ONE recognition: an invoice addressed <bdi>אילת</bdi> and one addressed <bdi>Eilat</bdi>
 * are the same place, and a place the table does not state is never treated as a special area.
 * The figures are hand-worked at the statute's own dates and at the standard rate in force.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IL_VAT_SPECIAL_AREAS, ilVatAreaFacts, ilVatAreaKeyFor, ilVatAreaNames, ilVatAreaRow, ilVatRateTable, isIlZeroArea,
} from '../lib/tax/ilVat';
import { ilVatPack } from '../lib/rules/packs/ilVatPack';
import { composeFacts } from '../lib/rules/facts';
import { evaluateRules } from '../lib/rules/rules';

const pack = ilVatPack();

/** The line-scope outcome for one place, on one date, through the same two calls the engine makes. */
function outcomeFor(city: string, date: string) {
  const facts = ilVatAreaFacts({ country: 'IL', city });
  const composed = composeFacts({ books: [{ attribute: 'country', value: 'IL', evidence: { kind: 'declared' } }, ...facts] }, {}, [], date);
  return evaluateRules(pack.rules, composed, { date, scope: 'line' });
}

test('every spelling the table states resolves to the same area, and an unstated place resolves to nothing', () => {
  for (const name of ['אילת', 'Eilat', 'eilat', 'EILAT', '  אילת  ', 'אזור אילת', 'Eilat Free Trade Zone']) {
    assert.equal(ilVatAreaKeyFor(name), 'eilat', `${name} is Eilat`);
  }
  for (const name of ['Tel Aviv', 'תל אביב', 'חיפה', '', '   ']) {
    assert.equal(ilVatAreaKeyFor(name), undefined, `${name || '(blank)'} is not a special area`);
  }
  assert.equal(ilVatAreaKeyFor(null), undefined, 'a missing place is not an area either');
  // the other rows keep their own names: the mapping is per row, never a global synonym list
  assert.equal(ilVatAreaKeyFor('יהודה ושומרון'), 'judea-samaria');
  assert.equal(ilVatAreaKeyFor('רצועת עזה'), 'gaza');
  assert.equal(isIlZeroArea('אילת', '2026-10-11'), true);
  assert.equal(isIlZeroArea('תל אביב', '2026-10-11'), false);
});

test('the Eilat row is dated to the statute and cites the statute, not a dead page', () => {
  const eilat = IL_VAT_SPECIAL_AREAS.find(row => row.area === 'eilat')!;
  // חוק אזור סחר חופשי באילת (פטורים והנחות ממסים), תשמ"ה-1985: enacted 31 July 1985, in force 1 November 1985.
  assert.equal(eilat.validFrom, '1985-11-01', 'the relief starts on the law’s commencement day, not a round 1986');
  assert.equal(eilat.validTo, undefined, 'and it is still in force — the state has considered ending it, and has not');
  assert.match(eilat.source, /^https:\/\//, 'one https source');
  assert.match(eilat.sourceAuthority || '', /Eilat Free Trade Zone Law/, 'the statute is named as the authority, not the Tax Authority');
  assert.equal(ilVatAreaRow('eilat', '1985-10-31'), undefined, 'the day before the law is in force, Eilat is an ordinary place');
  assert.equal(ilVatAreaRow('eilat', '1985-11-01')?.treatment, 'zero', 'the day it commences, it is not');
  assert.match(eilat.note || '', /exemption is not a zero rate/, 'the row says an exemption is not a zero rate');
  assert.match(eilat.note || '', /no input credit/, 'and that the dealer there has no input credit');
  assert.match(eilat.note || '', /404/, 'and records that the page it used to cite is gone');
});

test('the rate table answers the same for a Hebrew and an English address, and the ordinary rate elsewhere', () => {
  const table = ilVatRateTable();
  for (const city of ['אילת', 'Eilat', 'eilat']) {
    assert.deepEqual(table({ country: 'IL', city }, '2026-06-01'), [{ level: 'district', name: 'VAT — אילת', rate: 0 }], `${city} is zero-rated in 2026`);
    assert.deepEqual(table({ country: 'IL', city }, '2024-06-01'), [{ level: 'district', name: 'VAT — אילת', rate: 0 }], `${city} was zero-rated in 2024 too`);
  }
  assert.deepEqual(table({ country: 'IL', city: 'תל אביב' }, '2026-06-01'), [{ level: 'country', name: 'VAT (מע"מ)', rate: 0.18 }], 'the ordinary area is 18% from 2025');
  assert.deepEqual(table({ country: 'IL', city: 'תל אביב' }, '2024-06-01'), [{ level: 'country', name: 'VAT (מע"מ)', rate: 0.17 }], 'and was 17% through 2024');
  // a district written for another area wins over the city, and an unknown district is not a special area
  assert.deepEqual(table({ country: 'IL', city: 'אילת', district: 'judea-samaria' }, '2026-06-01'), [{ level: 'district', name: 'VAT — יהודה ושומרון', rate: 0 }]);
  assert.deepEqual(table({ country: 'IL', city: 'באר שבע' }, '2026-06-01'), [{ level: 'country', name: 'VAT (מע"מ)', rate: 0.18 }]);
});

test('the pack’s Eilat override is what answers: applied, and the standard rule displaced — 0%', () => {
  const eilat = outcomeFor('אילת', '2026-06-01');
  assert.deepEqual(eilat.applied.map(row => row.rule.id), ['il-vat-area-eilat'], 'only the area rule applies');
  const eilatEffect = eilat.applied[0].rule.effect;
  assert.ok(eilatEffect.kind === 'rate', 'the answer is a rate, not a threshold or a filing');
  assert.equal(eilatEffect.rate, 0, 'the line the graph answers carries 0%');
  assert.equal(eilatEffect.level, 'district', 'and it is the area level that says so');
  // on 1 June 2026 only the 18% row is in force, and the area rule displaces it. In 2024 the 17%
  // row is the one in force — the override answers for whichever standard row the date carries.
  assert.deepEqual(eilat.displaced.map(row => row.by), ['il-vat-area-eilat'], 'the standard rate in force is displaced by it');
  assert.deepEqual(eilat.displaced.map(row => row.rule.id), ['il-vat-2025-01-01']);
  const in2024 = outcomeFor('אילת', '2024-06-01');
  assert.deepEqual(in2024.applied.map(row => row.rule.id), ['il-vat-area-eilat'], 'Eilat is 0% in 2024 as well');
  assert.deepEqual(in2024.displaced.map(row => row.rule.id), ['il-vat-2015-10-01'], 'and it displaces the 17% row that was in force then');
  assert.deepEqual(eilat.blocked, []);
  assert.deepEqual(eilat.undecided, []);

  const telAviv = outcomeFor('תל אביב', '2026-06-01');
  assert.deepEqual(telAviv.applied.map(row => row.rule.id), ['il-vat-2025-01-01'], 'the ordinary place keeps the country rule');
  const telAvivEffect = telAviv.applied[0].rule.effect;
  assert.ok(telAvivEffect.kind === 'rate' && telAvivEffect.rate === 0.18, 'the ordinary place is at 18%');
  assert.deepEqual(telAviv.displaced, []);

  // hand-worked, both ways round: ₪1,000.00 net in Eilat is ₪1,000.00 gross; in Tel Aviv it is ₪1,180.00
  const net = 100_000;
  assert.equal(net + Math.round(net * 0), net, 'Eilat: no VAT on the line');
  assert.equal(net + Math.round(net * 0.18), 118_000, 'Tel Aviv: 18% of ₪1,000.00 is ₪180.00');
});

test('the facts half: only a recognised Israeli place produces a district fact, and it is canonical', () => {
  assert.deepEqual(ilVatAreaFacts({ country: 'IL', city: 'אילת' }), [{ attribute: 'district', value: 'eilat', evidence: { kind: 'declared' } }]);
  assert.deepEqual(ilVatAreaFacts({ country: 'IL', city: 'Eilat', district: 'אילת' }), [{ attribute: 'district', value: 'eilat', evidence: { kind: 'declared' } }]);
  assert.deepEqual(ilVatAreaFacts({ country: 'IL', city: 'Haifa' }), [], 'an ordinary Israeli city states no area');
  assert.deepEqual(ilVatAreaFacts({ country: 'US', state: 'TX', city: 'Eilat' }), [], 'a place outside Israel is not an Israeli area');
  assert.deepEqual(ilVatAreaFacts(null), []);
  // declared, never verified: choosing a label is not proof, and no rule in this pack asks for proof
  for (const rule of pack.rules.filter(row => row.scope === 'line')) {
    assert.deepEqual(rule.requiresVerified || [], [], `${rule.id} does not silently require verification`);
  }
});

test('the rule pack and the rate table cannot drift: every recognised name is a rule value too', () => {
  for (const row of IL_VAT_SPECIAL_AREAS.filter(area => area.treatment === 'zero')) {
    const rule = pack.rules.find(candidate => candidate.id === `il-vat-area-${row.area}`)!;
    const condition = rule.when.find(candidate => candidate.attribute === 'district')!;
    for (const name of ilVatAreaNames(row)) {
      assert.ok((condition.values || []).includes(name), `${row.area}: the pack answers for "${name}" as well`);
      assert.equal(ilVatAreaKeyFor(name), row.area, `${row.area}: the table resolves "${name}" to the same key`);
      const answer = ilVatRateTable()({ country: 'IL', city: name }, row.validTo || '2026-06-01');
      assert.deepEqual(answer, [{ level: 'district', name: `VAT — ${row.nameHebrew}`, rate: 0 }], `${row.area}: "${name}" is the same 0% answer the rule gives`);
    }
    assert.equal(rule.source.url, row.source, `${row.area}: the rule cites the row's own source`);
    assert.equal(rule.status, 'calculation', `${row.area} is calculation content, never a filing position`);
  }
});
