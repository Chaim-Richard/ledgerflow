import type { RecordRef } from './recordLinks';
import type { Transaction, Invoice, Bill, RecurringTransaction, ChartAccount, InventoryItem, BankStatementLine } from '../types';
interface RecordCollections { transactions: Transaction[]; invoices: Invoice[]; bills: Bill[]; recurring?: RecurringTransaction[]; accounts: ChartAccount[]; inventory?: InventoryItem[]; bankLines?: BankStatementLine[] }
export function recentRecordLabel(record: RecordRef, data: RecordCollections): string {
  switch (record.type) {
    case 'transaction': return data.transactions.find(item => item.id === record.id)?.description || `Transaction ${record.id}`;
    case 'invoice': { const invoice = data.invoices.find(item => item.id === record.id); return invoice ? `Invoice ${invoice.number || record.id} · ${invoice.customerName || ''}` : `Invoice ${record.id}`; }
    case 'bill': { const bill = data.bills.find(item => item.id === record.id); return bill ? `Bill ${bill.number || record.id} · ${bill.vendorName || ''}` : `Bill ${record.id}`; }
    case 'account': return data.accounts.find(item => item.id === record.id)?.name || `Account ${record.id}`;
    case 'item': return data.inventory?.find(item => item.id === record.id)?.name || `Item ${record.id}`;
    case 'bankLine': return data.bankLines?.find(item => item.id === record.id)?.description || `Bank line ${record.id}`;
    case 'recurring': return data.recurring?.find(item => item.id === record.id)?.description || `Recurring ${record.id}`;
  }
}
