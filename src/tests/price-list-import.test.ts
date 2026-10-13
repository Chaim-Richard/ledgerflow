/**
 * A-80: price lists from CSV. Columns read by name; bad rows are reported by line and left out; the
 * rest imports into the lists (matched by name and currency), keeps the previous lists for undo,
 * and the result follows the price-list rules.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoneyCents, planPriceListImport, readPriceListCsv } from '../lib/priceListImport';
import type { PriceList } from '../lib/priceLists';

const items = [{ id: 'chair', sku: 'CH-1' }, { id: 'desk', sku: 'DE-1' }, { id: 'dup1', sku: 'SAME' }, { id: 'dup2', sku: 'same' }];
let counter = 0;
const newId = () => `pl_import${String(++counter).padStart(2, '0')}`;

describe('A-80 price list CSV import', () => {
  test('reads Item, List, Price, Discount and Currency by name, in any column order', () => {
    const csv = 'List,Price,Item,Currency\nWholesale,45.00,CH-1,\nWholesale,\u00a0,DE-1,\n';
    const read = readPriceListCsv(csv, items);
    assert.equal(read.headerProblem, undefined);
    assert.equal(read.rows.length, 1, 'a blank price with no discount is a problem row, not a price');
    assert.deepEqual(read.rows[0], { line: 2, itemId: 'chair', list: 'Wholesale', priceCents: 4500 });
    assert.match(read.problems[0].message, /Give a price or a discount/);
  });

  test('a file without the needed columns is refused with a plain message', () => {
    const read = readPriceListCsv('Name,Amount\nChair,10\n', items);
    assert.match(String(read.headerProblem), /Item, List and Price/);
    assert.equal(read.rows.length, 0);
  });

  test('bad rows are reported with their line number; the good rows still come through', () => {
    const csv = 'Item;List;Price;Currency\nCH-1;Retail;100,50;EUR\nNOPE;Retail;5;\nDE-1;Retail;12.345;\nDE-1;Retail;12.5;XXXX\nSAME;Retail;1;\n\nDE-1;Retail;12.5;\n';
    const read = readPriceListCsv(csv, items);
    assert.deepEqual(read.rows.map(r => [r.line, r.itemId, r.priceCents, r.currency]), [[2, 'chair', 10050, 'EUR'], [7, 'desk', 1250, undefined]]);
    assert.deepEqual(read.problems.map(p => p.line), [3, 4, 5, 6], 'unknown SKU, too many decimals, bad currency, duplicate SKU');
    assert.deepEqual(read.rows.map(r => r.line), [2, 7], 'the blank line is not counted: the last row is record 7');
    assert.match(read.problems[1].message, /not an amount/);
    assert.match(read.problems[2].message, /three-letter/);
    assert.match(read.problems[3].message, /more than one item/);
  });

  test('a discount applies to the whole list; a row can give a discount instead of a price', () => {
    const read = readPriceListCsv('Item,List,Discount %\nCH-1,Staff,15\nDE-1,Staff,15\n', items);
    assert.deepEqual(read.rows.map(r => r.discountPercent), [15, 15]);
    assert.equal(read.problems.length, 0);
  });

  test('money text: plain decimals only; a comma decimal is read; thousands separators are not', () => {
    assert.equal(parseMoneyCents('12.5'), 1250);
    assert.equal(parseMoneyCents('12,50'), 1250);
    assert.equal(parseMoneyCents('1,250.00'), null);
    assert.equal(parseMoneyCents('-3'), null);
    assert.equal(parseMoneyCents('0'), 0);
  });

  test('the import sets prices into the list by name, creates unknown lists, and keeps the old lists for undo', () => {
    const existing: PriceList[] = [{ id: 'pl_wholesale1', name: 'Wholesale', discountPercent: 10, customerIds: ['cus_a'] }];
    const read = readPriceListCsv('Item,List,Price\nCH-1,wholesale,40\nDE-1,Retail,99\n', items);
    const plan = planPriceListImport(existing, read.rows, newId);
    assert.equal(plan.problem, null);
    assert.equal(plan.createdLists, 1);
    assert.equal(plan.pricesSet, 2);
    assert.equal(plan.lists.length, 2);
    assert.equal(plan.lists[0].prices?.chair, 4000, 'matched by name, ignoring case');
    assert.equal(plan.lists[0].discountPercent, 10, 'the discount is kept');
    assert.deepEqual(plan.lists[0].customerIds, ['cus_a']);
    assert.equal(plan.lists[1].name, 'Retail');
    assert.deepEqual(plan.previous, existing, 'the previous lists are kept to undo the import');
    assert.equal(existing[0].prices, undefined, 'the input is not changed');
  });

  test('a list in another currency is a different list, and the rules still apply to the result', () => {
    const existing: PriceList[] = [{ id: 'pl_wholesale1', name: 'Wholesale', discountPercent: 10 }];
    const read = readPriceListCsv('Item,List,Price,Currency\nCH-1,Wholesale,40,EUR\n', items);
    const plan = planPriceListImport(existing, read.rows, newId);
    assert.match(String(plan.problem), /in the list twice/, 'names must stay unique across currencies in this release');
  });
});
