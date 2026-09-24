import type { Invoice, Bill, Payment, CreditNote, VendorCredit, Customer, Vendor } from "../../types";
import { INVOICE_IS_ISSUED, BILL_IS_ISSUED } from "./computeReports";
import { getLocalDateISO } from "../../lib/utils";

export function toBaseCents(amountCents: number = 0, exchangeRate?: number): number {
  const rate = typeof exchangeRate === 'number' && exchangeRate > 0 ? exchangeRate : 1;
  return Math.round(amountCents * rate);
}

export interface CustomerBalanceSummaryRow {
  customerId: string;
  name: string;
  email?: string;
  phone?: string;
  openInvoicesCount: number;
  totalInvoicedCents: number;
  totalCreditNotesCents: number;
  totalPaidCents: number;
  balanceCents: number;
}

export function computeCustomerBalanceSummary(
  customers: Customer[] = [],
  invoices: Invoice[] = [],
  payments: Payment[] = [],
  creditNotes: CreditNote[] = [],
  asOfDateOrStartDate?: string,
  endDate?: string
): CustomerBalanceSummaryRow[] {
  const end = endDate || asOfDateOrStartDate || getLocalDateISO();

  return customers.map(cust => {
    const custId = cust.id;
    const custInvoices = invoices.filter(inv => {
      if (inv.customerId !== custId) return false;
      if (!INVOICE_IS_ISSUED.has(inv.status)) return false;
      const docDate = inv.date || '';
      if (docDate && docDate > end) return false;
      return true;
    });

    const totalInvoicedCents = custInvoices.reduce((sum, inv) => {
      return sum + toBaseCents(inv.amountCents || 0, inv.exchangeRate);
    }, 0);

    const custCreditNotes = creditNotes.filter(cn => {
      if (cn.customerId !== custId) return false;
      if (cn.status === 'void' || cn.status === 'draft') return false;
      const docDate = cn.date || '';
      if (docDate && docDate > end) return false;
      return true;
    });

    const totalCreditNotesCents = custCreditNotes.reduce((sum, cn) => {
      return sum + toBaseCents(cn.amountCents || 0, cn.exchangeRate);
    }, 0);

    const custPayments = payments.filter(p => {
      const matchesContact = p.contactId === custId || p.allocations?.some((a: { documentId: string }) => custInvoices.some(inv => inv.id === a.documentId));
      if (!matchesContact) return false;
      if (p.direction === 'made') return false;
      if (p.status === 'void' || p.status === 'draft') return false;
      const docDate = p.date || '';
      if (docDate && docDate > end) return false;
      return true;
    });

    const totalPaidCents = custPayments.reduce((sum, p) => {
      return sum + toBaseCents(p.amountCents || 0, p.exchangeRate);
    }, 0);

    const openInvoicesCount = custInvoices.filter(inv => inv.status !== 'paid').length;
    // Allow negative balance (credit balances for customers)
    const balanceCents = totalInvoicedCents - totalCreditNotesCents - totalPaidCents;

    return {
      customerId: custId,
      name: cust.name || 'Unnamed Customer',
      email: cust.email,
      phone: cust.phone,
      openInvoicesCount,
      totalInvoicedCents,
      totalCreditNotesCents,
      totalPaidCents,
      balanceCents
    };
  }).sort((a, b) => b.balanceCents - a.balanceCents);
}

export interface VendorBalanceSummaryRow {
  vendorId: string;
  name: string;
  email?: string;
  phone?: string;
  openBillsCount: number;
  totalBilledCents: number;
  totalVendorCreditsCents: number;
  totalPaidCents: number;
  balanceCents: number;
}

export function computeVendorBalanceSummary(
  vendors: Vendor[] = [],
  bills: Bill[] = [],
  payments: Payment[] = [],
  vendorCredits: VendorCredit[] = [],
  asOfDateOrStartDate?: string,
  endDate?: string
): VendorBalanceSummaryRow[] {
  const end = endDate || asOfDateOrStartDate || getLocalDateISO();

  return vendors.map(vendor => {
    const vendorId = vendor.id;
    const vendorBills = bills.filter(b => {
      if (b.vendorId !== vendorId) return false;
      if (!BILL_IS_ISSUED.has(b.status)) return false;
      const docDate = b.date || '';
      if (docDate && docDate > end) return false;
      return true;
    });

    const totalBilledCents = vendorBills.reduce((sum, b) => {
      return sum + toBaseCents(b.amountCents || 0, b.exchangeRate);
    }, 0);

    const custVendorCredits = vendorCredits.filter(vc => {
      if (vc.vendorId !== vendorId) return false;
      if (vc.status === 'void' || vc.status === 'draft') return false;
      const docDate = vc.date || '';
      if (docDate && docDate > end) return false;
      return true;
    });

    const totalVendorCreditsCents = custVendorCredits.reduce((sum, vc) => {
      return sum + toBaseCents(vc.amountCents || 0, vc.exchangeRate);
    }, 0);

    const vendorPayments = payments.filter(p => {
      if (p.contactId !== vendorId) return false;
      if (p.direction === 'received') return false;
      if (p.status === 'void' || p.status === 'draft') return false;
      const docDate = p.date || '';
      if (docDate && docDate > end) return false;
      return true;
    });

    const totalPaidCents = vendorPayments.reduce((sum, p) => {
      return sum + toBaseCents(p.amountCents || 0, p.exchangeRate);
    }, 0);

    const openBillsCount = vendorBills.filter(b => b.status !== 'paid').length;
    const balanceCents = totalBilledCents - totalVendorCreditsCents - totalPaidCents;

    return {
      vendorId,
      name: vendor.name || 'Unnamed Vendor',
      email: vendor.email,
      phone: vendor.phone,
      openBillsCount,
      totalBilledCents,
      totalVendorCreditsCents,
      totalPaidCents,
      balanceCents
    };
  }).sort((a, b) => b.balanceCents - a.balanceCents);
}

export interface PartyTransactionRow {
  id: string;
  date: string;
  partyName: string;
  type: string;
  reference: string;
  status: string;
  amountCents: number;
}

export function computeTransactionsByCustomer(
  customers: Customer[] = [],
  invoices: Invoice[] = [],
  payments: Payment[] = [],
  creditNotes: CreditNote[] = [],
  startDate?: string,
  endDate?: string
): PartyTransactionRow[] {
  const start = startDate || "1970-01-01";
  const end = endDate || "2099-12-31";
  const customerMap = new Map(customers.map(c => [c.id, c.name]));
  const list: PartyTransactionRow[] = [];

  // 1. Invoices (issued only, non-draft, non-void)
  for (const inv of invoices) {
    if (!INVOICE_IS_ISSUED.has(inv.status)) continue;
    const docDate = inv.date || '';
    if (docDate && (docDate < start || docDate > end)) continue;
    const customerName = inv.customerName || customerMap.get(inv.customerId) || 'Unknown Customer';
    list.push({
      id: inv.id,
      date: docDate,
      partyName: customerName,
      type: 'Invoice',
      reference: inv.number || inv.id,
      status: inv.status || 'pending',
      amountCents: toBaseCents(inv.amountCents || 0, inv.exchangeRate)
    });
  }

  // 2. Credit Notes
  for (const cn of creditNotes) {
    if (cn.status === 'void' || cn.status === 'draft') continue;
    const docDate = cn.date || '';
    if (docDate && (docDate < start || docDate > end)) continue;
    const customerName = cn.customerName || customerMap.get(cn.customerId) || 'Unknown Customer';
    list.push({
      id: cn.id,
      date: docDate,
      partyName: customerName,
      type: 'Credit Note',
      reference: cn.number || cn.id,
      status: cn.status || 'applied',
      amountCents: -toBaseCents(cn.amountCents || 0, cn.exchangeRate)
    });
  }

  // 3. Payments (received)
  for (const pay of payments) {
    if (pay.status === 'void' || pay.status === 'draft' || pay.direction === 'made') continue;
    const docDate = pay.date || '';
    if (docDate && (docDate < start || docDate > end)) continue;
    const customerName = pay.contactName || customerMap.get(pay.contactId) || 'Customer Payment';
    list.push({
      id: pay.id,
      date: docDate,
      partyName: customerName,
      type: 'Payment',
      reference: pay.reference || pay.number || pay.id,
      status: pay.status || 'posted',
      amountCents: -toBaseCents(pay.amountCents || 0, pay.exchangeRate)
    });
  }

  return list.sort((a, b) => b.date.localeCompare(a.date));
}

export function computeTransactionsByVendor(
  vendors: Vendor[] = [],
  bills: Bill[] = [],
  payments: Payment[] = [],
  vendorCredits: VendorCredit[] = [],
  startDate?: string,
  endDate?: string
): PartyTransactionRow[] {
  const start = startDate || "1970-01-01";
  const end = endDate || "2099-12-31";
  const vendorMap = new Map(vendors.map(v => [v.id, v.name]));
  const list: PartyTransactionRow[] = [];

  // 1. Bills (issued only, non-draft, non-void)
  for (const bill of bills) {
    if (!BILL_IS_ISSUED.has(bill.status)) continue;
    const docDate = bill.date || '';
    if (docDate && (docDate < start || docDate > end)) continue;
    const vendorName = bill.vendorName || vendorMap.get(bill.vendorId) || 'Unknown Vendor';
    list.push({
      id: bill.id,
      date: docDate,
      partyName: vendorName,
      type: 'Bill',
      reference: bill.number || bill.id,
      status: bill.status || 'pending',
      amountCents: toBaseCents(bill.amountCents || 0, bill.exchangeRate)
    });
  }

  // 2. Vendor Credits
  for (const vc of vendorCredits) {
    if (vc.status === 'void' || vc.status === 'draft') continue;
    const docDate = vc.date || '';
    if (docDate && (docDate < start || docDate > end)) continue;
    const vendorName = vc.vendorName || vendorMap.get(vc.vendorId) || 'Unknown Vendor';
    list.push({
      id: vc.id,
      date: docDate,
      partyName: vendorName,
      type: 'Vendor Credit',
      reference: vc.number || vc.id,
      status: vc.status || 'applied',
      amountCents: -toBaseCents(vc.amountCents || 0, vc.exchangeRate)
    });
  }

  // 3. Payments made
  for (const pay of payments) {
    if (pay.status === 'void' || pay.status === 'draft' || pay.direction === 'received') continue;
    const docDate = pay.date || '';
    if (docDate && (docDate < start || docDate > end)) continue;
    const vendorName = pay.contactName || vendorMap.get(pay.contactId) || 'Supplier Payment';
    list.push({
      id: pay.id,
      date: docDate,
      partyName: vendorName,
      type: 'Vendor Payment',
      reference: pay.reference || pay.number || pay.id,
      status: pay.status || 'posted',
      amountCents: -toBaseCents(pay.amountCents || 0, pay.exchangeRate)
    });
  }

  return list.sort((a, b) => b.date.localeCompare(a.date));
}
