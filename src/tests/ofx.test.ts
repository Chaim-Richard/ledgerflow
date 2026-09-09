import { test, describe } from 'node:test';
import assert from 'node:assert';
import { generateOFX } from '../lib/ofx-exporter';
import { ChartAccount, Transaction } from '../types';

describe('OFX Exporter Utility', () => {
  const mockCheckingAccount: ChartAccount = {
    id: 'acc-checking-1',
    uid: 'user-1',
    workspaceId: 'ws-1',
    code: '1000',
    name: 'Operating Checking',
    type: 'asset',
    category: 'Cash',
    currency: 'EUR',
    bankId: '123456789',
    accountType: 'CHECKING',
    balanceCents: 500000
  };

  const mockCreditCardAccount: ChartAccount = {
    id: 'acc-cc-1',
    uid: 'user-1',
    workspaceId: 'ws-1',
    code: '2000',
    name: 'Corporate Credit Card',
    type: 'liability',
    category: 'Payables',
    currency: 'USD',
    balanceCents: -125000
  };

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      uid: 'user-1',
      workspaceId: 'ws-1',
      date: '2026-03-15',
      description: 'Client Deposit Invoice #101',
      currency: 'EUR',
      totalAmountCents: 150000,
      lines: [
        { accountId: 'acc-checking-1', accountName: 'Operating Checking', amountCents: 150000 },
        { accountId: 'acc-rev-1', accountName: 'Consulting Revenue', amountCents: -150000 }
      ],
      status: 'certified',
      type: 'actual',
      createdAt: '2026-03-15T12:00:00Z'
    },
    {
      id: 'tx-2',
      uid: 'user-1',
      workspaceId: 'ws-1',
      date: '2026-03-16',
      description: 'Office Supplies Store',
      currency: 'EUR',
      totalAmountCents: 4500,
      lines: [
        { accountId: 'acc-checking-1', accountName: 'Operating Checking', amountCents: -4500 },
        { accountId: 'acc-exp-1', accountName: 'Office Expenses', amountCents: 4500 }
      ],
      status: 'certified',
      type: 'actual',
      createdAt: '2026-03-16T12:00:00Z'
    }
  ];

  test('generates valid OFX header and account parameters for asset accounts', () => {
    const ofx = generateOFX(mockTransactions, mockCheckingAccount);
    assert.match(ofx, /<CURDEF>EUR/);
    assert.match(ofx, /<BANKID>123456789/);
    assert.match(ofx, /<ACCTID>1000/);
    assert.match(ofx, /<ACCTTYPE>CHECKING/);
    assert.match(ofx, /<TRNTYPE>CREDIT/);
    assert.match(ofx, /<TRNAMT>1500\.00/);
    assert.match(ofx, /<TRNTYPE>DEBIT/);
    assert.match(ofx, /<TRNAMT>-45\.00/);
    assert.match(ofx, /<BALAMT>5000\.00/);
  });

  test('derives default CREDITLINE account type for liability accounts', () => {
    const ofx = generateOFX([], mockCreditCardAccount);
    assert.match(ofx, /<CURDEF>USD/);
    assert.match(ofx, /<BANKID>999999999/);
    assert.match(ofx, /<ACCTID>2000/);
    assert.match(ofx, /<ACCTTYPE>CREDITLINE/);
    assert.match(ofx, /<BALAMT>-1250\.00/);
  });
});
