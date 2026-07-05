import { Invoice } from '../types';

export class InvoiceService {
  static validate(invoice: Invoice): boolean {
    if (invoice.amountCents < 0) {
      throw new Error('Invoice amount cannot be negative');
    }
    if (!invoice.customerId) {
      throw new Error('Invoice must have a customer ID');
    }
    return true;
  }
}
