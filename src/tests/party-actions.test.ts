import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Party Actions Guard: Check for essential modals and features in Purchases, Sales, and Aging reports', () => {
  const purchasesPath = path.resolve(process.cwd(), 'src/components/purchases/Purchases.tsx');
  const salesPath = path.resolve(process.cwd(), 'src/components/sales/Sales.tsx');
  const agingPath = path.resolve(process.cwd(), 'src/components/reporting/PartyAgingReportView.tsx');

  assert.ok(fs.existsSync(purchasesPath), 'Purchases.tsx must exist');
  assert.ok(fs.existsSync(salesPath), 'Sales.tsx must exist');
  assert.ok(fs.existsSync(agingPath), 'PartyAgingReportView.tsx must exist');

  const purchasesContent = fs.readFileSync(purchasesPath, 'utf8');
  const salesContent = fs.readFileSync(salesPath, 'utf8');
  const agingContent = fs.readFileSync(agingPath, 'utf8');

  // Check Purchases.tsx
  assert.ok(purchasesContent.includes('ReceivePaymentModal'), 'Purchases.tsx must use ReceivePaymentModal');
  assert.ok(purchasesContent.includes('void') && (purchasesContent.includes('status') || purchasesContent.includes('updateEntity')), 'Purchases.tsx must support void action');
  assert.ok(purchasesContent.includes('exportBillsToCSV') || purchasesContent.includes('csv') || purchasesContent.includes('CSV'), 'Purchases.tsx must support CSV export');

  // Check Sales.tsx
  assert.ok(salesContent.includes('WriteOffModal'), 'Sales.tsx must use WriteOffModal');
  assert.ok(salesContent.includes('PdfPreviewModal'), 'Sales.tsx must use PdfPreviewModal');

  // Check PartyAgingReportView.tsx
  assert.ok(agingContent.includes('exportToCSV') || agingContent.includes('csv') || agingContent.includes('CSV'), 'PartyAgingReportView.tsx must support exportToCSV');
  assert.ok(agingContent.includes('sortBy') || agingContent.includes('sortOrder') || agingContent.includes('handleSort'), 'PartyAgingReportView.tsx must support sorting');
});
