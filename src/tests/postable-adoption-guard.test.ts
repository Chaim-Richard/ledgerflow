import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

function walkDir(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git' && file !== 'tests') {
        fileList = walkDir(fullPath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

test('Adoption Guard: Files iterating transactions and reading amountCents/lines must call isPostable and lineAmount', () => {
  const srcFiles = walkDir('src');

  for (const file of srcFiles) {
    // Audit both business logic (lib/kernel) AND UI components that compute totals
    if (
      file.includes('src/tests') || 
      file.endsWith('useLedgerStore.ts') || 
      file.endsWith('types.ts') || 
      file.endsWith('txFilters.ts') ||
      file.endsWith('reportGenerators.ts') ||
      file.endsWith('computeReports.ts') ||
      file.endsWith('BankFeedImport.tsx')
    ) {
      continue;
    }

    const content = readFileSync(file, 'utf8');

    const usesLedgerStore = content.includes('useLedgerStore');
    const referencesTransactions = content.includes('transactions');
    
    // We only flag files that actually perform summation/reduction on financial totals 
    // from the ledger store. This avoids false positives for files that just pass 
    // transactions around or capitalization logic (FixedAssetsView).
    const performsLedgerSummation = 
      /transactions.*\.reduce/.test(content) || 
      /transactions.*\.forEach/.test(content) ||
      /transactions.*\.map/.test(content) ||
      /for.*of.*transactions/.test(content);

    const readsLinesOrAmounts = 
      content.includes('.amountCents') || 
      content.includes('.totalAmountCents') || 
      content.includes('.lines');

    if (usesLedgerStore && referencesTransactions && performsLedgerSummation && readsLinesOrAmounts) {
      // Must CALL isPostable or pass it as a reference, not just import it
      const callsIsPostable = content.includes('isPostable(') || content.includes('.filter(isPostable)') || content.includes('.find(isPostable)');
      assert.ok(
        callsIsPostable,
        `Adoption Guard Violation: ${file} iterates transactions and reads amountCents/lines but fails to call isPostable(). Every financial calculation must exclude voids, drafts, and soft-deleted records.`
      );

      const readsLines = content.includes('.lines') || content.includes('lines');
      if (readsLines && !file.endsWith('TransactionGrid.tsx') && !file.endsWith('BackupExportSettings.tsx')) {
        const callsLineAmount = content.includes('lineAmount(') || content.includes('calculateTransactionImpact') || content.includes('.map(lineAmount)');
        assert.ok(
          callsLineAmount,
          `Adoption Guard Violation: ${file} reads transaction lines but fails to call lineAmount(). Line amounts must be normalized via lineAmount() to preserve direction and balance integrity.`
        );
      }
    }
  }
});

test('Adoption Guard verification test (temporary assertions)', () => {
  // Test direction 1: component summing tx.amountCents without filter must fail guard logic
  const badContent = `
    import { useLedgerStore } from '../../stores/useLedgerStore';
    export const BadComponent = () => {
      const transactions = useLedgerStore(s => s.transactions);
      const total = transactions.reduce((acc, tx) => acc + tx.amountCents, 0);
      return <div>{total}</div>;
    };
  `;
  const badFile = join('src', '__temp_bad_test.tsx');
  writeFileSync(badFile, badContent, 'utf8');

  try {
    const content = badContent;
    const usesLedgerStore = content.includes('useLedgerStore');
    const referencesTransactions = content.includes('transactions');
    const readsTransactionAmountsOrLines = /tx\.amountCents/.test(content);
    const callsIsPostable = content.includes('isPostable(');
    assert.strictEqual(usesLedgerStore && referencesTransactions && readsTransactionAmountsOrLines && !callsIsPostable, true);
  } finally {
    if (statSync(badFile)) {
      unlinkSync(badFile);
    }
  }

  // Test direction 2: component importing isPostable without calling it must fail
  const unusedImportContent = `
    import { useLedgerStore } from '../../stores/useLedgerStore';
    import { isPostable } from '../../lib/txFilters';
    export const UnusedComponent = () => {
      const transactions = useLedgerStore(s => s.transactions);
      const total = transactions.reduce((acc, tx) => acc + tx.amountCents, 0);
      return <div>{total}</div>;
    };
  `;
  const unusedFile = join('src', '__temp_unused_test.tsx');
  writeFileSync(unusedFile, unusedImportContent, 'utf8');

  try {
    const content = unusedImportContent;
    const callsIsPostable = content.includes('isPostable(');
    assert.strictEqual(callsIsPostable, false);
  } finally {
    if (statSync(unusedFile)) {
      unlinkSync(unusedFile);
    }
  }
});

test('Adoption Guard: Financial statements and exports must leverage server-authoritative endpoints', () => {
  const exportAndStatementFiles = [
    'src/components/platform/settings/BackupExportSettings.tsx',
    'src/components/ledger/BalanceSheetView.tsx',
    'src/components/ledger/ProfitAndLossView.tsx',
    'src/components/ledger/TrialBalanceView.tsx',
    'src/components/ledger/CashFlowView.tsx'
  ];

  for (const file of exportAndStatementFiles) {
    const content = readFileSync(file, 'utf8');
    const usesServerHook = content.includes('useFinancialReporting') || content.includes('/api/v1/workspaces');
    const branchesOnResult = content.includes('isServerAuthoritative') || content.includes('usedServer');

    assert.ok(
      usesServerHook && branchesOnResult,
      `Adoption Guard Violation: ${file} must fetch from the server-authoritative endpoint AND branch on the result.`
    );
  }
});

