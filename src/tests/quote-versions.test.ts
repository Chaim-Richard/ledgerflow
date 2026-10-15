/**
 * A-61: quote versions. Hand-checked: recording the same content twice never writes two
 * versions; the change list between two snapshots names the amount move, the line that changed
 * and the expiry; junk in the metadata is ignored; the portal label names the latest recorded
 * version and appears only when one exists.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUOTE_VERSIONS_METADATA_KEY, changesSinceLastVersion, compareQuoteVersions, customerVersionLabel,
  quoteChangeList, quoteVersionsCsvRows, quoteVersionsFromMetadata, quoteVersionsToMetadata,
  recordQuoteVersion, snapshotQuote, type QuoteSnapshot, type QuoteVersion,
} from '../lib/quoteVersions';
import { customerOpenQuotes } from '../lib/customerQuotes';

const june: QuoteSnapshot = {
  amountCents: 100_000,
  expiryDate: '2026-07-01',
  status: 'sent',
  notes: 'Net 30',
  lines: [
    { description: 'Design', quantity: 1, unitPriceCents: 60_000, amountCents: 60_000 },
    { description: 'Hosting', quantity: 4, unitPriceCents: 10_000, amountCents: 40_000 },
  ],
};

const october: QuoteSnapshot = {
  amountCents: 125_000,
  expiryDate: '2026-11-01',
  status: 'sent',
  notes: 'Net 30',
  lines: [
    { description: 'Design', quantity: 1, unitPriceCents: 60_000, amountCents: 60_000 },
    { description: 'Hosting', quantity: 5, unitPriceCents: 10_000, amountCents: 50_000 },
    { description: 'Training', quantity: 1, unitPriceCents: 15_000, amountCents: 15_000 },
  ],
};

describe('quote versions: snapshots and change lists', () => {
  test('a snapshot is the quote’s visible content, and missing numbers count as zero', () => {
    const snapshot = snapshotQuote({ amountCents: 100_000, status: 'draft', lines: [{ description: 'A', quantity: 2, unitPriceCents: 5_000, amountCents: 10_000 }] });
    assert.equal(snapshot.amountCents, 100_000);
    assert.equal(snapshot.lines.length, 1);
    assert.equal(snapshot.expiryDate, undefined);
    assert.equal(snapshotQuote({ amountCents: 0, status: 'draft' }).lines.length, 0);
  });

  test('the change list names the amount move, the changed line and the added line', () => {
    const changes = quoteChangeList(june, october);
    const kinds = changes.map(change => change.kind);
    assert.ok(kinds.includes('amount'));
    assert.ok(kinds.includes('expiry'));
    assert.ok(kinds.includes('line-changed'));
    assert.ok(kinds.includes('line-added'));
    assert.ok(!kinds.includes('notes'), 'unchanged notes are not a change');
    assert.match(changes.find(c => c.kind === 'amount')!.detail, /1000\.00 → 1250\.00 \(\+250\.00\)/);
    assert.match(changes.find(c => c.kind === 'line-changed')!.detail, /Hosting.*× 4.*→ × 5/);
    assert.match(changes.find(c => c.kind === 'line-added')!.detail, /Training/);
    assert.match(changes.find(c => c.kind === 'expiry')!.detail, /2026-07-01 → 2026-11-01/);
  });

  test('a removed line is named, and identical snapshots change nothing', () => {
    const removed = quoteChangeList(october, june);
    assert.match(removed.find(c => c.kind === 'line-removed')!.detail, /Training/);
    assert.deepEqual(quoteChangeList(june, june), []);
    const fromNothing = quoteChangeList(null, june);
    assert.equal(fromNothing[0].kind, 'amount');
    assert.match(fromNothing[0].detail, /first version/);
  });
});

describe('quote versions: recording', () => {
  test('the first version records, the same content again does not, a change does', () => {
    const first = recordQuoteVersion([], { snapshot: june, by: 'u1', byName: 'Dana', at: '2026-06-01T10:00:00Z' });
    assert.equal(first.recorded, true);
    assert.equal(first.versions.length, 1);
    const again = recordQuoteVersion(first.versions, { snapshot: june, by: 'u1', byName: 'Dana', at: '2026-06-02T10:00:00Z' });
    assert.equal(again.recorded, false, 'the same content is never recorded twice');
    assert.equal(again.versions.length, 1);
    const changed = recordQuoteVersion(first.versions, { snapshot: october, by: 'u2', byName: 'Lee', at: '2026-10-01T09:00:00Z' });
    assert.equal(changed.recorded, true);
    assert.equal(changed.versions.length, 2);
    assert.equal(changed.versions[1].byName, 'Lee');
    assert.equal(changed.versions[1].at, '2026-10-01T09:00:00Z');
    assert.ok(changed.changes.some(change => change.kind === 'amount'));
  });

  test('changes since the last version compare with what is recorded now', () => {
    const versions = recordQuoteVersion([], { snapshot: june, by: 'u1', at: '2026-06-01T10:00:00Z' }).versions;
    const pending = changesSinceLastVersion(versions, october);
    assert.ok(pending.some(change => change.kind === 'amount'));
    assert.deepEqual(changesSinceLastVersion(versions, june), []);
    assert.equal(changesSinceLastVersion([], october)[0].detail.includes('first version'), true);
  });

  test('two recorded versions compare by their indexes', () => {
    const versions: QuoteVersion[] = [
      ...recordQuoteVersion([], { snapshot: june, by: 'u1', at: '2026-06-01T10:00:00Z' }).versions,
      ...recordQuoteVersion([], { snapshot: october, by: 'u1', at: '2026-10-01T10:00:00Z' }).versions,
    ];
    const changes = compareQuoteVersions(versions, 0, 1);
    assert.ok(changes.some(change => change.kind === 'amount'));
    assert.deepEqual(compareQuoteVersions(versions, 1, 1), [], 'a version does not differ from itself');
    assert.deepEqual(compareQuoteVersions(versions, 0, 9), [], 'a missing version is nothing');
  });
});

describe('quote versions: metadata and the portal label', () => {
  test('junk in the metadata is ignored, real versions are kept, other keys survive a save', () => {
    const versions = quoteVersionsFromMetadata({
      [QUOTE_VERSIONS_METADATA_KEY]: [
        { at: '2026-06-01T10:00:00Z', by: 'u1', snapshot: june },
        { at: 'broken' }, 'not a version', null, { snapshot: { amountCents: 5 } },
      ],
    });
    assert.equal(versions.length, 1);
    assert.equal(versions[0].by, 'u1');
    assert.deepEqual(quoteVersionsFromMetadata({}), []);
    assert.deepEqual(quoteVersionsFromMetadata(null), []);
    const metadata = quoteVersionsToMetadata({ recordNotes: [1] }, versions);
    assert.deepEqual(metadata.recordNotes, [1], 'the record’s other metadata keys are kept');
    assert.equal((metadata[QUOTE_VERSIONS_METADATA_KEY] as unknown[]).length, 1);
  });

  test('the customer sees the latest: the label names the last recorded version', () => {
    assert.equal(customerVersionLabel([]), undefined);
    const versions = quoteVersionsFromMetadata({ [QUOTE_VERSIONS_METADATA_KEY]: [
      { at: '2026-06-01T10:00:00Z', by: 'u1', snapshot: june },
      { at: '2026-10-01T10:00:00Z', by: 'u1', snapshot: october },
    ] });
    assert.equal(customerVersionLabel(versions), 'Version 2 · recorded 2026-10-01');
    const [item] = customerOpenQuotes([
      {
        id: 'e1', customerId: 'c1', number: 'Q-1', date: '2026-10-01', amountCents: 125_000,
        status: 'sent', lines: [], metadata: { [QUOTE_VERSIONS_METADATA_KEY]: [
          { at: '2026-06-01T10:00:00Z', by: 'u1', snapshot: june },
          { at: '2026-10-01T10:00:00Z', by: 'u1', snapshot: october },
        ] },
      },
    ], 'c1', '2026-10-15');
    assert.equal(item.amountCents, 125_000, 'the portal shows the estimate as it is now — the latest content');
    assert.equal(item.versionLabel, 'Version 2 · recorded 2026-10-01');
  });

  test('the CSV names each version and what changed', () => {
    const versions = quoteVersionsFromMetadata({ [QUOTE_VERSIONS_METADATA_KEY]: [
      { at: '2026-06-01T10:00:00Z', by: 'u1', byName: 'Dana', snapshot: june },
      { at: '2026-10-01T10:00:00Z', by: 'u1', byName: 'Dana', snapshot: october },
    ] });
    const rows = quoteVersionsCsvRows(versions);
    assert.equal(rows.length, 2);
    assert.match(rows[0][6], /first version/);
    assert.match(rows[1][6], /amount 1000\.00 → 1250\.00/);
  });
});
