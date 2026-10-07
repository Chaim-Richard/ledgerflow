import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../../hooks/useDialog';
import type { ChartAccount, InventoryItem } from '../../types';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import { TruthEngine } from '../../modules/integrity/TruthEngine';
import {
  STOCK_CHANGE_LABELS, defaultOffsetAccount, inventoryAccountsOf, offsetAccountChoices, stockChangeValueCents,
} from '../../lib/inventoryAccounts';
import { adjustStockRequest } from '../../services/stockRequests';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { StockAccountFields } from './StockAccountFields';
import { stockFieldClass, stockLabelClass } from './stockStyles';

type AdjustKind = keyof typeof STOCK_CHANGE_LABELS;

interface StockAdjustDialogProps {
  item: InventoryItem;
  workspaceId: string;
  accounts: ChartAccount[];
  /** The workspace currency: stock is valued in it. */
  currency?: string;
  initialKind?: AdjustKind;
  initialQuantity?: number;
  onClose: () => void;
}

const OFFSET_LABEL: Record<AdjustKind, string> = {
  adjustment: 'Loss or gain account',
  purchase: 'Paid from (or Accounts Payable)',
  opening: 'Opening balance account',
};

/**
 * Adds or removes stock of one item with the books (K-13 BA-04): a correction (damaged, lost,
 * found), stock received, or opening stock. The server posts the entry at the item's cost and
 * changes the quantity in one database transaction (stockAdjustmentService.ts).
 */
export default function StockAdjustDialog({ item, workspaceId, accounts, currency, initialKind = 'adjustment', initialQuantity, onClose }: StockAdjustDialogProps) {
  const inventoryChoices = useMemo(() => inventoryAccountsOf(accounts), [accounts]);
  const offsetChoices = useMemo(() => offsetAccountChoices(accounts), [accounts]);
  const [kind, setKind] = useState<AdjustKind>(initialKind);
  const [direction, setDirection] = useState<'add' | 'remove'>('remove');
  const [quantity, setQuantity] = useState(initialQuantity ? String(initialQuantity) : '');
  const [unitCost, setUnitCost] = useState(item.unitCostCents ? (item.unitCostCents / 100).toFixed(2) : '');
  const [inventoryAccountId, setInventoryAccountId] = useState(inventoryChoices[0]?.id || '');
  const [offsetAccountId, setOffsetAccountId] = useState(defaultOffsetAccount(accounts, initialKind)?.id || '');
  const [date, setDate] = useState(getLocalDateISO());
  const [note, setNote] = useState('');
  // W-01: where the units are added or taken from (optional)
  const [locationId, setLocationId] = useState('');
  const dimensionNodes = useLedgerStore(s => s.dimensionNodes);
  const locations = (dimensionNodes || []).filter(n => n.dimensionId === 'location' && n.status !== 'archived');
  const [saving, setSaving] = useState(false);
  const { dialogProps, titleId } = useDialog(onClose, true);

  const changeKind = (next: AdjustKind) => {
    setKind(next);
    setOffsetAccountId(defaultOffsetAccount(accounts, next)?.id || '');
    if (next !== 'adjustment') setDirection('add');
  };

  const amount = Number(quantity);
  const sign = kind === 'adjustment' && direction === 'remove' ? -1 : 1;
  const quantityChange = Number.isFinite(amount) && amount > 0 ? sign * amount : 0;
  const costCents = kind === 'purchase' ? TruthEngine.parseAmountToCents(unitCost || '0') : item.unitCostCents || 0;
  const valueCents = stockChangeValueCents(quantityChange, costCents);
  const after = (item.quantityAtHand || 0) + quantityChange;
  const problem = !inventoryAccountId ? 'Add an Inventory account to the chart of accounts first.'
    : !offsetAccountId ? 'Choose the other account.'
    : quantityChange === 0 ? 'Enter a quantity.'
    : after < 0 ? `Only ${item.quantityAtHand} on hand.`
    : costCents <= 0 ? (kind === 'purchase' ? 'Enter the cost per unit.' : 'Set the item\'s unit cost first.')
    : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) return;
    setSaving(true);
    try {
      const result = await adjustStockRequest({
        workspaceId, itemId: item.id, quantityChange, type: kind, inventoryAccountId, offsetAccountId, date,
        ...(note.trim() ? { reason: note.trim() } : {}),
        ...(locationId.trim() ? { locationId: locationId.trim() } : {}),
        ...(kind === 'purchase' ? { unitCostCents: costCents } : {}),
      });
      toast.success(`${item.name}: ${result.newQuantity ?? after} in stock`);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div {...dialogProps} className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[var(--surface)] rounded-xl shadow-xl max-w-lg w-full border border-[var(--line)]">
        <div className="flex items-center justify-between p-5 border-b border-[var(--line)]">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-[var(--text)]">Adjust stock</h2>
            <p className="text-xs text-[var(--muted)]">{item.name}{item.sku ? ` (${item.sku})` : ''} · {item.quantityAtHand} on hand</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close adjust stock" className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--text)]">
            <X aria-hidden="true" className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="stock-adjust-kind" className={stockLabelClass}>Why</label>
              <select id="stock-adjust-kind" value={kind} onChange={e => changeKind(e.target.value as AdjustKind)} className={stockFieldClass}>
                {(Object.keys(STOCK_CHANGE_LABELS) as AdjustKind[]).map(k => <option key={k} value={k}>{STOCK_CHANGE_LABELS[k]}</option>)}
              </select>
            </div>
            {kind === 'adjustment' && (
              <fieldset>
                <legend className={stockLabelClass}>Change</legend>
                <div className="flex gap-2">
                  {(['remove', 'add'] as const).map(d => (
                    <button key={d} type="button" aria-pressed={direction === d} onClick={() => setDirection(d)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border ${direction === d ? 'bg-[var(--text)] text-[var(--surface)] border-[var(--text)]' : 'border-[var(--line)] text-[var(--text)]'}`}>
                      {d === 'remove' ? 'Remove' : 'Add'}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <div>
              <label htmlFor="stock-adjust-qty" className={stockLabelClass}>Quantity</label>
              <input id="stock-adjust-qty" type="number" min="0" step="any" required value={quantity} onChange={e => setQuantity(e.target.value)} className={stockFieldClass} />
            </div>
            {kind === 'purchase' && (
              <div>
                <label htmlFor="stock-adjust-cost" className={stockLabelClass}>Cost per unit</label>
                <input id="stock-adjust-cost" type="number" min="0" step="0.01" required value={unitCost} onChange={e => setUnitCost(e.target.value)} className={stockFieldClass} />
              </div>
            )}
          </div>
          <StockAccountFields
            inventoryChoices={inventoryChoices} offsetChoices={offsetChoices}
            inventoryAccountId={inventoryAccountId} offsetAccountId={offsetAccountId}
            onInventoryChange={setInventoryAccountId} onOffsetChange={setOffsetAccountId}
            offsetLabel={OFFSET_LABEL[kind]} date={date} onDateChange={setDate} note={note} onNoteChange={setNote}
          />
          <div>
            <label htmlFor="stock-adjust-location" className={stockLabelClass}>Location (optional)</label>
            <input id="stock-adjust-location" list="stock-adjust-locations" value={locationId} onChange={e => setLocationId(e.target.value)} placeholder="Where the units are" className={stockFieldClass} />
            <datalist id="stock-adjust-locations">{locations.map(n => <option key={n.id} value={n.id}>{n.description}</option>)}</datalist>
          </div>
          <div className="p-3 rounded-lg bg-[var(--ink)] border border-[var(--line)] text-sm flex justify-between" aria-live="polite">
            <span className="text-[var(--muted)]">Stock {item.quantityAtHand} → {quantityChange ? after : item.quantityAtHand}</span>
            <span className="font-mono tabular-nums text-[var(--text)]" data-testid="stock-adjust-value">{formatCurrency(valueCents, currency)}</span>
          </div>
          {problem && (quantity !== '' || !inventoryAccountId) && <p role="alert" className="text-xs text-[var(--neg)]">{problem}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-[var(--text)] hover:bg-[var(--ink)]">Cancel</button>
            <button type="submit" disabled={saving || !!problem} className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-700 text-white disabled:opacity-50">
              {saving ? 'Saving…' : 'Save adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
