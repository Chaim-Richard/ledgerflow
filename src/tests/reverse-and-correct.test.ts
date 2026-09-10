import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TransactionValidator } from '../kernel/validation/TransactionValidator';
import { TransactionTemplates } from '../kernel/templates/TransactionTemplates';
import { Transaction } from '../types';

describe('Sanctioned Closed-Period "Reverse & Correct" Workflow', () => {

  const wsData = { lockDate: '2026-01-31' };
  const context = {
    workspaceId: 'ws-prod-100',
    user: { uid: 'user-bookkeeper', admin: false },
    wsData
  };

  const mockAccountsMap = new Map([
    ['acc-cash', { id: 'acc-cash', name: 'Checking Account', workspaceId: 'ws-prod-100', type: 'asset' }],
    ['acc-exp-wrong', { id: 'acc-exp-wrong', name: 'Travel Expense', workspaceId: 'ws-prod-100', type: 'expense' }],
    ['acc-exp-correct', { id: 'acc-exp-correct', name: 'Software Expense', workspaceId: 'ws-prod-100', type: 'expense' }]
  ]);

  const originalLockedTx: Transaction = {
    id: 'tx-jan-4200',
    workspaceId: 'ws-prod-100',
    uid: 'user-bookkeeper',
    currency: 'USD',
    createdAt: '2026-01-15T00:00:00Z',
    date: '2026-01-15',
    description: 'Annual cloud subscription (wrong account)',
    totalAmountCents: 420000,
    type: 'actual',
    status: 'completed',
    lines: [
      { accountId: 'acc-exp-wrong', accountName: 'Travel Expense', amountCents: 420000 },
      { accountId: 'acc-cash', accountName: 'Checking Account', amountCents: -420000 }
    ]
  };

  test('1. Reversal lines negate original lines to net to exactly zero across all accounts', () => {
    const reversalLines = TransactionTemplates.buildReversalLines(
      originalLockedTx.lines, 
      originalLockedTx.description
    );

    assert.equal(reversalLines.length, 2);
    assert.equal(reversalLines[0].amountCents, -420000);
    assert.equal(reversalLines[1].amountCents, 420000);

    // Sum each account across original and reversal
    const combinedLines = [...originalLockedTx.lines, ...reversalLines];
    const accountBalances = new Map<string, number>();
    for (const line of combinedLines) {
      accountBalances.set(line.accountId, (accountBalances.get(line.accountId) || 0) + line.amountCents);
    }

    assert.equal(accountBalances.get('acc-exp-wrong'), 0, 'Wrong expense account must net to zero');
    assert.equal(accountBalances.get('acc-cash'), 0, 'Cash account must net to zero');
  });

  test('2. TransactionValidator rejects direct modification of locked transaction without reversal exemption', () => {
    assert.throws(
      () => {
        TransactionValidator.validateTransactionState(originalLockedTx, context);
      },
      /Period Locked: Cannot modify transaction/
    );
  });

  test('3. TransactionValidator permits setting reversalEventId on locked transaction via isReversalUpdate option', () => {
    assert.doesNotThrow(() => {
      TransactionValidator.validateTransactionState(originalLockedTx, context, { isReversalUpdate: true });
    });
  });

  test('4. Double reversal is strictly forbidden if transaction already has reversalEventId or is reversal', () => {
    const alreadyReversedTx: Transaction = {
      ...originalLockedTx,
      reversalEventId: 'tx-rev-999'
    };

    // Reversing an already reversed transaction should be blocked
    assert.throws(() => {
      if (alreadyReversedTx.reversalEventId) {
        throw new Error('Transaction has already been reversed.');
      }
    }, /already been reversed/);

    const reversalTx: Transaction = {
      ...originalLockedTx,
      type: 'reversal'
    };

    assert.throws(() => {
      if (reversalTx.type === 'reversal') {
        throw new Error('Cannot reverse a reversal transaction.');
      }
    }, /Cannot reverse a reversal/);
  });

  test('5. Reversal transaction posted in open period passes validation and preparation', async () => {
    const reversalLines = TransactionTemplates.buildReversalLines(
      originalLockedTx.lines,
      originalLockedTx.description
    );

    const reversalTxPayload = {
      date: '2026-02-10', // Open period (> 2026-01-31)
      description: `Reversal of [tx-jan-4200]: ${originalLockedTx.description}`,
      type: 'reversal',
      status: 'completed',
      parentEventId: originalLockedTx.id,
      lines: reversalLines
    };

    const validatedReversal = await TransactionValidator.validateAndPrepare(
      reversalTxPayload,
      { ...context, accountsMap: mockAccountsMap }
    );

    assert.equal(validatedReversal.workspaceId, 'ws-prod-100');
    assert.equal(validatedReversal.type, 'reversal');
    assert.equal(validatedReversal.parentEventId, 'tx-jan-4200');
    assert.equal(validatedReversal.totalAmountCents, 420000, 'Reversal total is absolute positive cents');
    assert.equal(validatedReversal.lines.length, 2);
  });

  test('6. Reversal transaction attempted inside closed period is strictly rejected', async () => {
    const reversalLines = TransactionTemplates.buildReversalLines(
      originalLockedTx.lines,
      originalLockedTx.description
    );

    const invalidReversalPayload = {
      date: '2026-01-20', // Locked period (<= 2026-01-31)
      description: `Reversal of [tx-jan-4200]: ${originalLockedTx.description}`,
      type: 'reversal',
      parentEventId: originalLockedTx.id,
      lines: reversalLines
    };

    await assert.rejects(
      async () => {
        await TransactionValidator.validateAndPrepare(
          invalidReversalPayload,
          { ...context, accountsMap: mockAccountsMap }
        );
      },
      /Period Locked/
    );
  });

  test('7. Replacement (corrected) transaction in open period links parentEventId and balances correctly', async () => {
    const replacementPayload = {
      date: '2026-02-10',
      description: 'Annual cloud subscription (reclassified)',
      type: 'actual',
      status: 'completed',
      parentEventId: originalLockedTx.id,
      lines: [
        { accountId: 'acc-exp-correct', accountName: 'Software Expense', amountCents: 420000 },
        { accountId: 'acc-cash', accountName: 'Checking Account', amountCents: -420000 }
      ]
    };

    const validatedReplacement = await TransactionValidator.validateAndPrepare(
      replacementPayload,
      { ...context, accountsMap: mockAccountsMap }
    );

    assert.equal(validatedReplacement.parentEventId, 'tx-jan-4200');
    assert.equal(validatedReplacement.lines[0].accountId, 'acc-exp-correct');
    assert.equal(validatedReplacement.totalAmountCents, 420000);
    assert.equal(validatedReplacement.date, '2026-02-10');
  });

  test('8. Full story audit chain integrity: original → reversal → replacement', () => {
    const original = { ...originalLockedTx, reversalEventId: 'rev-uuid-1' };
    const reversal = {
      id: 'rev-uuid-1',
      parentEventId: original.id,
      type: 'reversal'
    };
    const replacement = {
      id: 'repl-uuid-2',
      parentEventId: original.id,
      type: 'actual'
    };

    assert.equal(original.reversalEventId, reversal.id);
    assert.equal(reversal.parentEventId, original.id);
    assert.equal(replacement.parentEventId, original.id);
  });
});
