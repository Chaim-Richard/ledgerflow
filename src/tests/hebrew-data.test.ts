import { computeTFIDFWeights, similarityWithTFIDF } from '../lib/algorithms/tf-idf';
import { induceRules } from '../lib/algorithms/rule-induction';
import { parseNaturalLanguageEntry } from '../lib/algorithms/nl-parser';
import { detectDuplicateContacts } from '../lib/contactUtils';
import { guessMapping, applyMapping, prepareImport, identityKeys, IMPORT_DEFINITIONS } from '../lib/recordImport';
import test from 'node:test';
import assert from 'node:assert/strict';
import { jaroWinklerSimilarity, optimizedTransactionSimilarity, lexicalSimilarity, AhoCorasick, BayesianClassifier } from '../lib/algorithms';
import { generateSearchTokens, searchTransactions } from '../lib/serverSearch';
import { extractMultiDimensionalLabels, resolveDimensionLabel, setLineDimension } from '../lib/dimensionUtils';
import { LedgerEngine } from '../kernel/ledger/LedgerEngine';
import { TransactionQueryEngine } from '../lib/TransactionQueryEngine';
import { IntentResolver } from '../lib/intentResolver';
import { MatchingEngine } from '../lib/MatchingEngine';
import { toCsv, csvMoney } from '../lib/csvExport';
import { parseCsv } from '../lib/csv';
import { makeTransaction, makeChartAccount } from './fixtures';
import type { DimensionNode } from '../types';

const purchase = makeTransaction({ id: 'hebrew-purchase', description: 'קניית מחשב Office', payee: 'ספק מחשבים', project: 'פרויקט Alpha', tags: ['מחלקה/פיתוח/צוות א'], totalAmountCents: 12345, lines: [{ accountId: 'acc-1', accountName: 'ציוד Office', description: 'מחשב ThinkPad', amountCents: 12345, class: 'מחלקה פיתוח', location: 'תל אביב' }] });
const other = makeTransaction({ id: 'other-purchase', description: 'שכירות משרד', payee: 'בעל בית', project: 'פרויקט Beta', totalAmountCents: 20000, lines: [{ accountId: 'rent', accountName: 'שכירות', amountCents: 20000 }] });
function query(searchTerm: string) {
  return TransactionQueryEngine.query({ normalized: LedgerEngine.normalize([purchase, other]), filterCriteria: null, searchTerm, accounts: [makeChartAccount({ name: 'ציוד Office' })], activeView: null, dimensionNodes: [], reverseDimensionIndex: new Map(), thresholds: { avg: 0, totalVolume: 0, percentiles: { top10: 0, top25: 0, bottom10: 0 } } }).map(t => t.id);
}

test('Hebrew similarity retains merchant identity instead of discarding it', () => {
  for (const similarity of [jaroWinklerSimilarity, optimizedTransactionSimilarity, lexicalSimilarity]) {
    assert.equal(similarity('שלום Market', 'שלום market'), 1);
    assert.equal(similarity('שָׁלוֹם', 'שלום'), 1);
    assert.equal(similarity('שלום', 'שלום'), 1);
    assert.ok(similarity('ספק Office', 'שכירות Office') < 1);
    assert.equal(similarity('', 'שלום'), 0);
  }
  const normalized = LedgerEngine.normalize([purchase])[0];
  assert.equal(normalized.description, purchase.description);
  assert.match(normalized._normalized.sanitizedDescription, /קניית מחשב/);
  assert.equal(jaroWinklerSimilarity(purchase.description, purchase.description, undefined, normalized._normalized.sanitizedDescription), 1);
  assert.equal(jaroWinklerSimilarity('Amazon Inc.', 'amazon'), 1);
});

test('search tokens and rule patterns handle Hebrew, vocalization, accents and mixed items', () => {
  const tokens = generateSearchTokens('שָׁלוֹם Market', 'Café');
  assert.ok(tokens.includes('שלום'));
  assert.ok(tokens.includes('של'));
  assert.ok(tokens.includes('market'));
  assert.ok(tokens.includes('café'));
  assert.deepEqual(searchTransactions([purchase, other], 'מחשב').map(t => t.id), [purchase.id]);
  assert.deepEqual(new AhoCorasick([{ pattern: 'שָׁלוֹם', ruleId: 'he' }, { pattern: 'Office', ruleId: 'en' }]).search('שלום OFFICE'), ['he', 'en']);
  const engine = new MatchingEngine([]);
  assert.equal(engine.resolveMerchant('שָׁלוֹם Market', [{ id: 'merchant-he', name: 'שלום Market' }]), 'merchant-he');
});

test('English query commands accept quoted mixed-language data, deep paths and exclusions', () => {
  for (const search of ['payee:"ספק מחשבים"', "project:'פרויקט Alpha'", 'account:"ציוד Office"', 'class:"מחלקה פיתוח"', 'location:"תל אביב"', 'tag:"מחלקה/פיתוח/צוות א"', 'contains "מחשב Office"', 'starts with קניית', 'ends with Office', 'NOT שכירות', '-"בעל בית"']) assert.deepEqual(query(search), [purchase.id], search);
  assert.deepEqual(query('payee:ספק status:completed'), [purchase.id]);
  assert.deepEqual(query('payee:missing'), []);
});

test('dimension extraction keeps Hebrew keys and deep mixed-language paths', () => {
  const labels = extractMultiDimensionalLabels('[מחלקה:פיתוח/צוות א] [project:פרויקט Alpha/שלב ב] #אזור/ישראל/תל-אביב');
  assert.equal(labels.dimensions['מחלקה'], 'פיתוח/צוות א');
  assert.equal(labels.dimensions.project, 'פרויקט Alpha/שלב ב');
  assert.ok(labels.tags.includes('אזור/ישראל/תל-אביב'));
  assert.ok(labels.tags.includes('אזור/ישראל'));
  assert.ok(labels.deepPaths.includes('מחלקה:פיתוח/צוות א'));
  const nodes: DimensionNode[] = [{ id: 'stable-1', dimensionId: 'מחלקה', description: 'פיתוח Café', aliases: ['צוות א'], status: 'active', createdAt: '2026-01-01' }];
  assert.equal(resolveDimensionLabel(nodes, 'מחלקה', 'פיתוח Cafe\u0301'), 'פיתוח Café');
  const line = setLineDimension(purchase.lines[0], 'מחלקה', 'צוות א', nodes);
  assert.equal(line.dimensions?.['מחלקה'], 'stable-1');
  assert.equal(resolveDimensionLabel(nodes, 'מחלקה', 'stable-1/צוות ב'), 'פיתוח Café/צוות ב');
});

test('entry parsing accepts Hebrew descriptions and split item account labels', () => {
  const entries = IntentResolver.resolveEntry('paid $123.45 for מחשב Office');
  assert.ok(entries);
  assert.equal(entries[0].amountCents, -12345);
  assert.equal(entries[0].description, 'מחשב office');
  const splits = IntentResolver.resolveEntry('חנות $100 ($40 ציוד, $60 תוכנה)');
  assert.ok(splits);
  assert.equal(splits[0].description, 'חנות');
  assert.deepEqual(splits[0].lines, [{ accountName: 'ציוד', amountCents: 4000 }, { accountName: 'תוכנה', amountCents: 6000 }]);
});

test('CSV round trip preserves Hebrew labels, punctuation, deep paths and document items', () => {
  const header = ['Name', 'Label', 'Amount', 'Items'];
  const row = ['לקוח Acme, בע"מ', 'מחלקה/פיתוח/צוות א', csvMoney(12345), 'מחשב ThinkPad\nמסך 27"'];
  assert.deepEqual(parseCsv(toCsv(header, [row]), ','), [header, row]);
});

test('dimensional balances keep distinct deep Hebrew projects in their original buckets', () => {
  const transactions = ['מחלקה/פיתוח/צוות א', 'מחלקה/פיתוח/צוות ב'].map((project, index) => makeTransaction({ id: `deep-${index}`, project, totalAmountCents: 10000, lines: [{ accountId: 'acc-1', amountCents: 10000, project }, { accountId: 'offset', amountCents: -10000, project }] }));
  const balances = LedgerEngine.computeDimensionalBalances([makeChartAccount(), makeChartAccount({ id: 'offset' })], transactions);
  assert.equal(balances.get('acc-1')!.projects.get('מחלקה/פיתוח/צוות א'), 10000);
  assert.equal(balances.get('acc-1')!.projects.get('מחלקה/פיתוח/צוות ב'), 10000);
  assert.equal(balances.get('acc-1')!.total, 20000);
});

test('classifier learns Hebrew words and returns a deep category with English options unchanged', () => {
  const classifier = new BayesianClassifier();
  for (let i = 0; i < 5; i++) {
    classifier.train('מחשב תוכנה שרת', 'הוצאות/טכנולוגיה/תוכנה', 3);
    classifier.train('ארוחה מסעדה קפה', 'הוצאות/מזון/מסעדות', 3);
  }
  const result = classifier.classifyHierarchical('מחשב תוכנה שרת');
  assert.ok(result);
  assert.equal(result.category, 'הוצאות/טכנולוגיה/תוכנה');
  assert.equal(result.rootCategory, 'הוצאות');
  assert.deepEqual(result.segments, ['הוצאות', 'טכנולוגיה', 'תוכנה']);
  assert.equal(result.depth, 3);
  assert.equal(classifier.classify('מַחְשֵׁב תוכנה שרת')?.category, result.category);
});

test('TF-IDF preserves distinct Hebrew vocabulary and canonical matching', () => {
  const transactions = [makeTransaction({ description: 'מחשב תוכנה Office' }), makeTransaction({ id: 'food', description: 'ארוחה מסעדה Market' })];
  const weights = computeTFIDFWeights(transactions);
  assert.ok(weights.has('מחשב'));
  assert.ok(weights.has('מסעדה'));
  assert.equal(similarityWithTFIDF('שלום מחשב', 'שָׁלוֹם מחשב', weights), 1);
  assert.equal(similarityWithTFIDF('מחשב תוכנה', 'ארוחה מסעדה', weights), 0);
});

test('rule induction uses Hebrew evidence instead of grouping merchants by shared English noise', () => {
  const transactions = Array.from({ length: 3 }, (_, index) => makeTransaction({ id: `rule-he-${index}`, description: 'מחשב שרת Office', verification: { status: 'verified', method: 'manual', hash: '', timestamp: '' }, lines: [{ accountId: 'software', accountName: 'הוצאות/תוכנה', amountCents: 10000 }] }));
  const rules = induceRules(transactions);
  assert.ok(rules.some(rule => rule.condition === 'מחשב שרת' && rule.targetAccount === 'הוצאות/תוכנה' && rule.support === 3));
});

test('mixed-language contact duplicates retain their Hebrew identity', () => {
  const groups = detectDuplicateContacts([{ id: 'a', name: 'שלום Market' }, { id: 'b', name: 'שָׁלוֹם MARKET' }, { id: 'c', name: 'שכירות Market' }]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].primaryContact.id, 'a');
  assert.deepEqual(groups[0].duplicates.map(contact => contact.id), ['b']);
  assert.ok(jaroWinklerSimilarity('שלוםco', 'שלום') < 1);
});

test('spreadsheet import recognizes Hebrew headings while keeping original item data and identity keys', () => {
  const header = ['שם פריט', 'מק״ט', 'תיאור', 'מחיר מכירה', 'עלות', 'כמות במלאי', 'קטגוריה'];
  const cells = [['מחשב Office', 'HE-01', 'מסך 27 אינץ', '123.45', '100', '2', 'ציוד/מחשבים']];
  const mapping = guessMapping('items', header);
  assert.equal(mapping.name, 0);
  assert.equal(mapping.sku, 1);
  const prepared = prepareImport('items', applyMapping('items', cells, mapping));
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.records[0].data.name, 'מחשב Office');
  assert.equal(prepared.records[0].data.unitPriceCents, 12345);
  assert.equal(prepared.records[0].data.category, 'ציוד/מחשבים');
  assert.deepEqual(prepared.records[0].keys, ['sku:he-01']);
  assert.deepEqual(identityKeys('customers', { name: 'Acme Inc.' }), ['name:acme inc.']);
  const contacts = prepareImport('customers', applyMapping('customers', [['לקוח Acme', 'owner@example.test', '0501234567']], guessMapping('customers', ['שם לקוח', 'דוא״ל', 'טלפון'])));
  assert.deepEqual(contacts.errors, []);
  assert.equal(contacts.records[0].data.name, 'לקוח Acme');
  assert.equal(contacts.records[0].data.email, 'owner@example.test');
  assert.equal(IMPORT_DEFINITIONS.items.fields.find(field => field.key === 'name')!.label, 'Name');
});

test('natural language commands retain quoted Hebrew payees and project labels', () => {
  const command = parseNaturalLanguageEntry('paid $40 to "חנות Market" for מחשב');
  assert.equal(command.type, 'transaction');
  assert.equal(command.amountCents, 4000);
  assert.equal(command.payee, 'חנות Market');
  assert.equal(parseNaturalLanguageEntry('paid שלום $40').payee, 'שלום');
  assert.equal(parseNaturalLanguageEntry('new project: פרויקט Alpha').projectName, 'פרויקט Alpha');
});
