import { PurchaseOrder, GoodsReceipt, Bill, ThreeWayMatchResult } from '../types';

export interface ThreeWayMatchSummary {
  results: ThreeWayMatchResult[];
  matchedCount: number;
  varianceCount: number;
  unreceivedCount: number;
  missingBillCount: number;
  totalVarianceCents: number;
}

/**
 * 3-Way Matching Engine:
 * Validates Purchase Order (PO) ↔ Goods Receipt (GR) ↔ Supplier Bill/Invoice (Bill)
 * Prevents overbilling, price creeping, and paying for unreceived merchandise.
 */
export function performThreeWayMatch(
  pos: PurchaseOrder[],
  receipts: GoodsReceipt[],
  bills: Bill[],
  toleranceCents = 0
): ThreeWayMatchSummary {
  const results: ThreeWayMatchResult[] = [];
  let matchedCount = 0;
  let varianceCount = 0;
  let unreceivedCount = 0;
  let missingBillCount = 0;
  let totalVarianceCents = 0;

  for (const po of pos) {
    if (po.status === 'cancelled') continue;

    // 1. Find matching goods receipt for this PO
    const matchingReceipts = receipts.filter(r => r.poId === po.id || r.poNumber === po.poNumber);
    const primaryReceipt = matchingReceipts[0];

    // Calculate received amounts and quantities
    let totalReceivedCents = 0;
    const receivedQtyMap: Record<string, number> = {};

    matchingReceipts.forEach(r => {
      r.items.forEach(item => {
        if (item.condition === 'good') {
          totalReceivedCents += Math.round(item.quantityReceived * item.unitPriceCents);
          receivedQtyMap[item.description] = (receivedQtyMap[item.description] || 0) + item.quantityReceived;
        }
      });
    });

    // 2. Find matching bill for this PO or Vendor
    const matchingBill = bills.find(b => 
      (b.metadata?.poId === po.id) ||
      (b.metadata?.poNumber === po.poNumber) ||
      (b.number && po.poNumber && b.number.includes(po.poNumber)) ||
      (b.vendorId === po.vendorId && Math.abs(b.amountCents - po.totalAmountCents) <= toleranceCents)
    );

    const discrepancies: string[] = [];
    let status: ThreeWayMatchResult['status'] = 'matched';

    const poAmount = po.totalAmountCents || 0;
    const billAmount = matchingBill ? matchingBill.amountCents : 0;

    // A. Check Goods Receipt
    if (matchingReceipts.length === 0) {
      status = 'unreceived';
      discrepancies.push('No goods receipt recorded for this Purchase Order');
      unreceivedCount++;
    } else {
      // Check quantity received vs ordered
      po.items.forEach(poItem => {
        const received = receivedQtyMap[poItem.description] || 0;
        if (received < poItem.quantity) {
          discrepancies.push(`Quantity deficit on "${poItem.description}": Ordered ${poItem.quantity}, Received ${received}`);
          if (status === 'matched') status = 'quantity_variance';
        } else if (received > poItem.quantity) {
          discrepancies.push(`Over-delivery on "${poItem.description}": Ordered ${poItem.quantity}, Received ${received}`);
          if (status === 'matched') status = 'quantity_variance';
        }
      });
    }

    // B. Check Supplier Bill
    if (!matchingBill) {
      if (status !== 'unreceived') {
        status = 'missing_bill';
        discrepancies.push('Awaiting supplier invoice/bill');
        missingBillCount++;
      }
    } else {
      // Check price variance
      const priceDiff = billAmount - poAmount;
      if (Math.abs(priceDiff) > toleranceCents) {
        status = 'price_variance';
        discrepancies.push(`Price variance: PO was $${(poAmount / 100).toFixed(2)}, Bill is $${(billAmount / 100).toFixed(2)} (Diff: $${(priceDiff / 100).toFixed(2)})`);
        varianceCount++;
        totalVarianceCents += Math.abs(priceDiff);
      }
    }

    if (discrepancies.length === 0) {
      status = 'matched';
      matchedCount++;
    }

    results.push({
      poId: po.id,
      poNumber: po.poNumber,
      billId: matchingBill?.id,
      receiptId: primaryReceipt?.id,
      status,
      poAmountCents: poAmount,
      receiptAmountCents: totalReceivedCents,
      billAmountCents: billAmount,
      discrepancies
    });
  }

  return {
    results,
    matchedCount,
    varianceCount,
    unreceivedCount,
    missingBillCount,
    totalVarianceCents
  };
}
