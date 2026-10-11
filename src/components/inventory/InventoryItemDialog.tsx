import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import AsyncButton from '../ui/AsyncButton';
import { useDialog } from '../../hooks/useDialog';
import type { InventoryItem } from '../../types';

interface InventoryItemDialogProps {
  open: boolean;
  editingItem: InventoryItem | null;
  categories: string[];
  /** A-7: the sales tax codes an item may default to (Settings → Taxes) */
  taxCodes?: Array<{ id: string; name: string }>;
  canChangeStock: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Opens Adjust stock for the item being edited (its quantity changes only through the books). */
  onAdjust: (item: InventoryItem) => void;
}

/** The add / edit item form of the Inventory screen (F-16: moved out of Inventory.tsx). */
export default function InventoryItemDialog({ open, editingItem, categories, taxCodes = [], canChangeStock, onClose, onSubmit, onAdjust }: InventoryItemDialogProps) {
  const { dialogProps: itemDialogProps, titleId: itemTitleId } = useDialog(onClose, open);
  return (
    <AnimatePresence>
        {open && (
          <div {...itemDialogProps} className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[var(--surface)] rounded-[40px] shadow-2xl border border-[var(--line)] overflow-hidden"
            >
              <div className="p-4 md:p-8 border-b border-[var(--line)] flex items-center justify-between">
                <h2 id={itemTitleId} className="text-xl font-black text-[var(--text)] tracking-tighter">
                  {editingItem ? 'Edit Inventory Item' : 'New Inventory Item'}
                </h2>
                <button aria-label="Close item dialog"
                  onClick={onClose} 
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X aria-hidden="true" size={20} className="text-zinc-400" />
                </button>
              </div>
              <form onSubmit={onSubmit} className="p-4 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="col-span-2 space-y-2">
                  <label htmlFor="inv-item-name" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Item Name</label>
                  <input 
                    id="inv-item-name"
                    name="name" 
                    defaultValue={editingItem?.name}
                    required 
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="inv-sku" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">SKU</label>
                  <input 
                    id="inv-sku"
                    name="sku" 
                    defaultValue={editingItem?.sku}
                    required 
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="inv-category" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Category</label>
                  <input 
                    id="inv-category"
                    name="category" 
                    list="inv-category-options"
                    defaultValue={editingItem?.category}
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="inv-item-type" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Kind</label>
                  <select id="inv-item-type" name="itemType" defaultValue={editingItem?.itemType || 'stock'} disabled={Boolean(editingItem?.quantityAtHand)}
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold">
                    <option value="stock">Stock item (counted, costed when sold)</option>
                    <option value="service">Service (no stock: fills the price on invoices)</option>
                  </select>
                  {Boolean(editingItem?.quantityAtHand) && <p className="text-[10px] text-[var(--muted)]">It has stock on hand, so it stays a stock item.</p>}
                </div>
                <datalist id="inv-category-options">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
                <div className="space-y-2">
                  <label htmlFor="inv-unit-cost" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Unit Cost ($)</label>
                  <input 
                    id="inv-unit-cost"
                    name="unitCost" 
                    type="number" 
                    step="0.01" 
                    defaultValue={editingItem ? editingItem.unitCostCents / 100 : undefined}
                    required 
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="inv-unit-price" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Unit Price ($)</label>
                  <input 
                    id="inv-unit-price"
                    name="unitPrice" 
                    type="number" 
                    step="0.01" 
                    defaultValue={editingItem ? editingItem.unitPriceCents / 100 : undefined}
                    required 
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                {editingItem ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Quantity at Hand</p>
                    <div className="flex items-center justify-between px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] font-bold">
                      <span className="tabular-nums">{editingItem.quantityAtHand}</span>
                      {canChangeStock && (
                        <button type="button" onClick={() => onAdjust(editingItem)} className="text-xs font-semibold text-emerald-700 hover:underline">
                          Adjust stock
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label htmlFor="inv-quantity" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Opening stock</label>
                    <input
                      id="inv-quantity"
                      name="quantity"
                      type="number"
                      min="0"
                      step="any"
                      defaultValue={0}
                      aria-describedby="inv-quantity-help"
                      className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold"
                    />
                    <p id="inv-quantity-help" className="text-[10px] text-[var(--muted)]">Recorded at the unit cost against Opening Balance Equity.</p>
                  </div>
                )}
                <div className="space-y-2">
                  <label htmlFor="inv-default-tax" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Default tax code</label>
                  <select id="inv-default-tax" name="defaultTaxCodeId" defaultValue={editingItem?.defaultTaxCodeId || ''}
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold">
                    <option value="">No default (the invoice's tax choice)</option>
                    {taxCodes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className="text-[10px] text-[var(--muted)]">Choosing this item on an invoice fills this tax code; it can still be changed there.</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="inv-reorder-point" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Reorder Point</label>
                  <input 
                    id="inv-reorder-point"
                    name="reorderPoint" 
                    type="number" 
                    defaultValue={editingItem?.reorderPoint}
                    required 
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="inv-uom" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">UOM (e.g. pack, kg)</label>
                  <input 
                    id="inv-uom"
                    name="measurementUnit" 
                    type="text" 
                    defaultValue={editingItem?.measurementUnit}
                    placeholder="Optional"
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="inv-units-per-pkg" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Units per Package</label>
                  <input 
                    id="inv-units-per-pkg"
                    name="unitsPerPackage" 
                    type="number" 
                    defaultValue={editingItem?.unitsPerPackage}
                    placeholder="1"
                    min="1"
                    className="w-full px-6 py-4 bg-[var(--ink)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-bold" 
                  />
                </div>
                <div className="col-span-2 pt-4">
                  <AsyncButton 
                    type="submit" 
                    loadingText={editingItem ? 'Updating...' : 'Adding...'}
                    className="w-full py-5 bg-zinc-900 text-white rounded-[32px] font-black hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20"
                  >
                    {editingItem ? 'Update Item' : 'Add to Inventory'}
                  </AsyncButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}

    </AnimatePresence>
  );
}
