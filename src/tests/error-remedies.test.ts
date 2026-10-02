/** Errors say what to do (BO-07). */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { describeError } from '../lib/errorRemedies';

describe('Error remedies', () => {
  test('common causes get a plain title and what to do', () => {
    assert.match(describeError(new Error('This period is locked')).remedy, /Month-End Close/);
    assert.match(describeError(new Error('new row violates row-level security policy (invoices)')).title, /permission/);
    assert.match(describeError(new Error('Forbidden: requires owner, accountant, or bookkeeper role')).remedy, /Settings → Team/);
    assert.match(describeError(new Error('Field "totalCents" is not allowed on invoices')).remedy, /report it/);
    assert.match(describeError(new TypeError('Failed to fetch')).title, /reach the server/);
    assert.match(describeError(new Error('Sign in required')).title, /session ended/);
    assert.match(describeError(new Error('duplicate key value violates unique constraint')).title, /already exists/);
    assert.match(describeError(new Error('Transaction is unbalanced')).title, /balance/);
    assert.match(describeError({ message: 'Amount must be greater than zero' }).remedy, /Amount must be greater than zero/);
  });

  test('anything else names what failed and how to report it', () => {
    const d = describeError(new Error('weird'), 'create');
    assert.equal(d.title, 'Something went wrong while saving');
    assert.match(d.remedy, /Help → Support/);
  });
});
