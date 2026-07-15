import { Transaction, Invoice, Bill } from '../../types';

export class ReferentialIntegrityEngine {
  static canDeleteAccount(accountId: string, transactions: Transaction[]): boolean {
    return !transactions.some(tx => tx.lines?.some(l => l.accountId === accountId));
  }

  static canDeleteVendor(vendorId: string, bills: Bill[], transactions: Transaction[]): boolean {
    const hasBills = bills.some(b => b.vendorId === vendorId);
    // Assuming transactions might have payeeId stored in metadata or explicitly
    const hasTxs = transactions.some(tx => tx.metadata?.vendorId === vendorId);
    return !hasBills && !hasTxs;
  }

  static canDeleteCustomer(customerId: string, invoices: Invoice[], transactions: Transaction[]): boolean {
    const hasInvoices = invoices.some(i => i.customerId === customerId);
    const hasTxs = transactions.some(tx => tx.metadata?.customerId === customerId);
    return !hasInvoices && !hasTxs;
  }

  static canDeleteProject(projectId: string, transactions: Transaction[]): boolean {
    return !transactions.some(tx => 
      tx.projectId === projectId || tx.lines?.some(l => l.project === projectId)
    );
  }
}
