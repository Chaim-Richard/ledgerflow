import os

with open('src/components/ledger/InboxView.tsx', 'r') as f:
    code = f.read()

target1 = """  onCategorize: (transactionIds: string[], category: string, account: string) => void;
  formatCurrency: (val: number) => string;
  onParseReceipt: (file: File, transactionId?: string) => void;
}

export default function InboxView({ transactions = [], accounts, onCategorize, formatCurrency }: InboxViewProps) {"""

replacement1 = """  onUpdate?: (id: string, updates: any) => Promise<void>;
  onCategorize?: (transactionIds: string[], category: string, account: string) => void;
  formatCurrency: (val: number) => string;
  onParseReceipt?: (file: File, transactionId?: string) => void;
}

export default function InboxView({ transactions = [], accounts, onCategorize, onUpdate, formatCurrency }: InboxViewProps) {"""

target2 = """  const handleAutoFile = () => {
    onCategorize(highConfidence.map(t => t.id), 'Auto-filed', 'expense');
  };

  const handleBatchConfirm = () => {
    onCategorize(mediumConfidence.map(t => t.id), 'Batch Confirmed', 'expense');
  };

  const handleResolveLow = (id: string, category: string) => {
    onCategorize([id], category, 'expense');
  };"""

replacement2 = """  const _handleCategorize = async (transactionIds: string[], category: string, account: string) => {
    if (onCategorize) {
      onCategorize(transactionIds, category, account);
    } else if (onUpdate) {
      for (const id of transactionIds) {
        await onUpdate(id, { status: 'completed' }); // mock categorization by completing it
      }
    }
  };

  const handleAutoFile = () => {
    _handleCategorize(highConfidence.map(t => t.id), 'Auto-filed', 'expense');
  };

  const handleBatchConfirm = () => {
    _handleCategorize(mediumConfidence.map(t => t.id), 'Batch Confirmed', 'expense');
  };

  const handleResolveLow = (id: string, category: string) => {
    _handleCategorize([id], category, 'expense');
  };"""

code = code.replace(target1, replacement1)
code = code.replace(target2, replacement2)

with open('src/components/ledger/InboxView.tsx', 'w') as f:
    f.write(code)
