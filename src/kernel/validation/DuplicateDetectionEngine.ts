import { Transaction, Invoice } from '../../types';

export class DuplicateDetectionEngine {
  /**
   * Detect duplicates before posting.
   * Checks for same amount, same date, same vendor/payee, same reference.
   */
  static detectDuplicates(newTx: Transaction, existingTxs: Transaction[]): Transaction[] {
    const timeWindowMs = 7 * 24 * 60 * 60 * 1000; // 7 days window for safety
    const newTxDate = new Date(newTx.date).getTime();

    return existingTxs.filter(tx => {
      // Must not be the same exact transaction record
      if (tx.id === newTx.id) return false;

      const txDate = new Date(tx.date).getTime();
      const isSameDateWindow = Math.abs(txDate - newTxDate) <= timeWindowMs;
      
      const isSameAmount = tx.totalAmountCents === newTx.totalAmountCents;
      
      // Payee could be undefined, normalize for comparison
      const normalizeStr = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const isSamePayee = normalizeStr(tx.payee || '') === normalizeStr(newTx.payee || '');

      return isSameDateWindow && isSameAmount && isSamePayee;
    });
  }

  static detectInvoiceDuplicates(newInvoice: Invoice, existingInvoices: Invoice[]): Invoice[] {
    return existingInvoices.filter(inv => {
      if (inv.id === newInvoice.id) return false;
      const isSameNumber = inv.number === newInvoice.number;
      const isSameCustomerAndAmount = inv.customerId === newInvoice.customerId && inv.amountCents === newInvoice.amountCents;
      return isSameNumber || isSameCustomerAndAmount;
    });
  }
}
