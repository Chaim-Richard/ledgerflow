import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { amountStep, minorToMajor } from '../../lib/currencyMinorUnits';
import { billItemProblem } from '../../lib/billStock';
import {
  customerPricer,
  findInventoryItem,
  lineAmountCents,
  setLineDescription,
  taxCodeToFillFromItem,
} from '../../lib/invoiceLines';
import { formatCurrency } from '../../lib/utils';
import { TruthEngine } from '../../modules/integrity/TruthEngine';
import { useAuthStore } from '../../stores/useAuthStore';
import type { ChartAccount, EntityMetadata, InventoryItem } from '../../types';
import { BudgetLeft } from './BudgetLeft';
import { LineLabels } from './LineLabels';

interface LineBase {
  id: string;
  description: string;
  accountId: string;
  amountCents: number;
  itemId?: string;
  dimensions?: Record<string, string>;
}

export interface InvoiceEditorLine extends LineBase {
  quantity: number;
  rateCents: number;
  taxRate?: number;
  unitCostCents?: number;
  serialNumbers?: string[];
  lotNumber?: string;
  metadata?: EntityMetadata;
}

export interface BillEditorLine extends LineBase {
  quantity?: number;
  exchangeRate?: number;
  landedCost?: boolean;
  orderLine?: number;
  orderQuantity?: number;
}

export type DocumentEditorLine = InvoiceEditorLine | BillEditorLine;

function isInvoiceLine(line: DocumentEditorLine): line is InvoiceEditorLine {
  return 'rateCents' in line && typeof line.rateCents === 'number' && typeof line.quantity === 'number';
}

interface DocumentLineEditorProps<T extends DocumentEditorLine> {
  side: 'invoice' | 'bill';
  lines: T[];
  onChange: (lines: T[]) => void;
  createLine: () => T;
  accounts: ChartAccount[];
  currency: string;
  date: string;
  inventoryItems: InventoryItem[];
  fieldErrors?: Record<string, string>;
  /** Invoice-only item pricing and tax-code autofill. */
  customerId?: string;
  taxCodeIds?: string[];
  onTaxCodeFill?: (taxCodeId: string) => void;
  /** Bill-only budget conversion and duplicate-document exclusion. */
  workspaceCurrency?: string;
  exchangeRate?: number;
  documentId?: string;
  /** The existing repeat-last action stays beside the Add button. */
  repeatAction?: ReactNode;
}

function EditorFieldError({ id, errors }: { id: string; errors: Record<string, string> }) {
  return errors[id]
    ? <p id={`${id}-error`} role="alert" className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors[id]}</p>
    : null;
}

/**
 * A-214: the shared invoice/bill line editor. Invoice lines keep quantity × rate; bill lines keep
 * their direct amount, stock units and budget context. Save/posting code remains in each modal.
 */
export default function DocumentLineEditor<T extends DocumentEditorLine>({
  side,
  lines,
  onChange,
  createLine,
  accounts,
  currency,
  date,
  inventoryItems,
  fieldErrors = {},
  customerId,
  taxCodeIds = [],
  onTaxCodeFill,
  workspaceCurrency = currency,
  exchangeRate = 1,
  documentId,
  repeatAction,
}: DocumentLineEditorProps<T>) {
  const invoice = side === 'invoice';
  const updateAt = (index: number, update: (line: T) => T) => {
    onChange(lines.map((line, i) => i === index ? update(line) : line));
  };
  const moveLine = (index: number, offset: -1 | 1) => {
    const destination = index + offset;
    if (destination < 0 || destination >= lines.length) return;
    const next = [...lines];
    [next[index], next[destination]] = [next[destination], next[index]];
    onChange(next);
  };
  const money = (cents: number) => formatCurrency(cents, currency);

  return (
    <div className="space-y-4">
      <div className={invoice ? 'flex flex-wrap gap-2 items-center justify-between' : 'flex items-center justify-between'}>
        <h3 className="micro-label">{invoice ? 'Line Items' : 'Expense Allocation'}</h3>
        {repeatAction}
        <button
          type="button"
          aria-label={invoice ? undefined : 'Add Split Expense'}
          onClick={() => onChange([...lines, createLine()])}
          className={`flex items-center gap-2 min-h-11 px-4 py-2 bg-[var(--surface)] border border-[var(--line)] text-[var(--text)] rounded-xl text-[10px] font-medium uppercase tracking-wider transition-all ${invoice ? 'hover:bg-zinc-200' : 'hover:bg-[var(--elevated)]'}`}
        >
          <Plus size={14} />
          {invoice ? 'Add Item' : 'Add Split'}
        </button>
      </div>

      <div className="space-y-3">
        {lines.map((line, idx) => (
          <div
            key={line.id}
            className={invoice
              ? 'grid grid-cols-12 gap-3 items-end bg-[var(--ink)] p-4 rounded-[32px] border border-[var(--line)]'
              : 'grid grid-cols-12 gap-3 md:gap-4 items-end bg-[var(--ink)] p-3 sm:p-4 rounded-2xl sm:rounded-[32px] border border-[var(--line)]'}
          >
            <div className={`${invoice ? 'col-span-12 md:col-span-4' : 'col-span-12 md:col-span-5'} min-w-0 space-y-1`}>
              <label htmlFor={`${invoice ? 'inv-item' : 'bill-split'}-desc-${idx}`} className={`text-[10px] font-bold ${invoice ? 'text-zinc-400' : 'text-[var(--muted)]'} uppercase`}>
                {invoice ? 'Item / Description' : 'Description'}
              </label>
              {invoice ? (
                <div className="relative">
                  <input
                    id={`inv-item-desc-${idx}`}
                    aria-invalid={Boolean(fieldErrors[`inv-item-desc-${idx}`])}
                    aria-describedby={fieldErrors[`inv-item-desc-${idx}`] ? `inv-item-desc-${idx}-error` : undefined}
                    type="text"
                    list={`invoice-inventory-list-${idx}`}
                    value={line.description}
                    onChange={event => {
                      if (!isInvoiceLine(line)) return;
                      const text = event.target.value;
                      const fillCode = taxCodeToFillFromItem(line.itemId, findInventoryItem(inventoryItems, text), taxCodeIds);
                      const updated = setLineDescription(
                        line,
                        text,
                        inventoryItems,
                        customerPricer(useAuthStore.getState().getCurrentWorkspace()?.priceLists, customerId),
                      );
                      updateAt(idx, current => ({ ...current, ...updated }) as T);
                      if (fillCode) onTaxCodeFill?.(fillCode);
                    }}
                    placeholder="Service or Product"
                    className="w-full min-h-11 px-3 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <EditorFieldError id={`inv-item-desc-${idx}`} errors={fieldErrors} />
                  <datalist id={`invoice-inventory-list-${idx}`}>
                    {inventoryItems.map(item => (
                      <option key={item.id} value={item.name}>{item.sku ? `[${item.sku}] ` : ''}{item.name} · {formatCurrency(item.unitPriceCents)} · stock {item.quantityAtHand}</option>
                    ))}
                  </datalist>
                </div>
              ) : (
                <input
                  id={`bill-split-desc-${idx}`}
                  type="text"
                  aria-invalid={Boolean(fieldErrors[`bill-split-desc-${idx}`])}
                  aria-describedby={fieldErrors[`bill-split-desc-${idx}`] ? `bill-split-desc-${idx}-error` : undefined}
                  value={line.description}
                  onChange={event => updateAt(idx, current => ({ ...current, description: event.target.value }) as T)}
                  placeholder="What was this for?"
                  className="w-full min-h-11 px-4 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900"
                />
              )}
              {!invoice && <EditorFieldError id={`bill-split-desc-${idx}`} errors={fieldErrors} />}
              {invoice && idx === 0 && inventoryItems.length === 0 && (
                <p className="text-[10px] text-[var(--muted)]">No items yet — add products in Inventory to pick them here.</p>
              )}
            </div>

            {invoice && isInvoiceLine(line) && (
              <>
                <div className="col-span-6 md:col-span-2 min-w-0 space-y-1">
                  <label htmlFor={`inv-item-qty-${idx}`} className="text-[10px] font-bold text-zinc-400 uppercase">Qty</label>
                  <input
                    id={`inv-item-qty-${idx}`}
                    aria-invalid={Boolean(fieldErrors[`inv-item-qty-${idx}`])}
                    aria-describedby={fieldErrors[`inv-item-qty-${idx}`] ? `inv-item-qty-${idx}-error` : undefined}
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.quantity}
                    onChange={event => {
                      const quantity = parseFloat(event.target.value || '0');
                      updateAt(idx, current => ({ ...current, quantity, amountCents: lineAmountCents(quantity, isInvoiceLine(current) ? current.rateCents : 0) }) as T);
                    }}
                    className="w-full min-h-11 px-3 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 font-mono"
                  />
                  <EditorFieldError id={`inv-item-qty-${idx}`} errors={fieldErrors} />
                </div>
                <div className="col-span-6 md:col-span-2 min-w-0 space-y-1">
                  <label htmlFor={`inv-item-rate-${idx}`} className="text-[10px] font-bold text-zinc-400 uppercase">Rate ({currency})</label>
                  <input
                    id={`inv-item-rate-${idx}`}
                    aria-invalid={Boolean(fieldErrors[`inv-item-rate-${idx}`])}
                    aria-describedby={fieldErrors[`inv-item-rate-${idx}`] ? `inv-item-rate-${idx}-error` : undefined}
                    type="number"
                    step={amountStep(currency)}
                    min="0"
                    value={minorToMajor(line.rateCents, currency)}
                    onChange={event => {
                      const rateCents = TruthEngine.parseAmountToCents(event.target.value || '0', currency);
                      updateAt(idx, current => ({ ...current, rateCents, amountCents: lineAmountCents(current.quantity || 0, rateCents) }) as T);
                    }}
                    className="w-full min-h-11 px-3 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 font-mono"
                  />
                  <EditorFieldError id={`inv-item-rate-${idx}`} errors={fieldErrors} />
                </div>
              </>
            )}

            <div className={`${invoice ? 'col-span-12 md:col-span-2' : 'col-span-12 md:col-span-3'} min-w-0 space-y-1`}>
              <label htmlFor={`${invoice ? 'inv-item' : 'bill-split'}-acc-${idx}`} className={`text-[10px] font-bold ${invoice ? 'text-zinc-400' : 'text-[var(--muted)]'} uppercase`}>
                {invoice ? 'Income Account' : 'Expense Account'}
              </label>
              {invoice ? (
                <div className="relative">
                  <input
                    id={`inv-item-acc-${idx}`}
                    aria-invalid={Boolean(fieldErrors[`inv-item-acc-${idx}`])}
                    aria-describedby={fieldErrors[`inv-item-acc-${idx}`] ? `inv-item-acc-${idx}-error` : undefined}
                    list={`invoice-account-${idx}`}
                    value={accounts.find(account => account.id === line.accountId)?.name || line.accountId || ''}
                    onChange={event => {
                      const account = accounts.find(candidate => candidate.name === event.target.value || candidate.id === event.target.value);
                      updateAt(idx, current => ({ ...current, accountId: account ? account.id : event.target.value }) as T);
                    }}
                    placeholder="Type or select account"
                    className="w-full min-h-11 px-3 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <EditorFieldError id={`inv-item-acc-${idx}`} errors={fieldErrors} />
                  <datalist id={`invoice-account-${idx}`}>
                    {accounts.map(account => <option key={account.id} value={account.name} />)}
                  </datalist>
                </div>
              ) : (
                <>
                  <select
                    id={`bill-split-acc-${idx}`}
                    aria-invalid={Boolean(fieldErrors[`bill-split-acc-${idx}`])}
                    aria-describedby={fieldErrors[`bill-split-acc-${idx}`] ? `bill-split-acc-${idx}-error` : undefined}
                    value={line.accountId}
                    onChange={event => updateAt(idx, current => ({ ...current, accountId: event.target.value }) as T)}
                    className="w-full min-h-11 px-4 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <option value="">Select Account</option>
                    {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                  <EditorFieldError id={`bill-split-acc-${idx}`} errors={fieldErrors} />
                  <BudgetLeft
                    accountId={line.accountId}
                    date={date}
                    addingCents={Math.round(line.amountCents * (currency === workspaceCurrency ? 1 : exchangeRate || 1))}
                    excludeDocumentId={documentId}
                    currency={workspaceCurrency}
                  />
                </>
              )}
            </div>

            {invoice && isInvoiceLine(line) ? (
              <div className="col-span-10 md:col-span-1 space-y-1 flex flex-col justify-end">
                <div className="px-2 py-2 text-right font-mono font-bold text-[var(--text)] border border-transparent tabular-nums">
                  {money(line.amountCents)}
                </div>
              </div>
            ) : !invoice ? (
              <div className="col-span-8 md:col-span-3 min-w-0 space-y-1">
                <label htmlFor={`bill-split-amount-${idx}`} className="text-[10px] font-bold text-[var(--muted)] uppercase">Amount ({currency})</label>
                <input
                  id={`bill-split-amount-${idx}`}
                  type="number"
                  step={amountStep(currency)}
                  aria-invalid={Boolean(fieldErrors[`bill-split-amount-${idx}`])}
                  aria-describedby={fieldErrors[`bill-split-amount-${idx}`] ? `bill-split-amount-${idx}-error` : undefined}
                  value={minorToMajor(line.amountCents, currency)}
                  onChange={event => updateAt(idx, current => ({
                    ...current,
                    amountCents: TruthEngine.parseAmountToCents(event.target.value || '0', currency),
                  }) as T)}
                  className="w-full min-h-11 px-4 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 font-mono tabular-nums"
                />
                <EditorFieldError id={`bill-split-amount-${idx}`} errors={fieldErrors} />
              </div>
            ) : null}

            <div className={invoice ? 'col-span-2 md:col-span-1 pb-1' : 'col-span-4 md:col-span-1 pb-1 flex justify-end'}>
              <button
                type="button"
                aria-label={invoice ? `Remove line ${idx + 1}` : `Remove split line ${idx + 1}`}
                title={invoice ? `Remove line ${idx + 1}` : `Remove split line ${idx + 1}`}
                onClick={() => onChange(lines.filter((_, i) => i !== idx))}
                className="min-h-11 min-w-11 flex items-center justify-center p-2 text-[var(--muted)] hover:text-rose-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>

            {!invoice && inventoryItems.length > 0 && (
              <div className="col-span-12 flex flex-wrap items-end gap-3 text-xs">
                <label className="flex flex-col gap-1 w-full sm:w-auto text-[var(--muted)]">Stock item (optional)
                  <select
                    aria-label={`Stock item on line ${idx + 1}`}
                    value={line.itemId || ''}
                    onChange={event => updateAt(idx, current => ({
                      ...current,
                      itemId: event.target.value || undefined,
                      ...(event.target.value ? {} : { quantity: undefined }),
                    }) as T)}
                    className="w-full sm:w-auto min-h-11 px-3 py-1.5 bg-[var(--surface)] border border-[var(--line)] rounded-xl"
                  >
                    <option value="">None</option>
                    {inventoryItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                {line.itemId && (
                  <div className="flex flex-col gap-1 w-full sm:w-auto text-[var(--muted)]">
                    <label htmlFor={`bill-split-units-${idx}`}>Units</label>
                    <input
                      id={`bill-split-units-${idx}`}
                      aria-label={`Units on line ${idx + 1}`}
                      type="number"
                      min="0"
                      step="any"
                      value={line.quantity ?? ''}
                      aria-invalid={Boolean(fieldErrors[`bill-split-units-${idx}`])}
                      aria-describedby={fieldErrors[`bill-split-units-${idx}`] ? `bill-split-units-${idx}-error` : undefined}
                      onChange={event => updateAt(idx, current => ({
                        ...current,
                        quantity: event.target.value === '' ? undefined : Number(event.target.value),
                      }) as T)}
                      className="w-full sm:w-24 min-h-11 px-3 py-1.5 bg-[var(--surface)] border border-[var(--line)] rounded-xl font-mono"
                    />
                    <EditorFieldError id={`bill-split-units-${idx}`} errors={fieldErrors} />
                  </div>
                )}
                {line.itemId && <span className="pb-2 w-full sm:w-auto text-[var(--muted)]">{billItemProblem(line) || 'Posts to Inventory; the units come in with the bill.'}</span>}
                {!line.itemId && lines.some(candidate => candidate.itemId) && (
                  <label className="flex items-center gap-2 pb-2 min-h-11 text-[var(--muted)]">
                    <input
                      type="checkbox"
                      checked={Boolean('landedCost' in line && line.landedCost)}
                      aria-label={`Spread line ${idx + 1} over the items`}
                      onChange={event => updateAt(idx, current => ({ ...current, landedCost: event.target.checked || undefined }) as T)}
                    />
                    Spread over the items (freight, duty): adds to what they cost
                  </label>
                )}
              </div>
            )}

            <div className="col-span-12">
              <LineLabels
                value={line.dimensions}
                lineNumber={idx + 1}
                accountId={line.accountId}
                date={date}
                onChange={dimensions => updateAt(idx, current => ({ ...current, dimensions }) as T)}
              />
            </div>

            <div className="col-span-12 flex justify-end gap-1" aria-label={`Line ${idx + 1} order`}>
              <button
                type="button"
                aria-label={`Move line ${idx + 1} up`}
                title={`Move line ${idx + 1} up`}
                disabled={idx === 0}
                onClick={() => moveLine(idx, -1)}
                className="min-h-11 min-w-11 flex items-center justify-center p-2 text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30"
              >
                <ArrowUp size={18} />
              </button>
              <button
                type="button"
                aria-label={`Move line ${idx + 1} down`}
                title={`Move line ${idx + 1} down`}
                disabled={idx === lines.length - 1}
                onClick={() => moveLine(idx, 1)}
                className="min-h-11 min-w-11 flex items-center justify-center p-2 text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30"
              >
                <ArrowDown size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
