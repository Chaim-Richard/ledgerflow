/**
 * The category suggestion engine used for bank lines and imports: each layer in order (rule,
 * remembered description, longest partial, fuzzy, learned from past entries, typo), archived
 * accounts never suggested, and the claim it reports (auto-post only for rules and exact matches).
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { MatchingEngine } from '../lib/MatchingEngine';
import type { AutoRule, DimensionNode } from '../types';
import { makeChartAccount, makeTransaction } from './fixtures';

const rule = (id: string, condition: AutoRule['condition'], action: AutoRule['action']): AutoRule => ({ id, uid: 'u1', condition, action } as AutoRule);
const rules = [
  rule('r-aws', { vendor: 'AMAZON WEB SERVICES' }, { targetCategory: 'Software', targetTags: ['cloud'], targetDimensions: { dept: 'eng' } }),
  rule('r-none', { descriptionContains: 'NOTHING TO DO' }, {}),
];
const cache = {
  'monthly office rent': { accountName: 'Rent' },
  'coffee': { accountName: 'Meals' },
  'electric company bill': { accountName: 'Utilities', tags: ['power'] },
  'old supplier': { accountName: 'Old Expenses' },
  'travel:flights': { accountName: 'Travel:Flights' },
};
const accounts = [
  makeChartAccount({ id: 'rent', name: 'Rent', type: 'expense' }),
  makeChartAccount({ id: 'old', name: 'Old Expenses', type: 'expense', isArchived: true }),
  makeChartAccount({ id: 'meals', name: 'Meals', type: 'expense', isActive: false }),
];
const nodes: DimensionNode[] = [{ id: 'P1', dimensionId: 'property', description: '123 Ocean Ave Maint', aliases: ['OCEAN AVE'] }];

const engine = () => new MatchingEngine(rules, cache, 'salt', 0.85, [], nodes, accounts);

describe('Category suggestions', () => {
  test('a rule wins first and carries its tags and dimensions; a rule with no category is skipped', () => {
    const r = engine().resolveCategory('AMAZON WEB SERVICES 8812 SEATTLE');
    assert.equal(r?.accountName, 'Software');
    assert.deepEqual(r?.dimensions, { dept: 'eng' });
    assert.ok(r?.tags?.includes('cloud'));
    assert.equal(engine().resolveCategory('nothing to do here at all')?.accountName, 'Manual Review');
  });

  test('remembered description: exact, then the longest partial match', () => {
    assert.equal(engine().resolveCategory('Monthly Office Rent')?.accountName, 'Rent');
    const partial = engine().resolveCategory('PAYMENT ELECTRIC COMPANY BILL MARCH');
    assert.equal(partial?.accountName, 'Utilities');
    assert.ok(partial?.tags?.includes('power'));
  });

  test('archived or inactive accounts are never suggested: manual review, the old category kept', () => {
    const r = engine().resolveCategory('old supplier');
    assert.equal(r?.accountName, 'Manual Review');
    assert.equal(r?.dimensions?.category, 'Old Expenses');
    assert.ok(r?.tags?.includes('ARCHIVED_ACCOUNT_FALLTHROUGH'));
    assert.equal(engine().resolveCategory('coffee')?.accountName, 'Manual Review', 'isActive false');
    assert.equal(new MatchingEngine([], cache).resolveCategory('coffee')?.accountName, 'Meals', 'without a chart nothing is archived');
    assert.equal(engine().isAccountArchivedOrInactive('old'), true, 'by id');
    assert.equal(engine().isAccountArchivedOrInactive(''), false);
  });

  test('a nested category becomes a category dimension; a project code fills its dimension', () => {
    const nested = engine().resolveCategory('travel:flights');
    assert.equal(nested?.accountName, 'Travel:Flights');
    assert.match(nested?.dimensions?.category || '', /^Travel.Flights$/i);
    assert.equal(engine().resolveCategory('Repairs at OCEAN AVE unit 2')?.dimensions?.property, 'P1');
  });

  test('a close spelling of a remembered description (fuzzy) and a typo still match', () => {
    assert.equal(engine().resolveCategory('monthly office rents')?.accountName, 'Rent');
    assert.equal(new MatchingEngine([], { 'stripe': { accountName: 'Fees' } }, '', 0.99).resolveCategory('strpe')?.accountName, 'Fees');
  });

  test('learns from past entries (not void, not uncategorized, not archived accounts)', () => {
    const history = [
      ...Array.from({ length: 6 }, (_, i) => makeTransaction({ id: `h${i}`, description: 'GITHUB SUBSCRIPTION', status: 'completed',
        lines: [{ id: `l${i}`, accountId: 'sw', accountName: 'Software', amountCents: 400, description: 'github subscription monthly' }] })),
      makeTransaction({ id: 'v', status: 'void', lines: [{ id: 'v1', accountId: 'x', accountName: 'Wrong', amountCents: 1, description: 'github subscription monthly' }] }),
      makeTransaction({ id: 'u', lines: [{ id: 'u1', accountId: 'x', accountName: 'Uncategorized', amountCents: 1, description: 'github subscription monthly' }] }),
    ];
    const learned = new MatchingEngine([], {}, '', 0.5, history);
    assert.equal(learned.resolveCategory('github subscription monthly charge')?.accountName, 'Software');
    assert.match(learned.debugResolveCategory('github subscription monthly charge').layer, /Bayesian/);
  });

  test('nothing known: manual review; empty text: nothing', () => {
    const r = engine().resolveCategory('zzqx unknown vendor 99');
    assert.equal(r?.accountName, 'Manual Review');
    assert.ok(r?.tags?.includes('UNRESOLVED_ENTRY'));
    assert.equal(engine().resolveCategory('   '), null);
  });

  test('explains which layer matched, and only rules and exact matches post automatically', () => {
    const e = engine();
    assert.match(e.debugResolveCategory('AMAZON WEB SERVICES').layer, /^Rule: AMAZON WEB SERVICES/);
    assert.equal(e.debugResolveCategory('monthly office rent').layer, 'Exact Cache Pattern Match');
    assert.equal(e.debugResolveCategory('PAYMENT ELECTRIC COMPANY BILL').layer, 'Partial Cache Pattern');
    assert.match(e.debugResolveCategory('monthly office rents').layer, /Fuzzy|Partial/);
    assert.match(e.debugResolveCategory('old supplier').layer, /Archived\/Inactive/);
    assert.match(e.debugResolveCategory('Repairs OCEAN AVE').layer, /Matched alias: P1/);
    assert.equal(e.debugResolveCategory('').layer, 'Empty Input');
    assert.match(e.debugResolveCategory('zzqx unknown vendor 99').layer, /^Fallback Manual Intervention/);
    assert.match(new MatchingEngine([], { 'stripe': { accountName: 'Fees' } }, '', 0.99).debugResolveCategory('strpe').layer, /Typo Correction: stripe/);

    const auto = e.resolveClaim('AMAZON WEB SERVICES');
    assert.deepEqual([auto.status, auto.confidence, auto.accountName], ['AUTO_POSTED', 1, 'Software']);
    const review = e.resolveClaim('PAYMENT ELECTRIC COMPANY BILL');
    assert.equal(review.status, 'REVIEW_REQUIRED');
    assert.match(review.provenance.evidence, /Partial Cache Pattern \(confidence: 95%\)/);
  });

  test('merchant names: bank noise stripped, close names grouped', () => {
    const merchants = [{ id: 'm-uber', name: 'Uber' }, { id: 'm-shop', name: 'Shopify Inc' }];
    assert.equal(engine().resolveMerchant('UBER', merchants), 'm-uber');
    assert.equal(engine().resolveMerchant('POS SHOPIFY INC', merchants), 'm-shop');
    assert.equal(engine().resolveMerchant('Totally different', merchants), 'Totally different');
    assert.equal(engine().resolveMerchant('***', merchants), '***');
    const groups = engine().groupTransactions([{ description: 'Uber trip' }, { description: 'Uber trip' }, { description: 'Lyft ride' }]);
    assert.equal(groups.size, 2);
  });

  test('batch suggestions, also in slices with progress', async () => {
    const txs = [makeTransaction({ id: 'a', description: 'monthly office rent' }), makeTransaction({ id: 'b', description: 'AMAZON WEB SERVICES' })];
    assert.deepEqual([...engine().suggestCategories(txs)], [['a', 'Rent'], ['b', 'Software']]);
    const progress: number[] = [];
    const sliced = await engine().suggestCategoriesAsync(txs, p => progress.push(p));
    assert.equal(sliced.get('b')?.accountName, 'Software');
    assert.deepEqual(progress, [100]);
    engine().setAccounts([]);
  });
});
