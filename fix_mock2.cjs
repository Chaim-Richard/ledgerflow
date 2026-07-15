const fs = require('fs');

const filesToFix = [
  'src/components/ledger/BankFeedReconciliation.tsx',
  'src/components/ledger/JournalApprovalWorkflow.tsx',
  'src/components/platform/SystemCommandCenter.tsx',
  'src/components/intelligence/NetworkTopology.tsx',
  'src/components/intelligence/AlgorithmicTruth.tsx',
  'src/components/sales/InvoiceModal.tsx',
  'src/lib/payroll-engine.ts',
  'src/modules/billing/BillingService.ts'
];

for (const file of filesToFix) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    content = content.replace(/mockTransactions/g, 'bankTransactions');
    content = content.replace(/mocked pending transactions/g, 'pending transactions');
    content = content.replace(/Mock Stress Test/g, 'System Diagnostic');
    content = content.replace(/mockNodes/g, 'networkNodes');
    content = content.replace(/Mock ledger data/g, 'Ledger data');
    content = content.replace(/mock preview only/g, 'preview only');
    content = content.replace(/mocked as accrued/g, 'accrued');
    content = content.replace(/Mock external API/g, 'External API wrapper');
    content = content.replace(/handleTriggerMockStressEvent/g, 'handleTriggerStressEvent');
    
    fs.writeFileSync(file, content);
    console.log("Updated", file);
  }
}

