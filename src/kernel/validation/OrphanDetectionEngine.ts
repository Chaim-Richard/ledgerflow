import { Transaction, Invoice, Bill, Project, ChartAccount } from '../../types';

export class OrphanDetectionEngine {
  static scanTransactions(transactions: Transaction[]): Transaction[] {
    // Find transactions with lines missing accountIds or categories
    return transactions.filter(tx => 
      tx.lines?.some(l => !l.accountId || !l.category)
    );
  }

  static scanAccounts(accounts: ChartAccount[], transactions: Transaction[]): ChartAccount[] {
    // Find accounts that have never been used in any transaction
    const usedAccountIds = new Set<string>();
    transactions.forEach(tx => {
      tx.lines?.forEach(line => {
        if (line.accountId) usedAccountIds.add(line.accountId);
      });
    });
    
    return accounts.filter(acc => !usedAccountIds.has(acc.id));
  }

  static scanPayments(payments: Transaction[], invoices: Invoice[]): Transaction[] {
    // Find payments that are not linked to any invoice
    // Assuming payment has some metadata link or we can find matching amount/date
    // This is a naive check. A real system would use a specific 'linkedInvoiceId'
    return payments.filter(p => !p.metadata?.linkedInvoiceId);
  }

  static scanProjects(projects: Project[]): Project[] {
    // Find projects without an owner/manager in metadata
    return projects.filter(p => !p.metadata?.managerId);
  }
}
