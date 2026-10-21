import type { ChartAccount, InventoryItem, Invoice, TransactionLine } from '../types';

/** metadata.type of the cost-of-goods-sold entry posted for one invoice line. */
export const INVOICE_COGS_TYPE = 'invoice-cogs-auto';

export const COGS_ACCOUNTS_MISSING =
  'Add an Inventory account and a Cost of Goods Sold account to record the cost of items sold.';

export interface CogsEntry {
  uid: string;
  workspaceId: string;
  date: string;
  description: string;
  totalAmountCents: number;
  currency: string;
  exchangeRate: number;
  status: 'completed';
  type: 'actual';
  createdAt: string;
  metadata: {
    invoiceId: string;
    type: typeof INVOICE_COGS_TYPE;
    cogsForInvoiceId: string;
    cogsForLineId: string;
    inventoryItemId: string;
    quantity: number;
    /** W-01: the invoice line's Location label, where the units left from */
    locationId?: string;
    /** DIM-2 phase 3: the customer the units went to */
    customerId?: string;
  };
  lines: TransactionLine[];
}

export interface InvoiceCogsPlan {
  entries: CogsEntry[];
  /** Set when some item lines have a cost but it could not be posted; the invoice is flagged. */
  pendingReason?: string;
}

export interface InvoiceCogsInput {
  invoiceId: string;
  invoice: Partial<Invoice>;
  date: string;
  uid: string;
  workspaceId: string;
  /** The workspace (base) currency: inventory is valued in it. */
  baseCurrency: string;
  inventoryAccount?: Pick<ChartAccount, 'id' | 'name'>;
  cogsAccount?: Pick<ChartAccount, 'id' | 'name'>;
  items: Pick<InventoryItem, 'id' | 'name' | 'unitCostCents'>[];
}

/**
 * The cost-of-goods-sold entries for an invoice: one per line that sells an inventory item
 * with a known unit cost (DR Cost of Goods Sold, CR Inventory, quantity × unit cost in the base
 * currency; the invoice's exchange rate does not apply to inventory cost). The server lowers the
 * item's stock when it records the entry and raises it back when the entry is reversed.
 * Missing accounts never block the invoice: nothing is posted and `pendingReason` says why.
 */
export function planInvoiceCogs(input: InvoiceCogsInput): InvoiceCogsPlan {
  const { invoiceId, invoice, date, uid, workspaceId, baseCurrency, inventoryAccount, cogsAccount } = input;
  const itemById = new Map(input.items.map(i => [i.id, i]));
  const costed = (invoice.items || []).flatMap(line => {
    if (!line.itemId || !line.id) return [];
    const quantity = Number(line.quantity);
    const unitCost = line.unitCostCents ?? itemById.get(line.itemId)?.unitCostCents ?? 0;
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost <= 0) return [];
    return [{ line, itemId: line.itemId, lineId: line.id, quantity, costCents: Math.round(quantity * unitCost) }];
  }).filter(c => c.costCents > 0);

  if (costed.length === 0) return { entries: [] };
  if (!inventoryAccount || !cogsAccount) return { entries: [], pendingReason: COGS_ACCOUNTS_MISSING };

  const now = new Date().toISOString();
  const entries = costed.map(({ line, itemId, lineId, quantity, costCents }): CogsEntry => {
    const name = itemById.get(itemId)?.name || line.description || 'item';
    return {
      uid,
      workspaceId,
      date,
      description: `Cost of goods sold: ${name} × ${quantity} (Invoice ${invoice.number || invoiceId})`,
      totalAmountCents: costCents,
      currency: baseCurrency,
      exchangeRate: 1,
      status: 'completed',
      type: 'actual',
      createdAt: now,
      metadata: { invoiceId, type: INVOICE_COGS_TYPE, cogsForInvoiceId: invoiceId, cogsForLineId: lineId, inventoryItemId: itemId, quantity, ...(line.dimensions?.location ? { locationId: line.dimensions.location } : {}), ...(invoice.customerId ? { customerId: invoice.customerId } : {}) },
      lines: [
        // the invoice line's labels (BF-09) go with its cost, so margin by project or location adds up
        { accountId: cogsAccount.id, accountName: cogsAccount.name, amountCents: costCents, debitCents: costCents, creditCents: 0, description: `Cost of ${name}`, ...(line.dimensions ? { dimensions: line.dimensions } : {}) },
        { accountId: inventoryAccount.id, accountName: inventoryAccount.name, amountCents: -costCents, debitCents: 0, creditCents: costCents, description: `Inventory out: ${name}` },
      ],
    };
  });
  return { entries };
}
