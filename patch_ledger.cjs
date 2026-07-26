const fs = require('fs');
let code = fs.readFileSync('src/components/ledger/Ledger.tsx', 'utf8');

const newTabs = `type SubTab = 'coa' | 'journal' | 'trial';
type ModalType = 'account' | 'journal' | 'recon' | 'period' | 'bank_import' | null;

interface LedgerSubTabConfig {
  id: SubTab;
  label: string;
  icon: any;
  cardKey: string;
}

const LEDGER_SUB_TABS: LedgerSubTabConfig[] = [
  { id: 'coa', label: 'Chart of Accounts', icon: BookOpen, cardKey: 'ledger.tab.coa' },
  { id: 'journal', label: 'General Journal', icon: ArrowRightLeft, cardKey: 'ledger.tab.journal' },
  { id: 'trial', label: 'Trial Balance', icon: Scale, cardKey: 'ledger.tab.trial' }
];`;

code = code.replace(/type SubTab = [\s\S]*?];/, newTabs);
fs.writeFileSync('src/components/ledger/Ledger.tsx', code);
