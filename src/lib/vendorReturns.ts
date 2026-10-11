/**
 * Purchase returns (BF-07): stock bought on a bill and sent back to the vendor, recorded on a vendor
 * credit for that bill. Each line of the bill that brought an item in can send back up to the units
 * it brought, less what earlier credits (not void) sent back, valued at the line's own cost per unit
 * (whole cents, the exact remainder when the line goes back whole). The credit's posting takes that
 * value off Inventory instead of the expense, and the server takes the units out of stock
 * (src/server/services/cogsStockService.ts).
 */
import type { Bill, VendorCredit, VendorReturnLine } from '../types';

export interface ReturnableBillLine {
  billLine: number;
  itemId: string;
  description: string;
  /** units the line brought in */
  quantity: number;
  /** what the line cost, in the bill's currency */
  amountCents: number;
  /** units already sent back on other credits */
  returned: number;
  /** what earlier credits already took off the line's value */
  returnedCents: number;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** The bill's stock lines, with what earlier credits (other than `exceptCreditId`, and not void) sent back. */
export function returnableBillLines(bill: Pick<Bill, 'id' | 'splits'>, credits: Array<Pick<VendorCredit, 'id' | 'billId' | 'status' | 'returnedGoods'>>, exceptCreditId?: string): ReturnableBillLine[] {
  const earlier = credits.filter(c => c.billId === bill.id && c.status !== 'void' && c.id !== exceptCreditId).flatMap(c => c.returnedGoods || []);
  return (bill.splits || []).flatMap((s, billLine) => {
    if (!s.itemId || s.landedCost || !(Number(s.quantity) > 0)) return [];
    const mine = earlier.filter(r => r.billLine === billLine);
    return [{
      billLine, itemId: s.itemId, description: s.description || '', quantity: Number(s.quantity), amountCents: Math.round(Number(s.amountCents) || 0),
      returned: round6(mine.reduce((sum, r) => sum + r.quantity, 0)), returnedCents: mine.reduce((sum, r) => sum + r.valueCents, 0),
    }];
  });
}

/** The value of sending back `quantity` units of a line: at its cost per unit, or what is left of it when the rest goes back. */
export function returnValue(line: ReturnableBillLine, quantity: number): number {
  if (round6(line.returned + quantity) >= line.quantity) return line.amountCents - line.returnedCents;
  return Math.round(line.amountCents * quantity / line.quantity);
}

/** The return lines for the units typed per bill line (nothing for zero). */
export function vendorReturnLines(lines: ReturnableBillLine[], units: Record<number, number>): VendorReturnLine[] {
  return lines.flatMap(l => {
    const q = Number(units[l.billLine]) || 0;
    return q > 0 ? [{ billLine: l.billLine, itemId: l.itemId, quantity: round6(q), valueCents: returnValue(l, q) }] : [];
  });
}

/** Why these units can't go back, or null. */
export function vendorReturnProblem(lines: ReturnableBillLine[], returns: VendorReturnLine[], creditCents: number, taxCents = 0): string | null {
  for (const r of returns) {
    const line = lines.find(l => l.billLine === r.billLine);
    if (!line || line.itemId !== r.itemId) return 'Only the bill\'s stock lines can be sent back';
    if (!(r.quantity > 0) || round6(r.quantity) !== r.quantity) return `${line.description || 'A line'}: enter the units sent back`;
    if (round6(line.returned + r.quantity) > line.quantity) return `${line.description || 'A line'}: only ${round6(line.quantity - line.returned)} of ${line.quantity} can still go back`;
  }
  const goods = returns.reduce((s, r) => s + r.valueCents, 0);
  if (goods > creditCents - taxCents) return 'The goods sent back are worth more than the credit (before tax): raise the credit, or send back fewer';
  return null;
}
