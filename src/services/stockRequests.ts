import { getIdToken } from '../firebase';

export interface StockMove {
  itemId: string;
  name: string;
  before: number;
  after: number;
  valueCents: number;
  unitCostCents: number;
}

export interface StockResult {
  status: 'ok';
  /** The ledger entry, or null when nothing had a value (a count of items with no cost). */
  transactionId: string | null;
  valueCents: number;
  items: StockMove[];
  newQuantity?: number;
}

interface StockAccounts {
  workspaceId: string;
  inventoryAccountId: string;
  offsetAccountId: string;
  reason?: string;
  date?: string;
}

export interface AdjustStockBody extends StockAccounts {
  itemId: string;
  /** Positive adds stock, negative removes it. */
  quantityChange: number;
  type: 'purchase' | 'opening' | 'adjustment';
  /** A purchase's cost per unit; the item's average cost is recalculated. */
  unitCostCents?: number;
}

export interface CountStockBody extends StockAccounts {
  counts: Array<{ itemId: string; counted: number }>;
}

async function postStock(path: string, body: object): Promise<StockResult> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getIdToken()}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'The stock change was not saved');
  return data as StockResult;
}

/** Adds or removes stock of one item; the server posts the entry and changes the quantity together. */
export const adjustStockRequest = (body: AdjustStockBody) => postStock('/api/v1/inventory/adjust', body);

/** Records counted quantities; differences go to the offset (variance) account in one entry. */
export const countStockRequest = (body: CountStockBody) => postStock('/api/v1/inventory/count', body);
