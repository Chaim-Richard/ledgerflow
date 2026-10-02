import { verifyLockDate } from './ledgerPost/postingKit';
import { postInvoiceLedger } from './ledgerPost/invoicePosting';
import { postBillLedger } from './ledgerPost/billPosting';
import { postCreditNoteLedger, postVendorCreditLedger } from './ledgerPost/creditPosting';
import { postPaymentLedger } from './ledgerPost/paymentPosting';
import { deletePostings } from './ledgerPost/deletePostings';

export type { EntityMutation, LedgerPostContext, PostableTransaction } from './ledgerPost/postingKit';

/**
 * The one posting path for documents: builds the double-entry lines for invoices, bills, credit
 * notes, vendor credits and payments and sends them to /api/v1/transactions/bulk (F-11: the code
 * lives in ./ledgerPost/, one file per document type; the names here are unchanged).
 */
export class LedgerPostService {
  /** Period Lock Guard */
  static verifyLockDate = verifyLockDate;
  static postInvoiceLedger = postInvoiceLedger;
  static postBillLedger = postBillLedger;
  static postCreditNoteLedger = postCreditNoteLedger;
  static postVendorCreditLedger = postVendorCreditLedger;
  static postPaymentLedger = postPaymentLedger;
  static deletePostings = deletePostings;
}
