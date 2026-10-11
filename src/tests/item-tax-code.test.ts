/** A-7 (CA-16): choosing an item fills its default tax code, once, and only a code the workspace still has. */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { taxCodeToFillFromItem } from '../lib/itemTaxCode';

const codes = ['gst', 'zero'];

describe('item default tax code', () => {
  test('a newly chosen item with a default fills that code', () => {
    assert.equal(taxCodeToFillFromItem(undefined, { id: 'i1', defaultTaxCodeId: 'gst' }, codes), 'gst');
  });

  test('switching from one item to another fills the new item’s code', () => {
    assert.equal(taxCodeToFillFromItem('i1', { id: 'i2', defaultTaxCodeId: 'zero' }, codes), 'zero');
  });

  test('re-choosing the same item does not overwrite a code the person changed', () => {
    assert.equal(taxCodeToFillFromItem('i1', { id: 'i1', defaultTaxCodeId: 'gst' }, codes), undefined);
  });

  test('an item without a default leaves the line and its tax choice as they were', () => {
    assert.equal(taxCodeToFillFromItem(undefined, { id: 'i1' }, codes), undefined);
    assert.equal(taxCodeToFillFromItem(undefined, undefined, codes), undefined);
  });

  test('a default code that was deleted from Taxes is not filled', () => {
    assert.equal(taxCodeToFillFromItem(undefined, { id: 'i1', defaultTaxCodeId: 'gone' }, codes), undefined);
  });
});
