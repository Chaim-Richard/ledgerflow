import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { parseMT940Statement } from '../lib/mt940Parser';
import { parseCamt053Statement } from '../lib/camt053Parser';
import { scoreReceiptMatches } from '../lib/receiptMatcher';
import { convertXeroAccounts } from '../lib/xeroAdapter';
import { Transaction } from '../types';

describe('Integrations & File Formats Suite (Items 147 - 150)', () => {

  describe('1. MT940 Parser (Item 148)', () => {
    test('parseMT940Statement parses dates, debit/credit indicators, and amounts', () => {
      const sampleMt940 = `
:20:START
:25:US123456789
:28C:00001
:60F:C260901USD10000,00
:61:2609150915C500,00NTRFNONREF
:86:Payment from Acme Client
:61:2609160916D150,50NTRFNONREF
:86:Software Subscription Fee
:62F:C260916USD10349,50
`;

      const lines = parseMT940Statement(sampleMt940);

      assert.equal(lines.length, 2);
      assert.equal(lines[0].date, '2026-09-15');
      assert.equal(lines[0].amountCents, 50000);
      assert.equal(lines[0].type, 'credit');
      assert.equal(lines[0].description, 'Payment from Acme Client');

      assert.equal(lines[1].date, '2026-09-16');
      assert.equal(lines[1].amountCents, -15050);
      assert.equal(lines[1].type, 'debit');
    });
  });

  describe('2. CAMT.053 XML Parser (Item 148)', () => {
    test('parseCamt053Statement parses XML nodes and returns normalized bank lines', () => {
      const sampleCamt = `
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Ntry>
        <Amt Ccy="USD">1250.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-09-12</Dt></BookgDt>
        <NtryDtls><TxDtls><RmtInf><Ustrd>Consulting Payment Acme</Ustrd></RmtInf></TxDtls></NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>
`;

      const lines = parseCamt053Statement(sampleCamt);

      assert.equal(lines.length, 1);
      assert.equal(lines[0].date, '2026-09-12');
      assert.equal(lines[0].amountCents, 125000);
      assert.equal(lines[0].description, 'Consulting Payment Acme');
    });
  });

  describe('3. Receipt-to-Transaction Auto-Matching (Item 150)', () => {
    test('scoreReceiptMatches ranks transactions by amount, date, and merchant similarity', () => {
      const receipt = {
        id: 'rec_100',
        vendorName: 'Home Depot',
        date: '2026-09-10',
        totalAmountCents: 14999
      };

      const candidates: Transaction[] = [
        {
          id: 'tx_exact',
          uid: 'usr_1',
          workspaceId: 'ws_test',
          date: '2026-09-10',
          description: 'Home Depot Store #412',
          totalAmountCents: 14999,
          currency: 'USD',
          status: 'completed',
          type: 'expense',
          createdAt: '2026-09-10T00:00:00Z',
          lines: [
            { accountId: 'acc_exp', accountName: 'Office Expense', amountCents: 14999 },
            { accountId: 'acc_cash', accountName: 'Cash', amountCents: -14999 }
          ]
        },
        {
          id: 'tx_different_amount',
          uid: 'usr_1',
          workspaceId: 'ws_test',
          date: '2026-09-10',
          description: 'Office Depot',
          totalAmountCents: 5000,
          currency: 'USD',
          status: 'completed',
          type: 'expense',
          createdAt: '2026-09-10T00:00:00Z',
          lines: [
            { accountId: 'acc_exp', accountName: 'Office Expense', amountCents: 5000 },
            { accountId: 'acc_cash', accountName: 'Cash', amountCents: -5000 }
          ]
        }
      ];

      const matches = scoreReceiptMatches(receipt, candidates);

      assert.equal(matches.length, 1);
      assert.equal(matches[0].transaction.id, 'tx_exact');
      assert.equal(matches[0].confidence, 'high');
      assert.ok(matches[0].score >= 0.8);
    });
  });

  describe('4. Xero Migration Adapter (Item 147)', () => {
    test('convertXeroAccounts maps Xero COA export types to standard categories', () => {
      const xeroRows = [
        { Code: '090', Name: 'Business Bank Account', Type: 'BANK' },
        { Code: '200', Name: 'Sales Income', Type: 'REVENUE' },
        { Code: '400', Name: 'Advertising', Type: 'EXPENSE' }
      ];

      const accounts = convertXeroAccounts(xeroRows, 'ws_import');

      assert.equal(accounts.length, 3);
      assert.equal(accounts[0].type, 'asset');
      assert.equal(accounts[1].type, 'income');
      assert.equal(accounts[2].type, 'expense');
    });
  });
});
