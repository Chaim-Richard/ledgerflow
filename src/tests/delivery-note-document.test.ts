/**
 * A-46: delivery notes as a document. What left on one delivery (never the whole order), no prices
 * unless asked, English or Hebrew (right to left), a series of its own (DN-YYYY-NNN), and nothing
 * invented: a delivery with no lines on the order gives no note.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeliveryNote, deliveryNoteColumns, nextDeliveryNoteNumber, DELIVERY_NOTE_LABELS, type DeliveryNoteDocument, type DeliveryNoteInput, type DeliveryNoteOrder } from '../lib/deliveryNoteDocument';

/** A note that must exist for these cases (the null cases call buildDeliveryNote directly). */
function built(input: DeliveryNoteInput): DeliveryNoteDocument {
  const note = buildDeliveryNote(input);
  assert.ok(note, 'a delivery note');
  return note;
}

const order: DeliveryNoteOrder = {
  id: 'est_1',
  number: 'SO-2026-014',
  customerName: 'Acme Ltd',
  customerReference: 'PO-77',
  lines: [
    { description: 'Oak chair', unitPriceCents: 4500, measurementUnit: 'each' },
    { description: 'Desk\u0007 lamp', unitPriceCents: 1250 },
    { description: 'Cable', unitPriceCents: 300, measurementUnit: 'm' },
  ],
};

const delivery = {
  deliveryId: 'dlv_abcdef12',
  date: '2026-10-05',
  lines: [
    { position: 2, itemId: 'cable', quantity: 10, entryId: 'e2' },
    { position: 0, itemId: 'chair', quantity: 2, entryId: 'e1' },
  ],
};

describe('A-46 delivery notes', () => {
  test('shows what this delivery sent, in the order\'s line order, not the whole order', () => {
    const note = built({ order, delivery, number: 'DN-2026-001', company: 'Ledger Co' });
    assert.ok(note);
    assert.deepEqual(note.rows.map(r => [r.line, r.item, r.quantity, r.unit]), [[1, 'Oak chair', 2, 'each'], [2, 'Cable', 10, 'm']]);
    assert.equal(note.number, 'DN-2026-001');
    assert.equal(note.order, 'SO-2026-014');
    assert.equal(note.customerReference, 'PO-77');
    assert.equal(note.date, '2026-10-05');
  });

  test('no prices by default: no unit price, amount or total is on the note', () => {
    const note = built({ order, delivery, number: 'DN-2026-001' });
    assert.equal(note.showPrices, false);
    assert.equal(note.totalCents, undefined);
    assert.ok(note.rows.every(r => r.unitPriceCents === undefined && r.amountCents === undefined));
    assert.deepEqual(deliveryNoteColumns(false), ['Item', 'Quantity']);
  });

  test('with prices asked for, each amount is whole cents and the total adds them', () => {
    const note = built({ order, delivery, number: 'DN-2026-001', showPrices: true });
    assert.deepEqual(note.rows.map(r => r.amountCents), [9000, 3000]);
    assert.equal(note.totalCents, 12000);
    assert.deepEqual(deliveryNoteColumns(true), ['Item', 'Quantity', 'Unit price', 'Amount']);
  });

  test('Hebrew: right to left, Hebrew labels, the same figures', () => {
    const note = built({ order, delivery, number: 'DN-2026-001', language: 'he' });
    assert.equal(note.direction, 'rtl');
    assert.equal(note.labels.title, 'תעודת משלוח');
    assert.equal(note.labels.quantity, DELIVERY_NOTE_LABELS.he.quantity);
    assert.deepEqual(note.rows.map(r => r.quantity), [2, 10]);
    assert.equal(deliveryNoteColumns(false, 'he')[1], 'כמות');
  });

  test('English is left to right, and an unknown language falls back to English', () => {
    assert.equal(built({ order, delivery, number: 'DN-2026-001' }).direction, 'ltr');
    assert.equal(built({ order, delivery, number: 'DN-2026-001', language: 'fr' as never }).language, 'en');
  });

  test('a delivery with no lines on the order gives no note; so do zero quantities and bad positions', () => {
    assert.equal(buildDeliveryNote({ order, delivery: { deliveryId: 'x', date: '2026-10-05', lines: [] }, number: 'DN-1' }), null);
    assert.equal(buildDeliveryNote({ order, delivery: { deliveryId: 'x', date: '2026-10-05', lines: [{ position: 0, itemId: 'a', quantity: 0, entryId: 'e' }] }, number: 'DN-1' }), null);
    assert.equal(buildDeliveryNote({ order, delivery: { deliveryId: 'x', date: '2026-10-05', lines: [{ position: 9, itemId: 'a', quantity: 1, entryId: 'e' }] }, number: 'DN-1' }), null);
  });

  test('control characters are removed from the printed text', () => {
    const note = built({ order, delivery: { deliveryId: 'x', date: '2026-10-05', lines: [{ position: 1, itemId: 'lamp', quantity: 1, entryId: 'e' }] }, number: 'DN-1' });
    assert.equal(note.rows[0].item, 'Desk  lamp');
  });

  test('a line without a description still prints a dash, never a blank', () => {
    const blank: DeliveryNoteOrder = { id: 'o', lines: [{}] };
    const note = built({ order: blank, delivery: { deliveryId: 'x', date: '2026-10-05', lines: [{ position: 0, itemId: 'a', quantity: 1, entryId: 'e' }] }, number: 'DN-1' });
    assert.equal(note.rows[0].item, '—');
  });
});

describe('A-46 numbering: its own series', () => {
  test('the first note of the year is DN-YYYY-001', () => {
    assert.equal(nextDeliveryNoteNumber([], '2026'), 'DN-2026-001');
  });

  test('the next number follows the highest existing one, and other series are ignored', () => {
    const existing = ['DN-2026-007', 'DN-2026-010', 'PO-2026-099', 'INV-2026-500', 'DN-2025-900', 'DN-2026-x', ''];
    assert.equal(nextDeliveryNoteNumber(existing, '2026'), 'DN-2026-011');
  });

  test('a number past 999 keeps its digits', () => {
    assert.equal(nextDeliveryNoteNumber(['DN-2026-999'], '2026'), 'DN-2026-1000');
  });
});
