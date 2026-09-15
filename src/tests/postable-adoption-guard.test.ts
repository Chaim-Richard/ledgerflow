import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, readFileSync } from 'node:fs';
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

test('Adoption Guard: Files importing useLedgerStore and summing amounts must import isPostable and lineAmount', () => {
  const srcFiles = walkDir('src');

  for (const file of srcFiles) {
    // Skip test files, store definitions, types, server files, and single-record draft editors
    if (
      file.includes('src/tests') || 
      file.includes('src/server') || 
      file.endsWith('useLedgerStore.ts') || 
      file.endsWith('types.ts') || 
      file.endsWith('txFilters.ts') ||
      file.endsWith('SplitEditor.tsx') ||
      file.endsWith('TransactionEditModal.tsx') ||
      file.endsWith('BillModal.tsx') ||
      file.endsWith('QBOMigrationWizard.tsx') ||
      file.endsWith('useEntityOperations.ts') ||
      file.endsWith('BackupExportSettings.tsx')
    ) {
      continue;
    }

    const content = readFileSync(file, 'utf8');

    const usesLedgerStore = content.includes('useLedgerStore');
    const consumesTransactions = content.includes('transactions') || content.includes('.transactions');
    const sumsAmounts = 
      (content.includes('amountCents') || content.includes('totalAmountCents')) &&
      (content.includes('.reduce(') || /([a-zA-Z0-9_]*(?:Cents|Amount|Total|Sum|Net|Balance))\s*\+=/i.test(content));

    if (usesLedgerStore && consumesTransactions && sumsAmounts) {
      const importsIsPostable = content.includes('isPostable');
      assert.ok(
        importsIsPostable,
        `Adoption Guard Violation: ${file} consumes transactions and sums amountCents but fails to import and apply isPostable(). Every financial calculation must exclude voids, drafts, and soft-deleted records.`
      );

      const sumsLines = (content.includes('.lines') || content.includes('lines.')) && (content.includes('amountCents') || content.includes('lineAmount'));
      if (sumsLines) {
        const importsLineAmount = content.includes('lineAmount') || content.includes('calculateTransactionImpact');
        assert.ok(
          importsLineAmount,
          `Adoption Guard Violation: ${file} consumes transaction lines and sums amountCents but fails to import lineAmount(). Line amounts must be normalized via lineAmount() to preserve direction and balance integrity.`
        );
      }
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
    const hasServerConnection = 
      content.includes('/api/v1/workspaces') || 
      content.includes('useFinancialReporting') || 
      content.includes('/export') ||
      content.includes('fetch');

    assert.ok(
      hasServerConnection,
      `Adoption Guard Violation: Statement/Export component ${file} must reference server-authoritative streaming API or hook to avoid 2,000-row client-side truncation.`
    );
  }
});
