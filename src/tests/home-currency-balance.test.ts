import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineAmount, settleHomeCurrency } from '../lib/txFilters';
import type { Transaction } from '../types';

// BUG-07: an entry in a foreign currency balances in the home currency too.
const sumHome = (t: Transaction) => t.lines.reduce((s, l) => s + lineAmount(l, t), 0);

test('rounding at one rate: the cent goes to the largest line and the entry balances at home', () => {
  const t = { lines: [{ accountId: 'a', amountCents: 33, exchangeRate: 1.015 }, { accountId: 'b', amountCents: 33, exchangeRate: 1.015 }, { accountId: 'c', amountCents: -66, exchangeRate: 1.015 }] } as Transaction;
  assert.notEqual(t.lines.reduce((s, l) => s + Math.round(l.amountCents * 1.015), 0), 0, 'converted line by line, it does not balance');
  settleHomeCurrency(t);
  assert.equal(sumHome(t), 0);
  assert.ok(t.lines.every(l => Number.isInteger(l.baseAmountCents)));
});

test('the audit case: two rates a cent apart — settled as rounding', () => {
  const t = { lines: [{ accountId: 'a', amountCents: 100, exchangeRate: 1.083 }, { accountId: 'b', amountCents: -100, exchangeRate: 1.087 }] } as Transaction;
  settleHomeCurrency(t);
  assert.equal(sumHome(t), 0);
});

test('different rates far apart are refused: post an exchange difference instead', () => {
  const t = { lines: [{ accountId: 'a', amountCents: 100000, exchangeRate: 1.08 }, { accountId: 'b', amountCents: -100000, exchangeRate: 1.10 }] } as Transaction;
  assert.throws(() => settleHomeCurrency(t), /exchange-difference/);
});

test('home-currency entries are untouched', () => {
  const t = { lines: [{ accountId: 'a', amountCents: 100 }, { accountId: 'b', amountCents: -100 }] } as Transaction;
  settleHomeCurrency(t);
  assert.ok(t.lines.every(l => l.baseAmountCents === undefined));
});
