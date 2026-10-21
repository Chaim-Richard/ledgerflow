/**
 * DIM-2 phase 4 (GitHub #132): for a period, where each item's stock came from and where it went, from the stock
 * history alone (`itemDetails`, src/lib/stockMoves.ts) — the one physical log; no second ledger, nothing written.
 *
 *   opening + Σ sources − Σ uses = closing           (moves between locations net to zero and are shown apart)
 *
 * Sources: bought from each vendor (a bill undone takes its units off the same vendor), received with Adjust stock
 * (no bill), origin not recorded (opening stock, imports), adjusted up, returned by customers.
 * Uses: sold to each customer, by the sold line's labels (project, property, …) — an undone sale takes its units off
 * the same customer — sent back to vendors, adjusted down or counted down (by the reason written), cost of goods sold
 * recorded by hand. A cost change (revaluation) moves value, not units.
 * What is not known is said: a purchase with no vendor recorded, a sale with no customer recorded and any check that
 * does not add up are flagged; nothing is assigned by guess. Moving-average cost stays the valuation: a use's value is
 * what its move was booked at, not a lot's cost.
 */
import type { ItemDetails } from './stockMoves';

export type FlowKind = 'vendor' | 'adjust-stock' | 'not-recorded' | 'adjusted' | 'customer-return' | 'customer' | 'vendor-return' | 'manual-cogs' | 'revaluation';

export interface FlowLine {
  key: string;
  kind: FlowKind;
  label: string;
  /** units (positive: the direction the section says; negative when undone units outweigh) */
  quantity: number;
  valueCents: number;
  moves: number;
  /** true when the line's party or reason is not recorded */
  unknown?: boolean;
}

export interface ItemSourcesUses {
  itemId: string;
  itemName: string;
  opening: { quantity: number; valueCents: number };
  sources: FlowLine[];
  uses: FlowLine[];
  /** value moved without units (revaluations) */
  costChanges: { valueCents: number; moves: number };
  /** moves between locations: they net to zero for the item; a lone half shows as `net` */
  transfers: { moves: number; net: number };
  closing: { quantity: number; valueCents: number };
  /** opening + sources − uses + transfers − closing: zero when the history explains the item */
  differenceUnits: number;
  /** units in or out whose party or reason is not recorded */
  unknownUnits: number;
}

export interface FlowNames {
  vendor: (id: string) => string | undefined;
  customer: (id: string) => string | undefined;
  /** a label value's name (dimension id, value id) */
  label: (dimensionId: string, id: string) => string;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

type Move = ItemDetails['moves'][number];

/** Which line of which section a move belongs to, and the units it adds to it (in that section's direction). */
function classify(m: Move, names: FlowNames): { section: 'source' | 'use' | 'transfer' | 'cost'; key: string; kind: FlowKind; label: string; units: number; unknown?: boolean } {
  const q = Number(m.quantity) || 0;
  const vendor = (id?: string) => (id ? names.vendor(id) || id : undefined);
  const customer = (id?: string) => (id ? names.customer(id) || id : undefined);
  const why = m.purpose?.trim();
  switch (m.kind) {
    case 'transfer-in': case 'transfer-out':
      return { section: 'transfer', key: 'transfer', kind: 'adjusted', label: 'Moved between locations', units: q };
    case 'purchase': case 'purchase-reversal': {
      if (m.documentType === 'adjustment') return { section: 'source', key: 'adjust-stock', kind: 'adjust-stock', label: 'Received with Adjust stock (no bill)', units: q };
      const name = vendor(m.vendorId);
      return { section: 'source', key: `vendor:${m.vendorId || ''}`, kind: 'vendor', label: name ? `Bought from ${name}` : 'Bought on bills with no vendor recorded', units: q, ...(name ? {} : { unknown: true }) };
    }
    case 'opening':
      return { section: 'source', key: 'not-recorded', kind: 'not-recorded', label: 'Origin not recorded (opening stock, imports)', units: q, unknown: true };
    case 'return': case 'return-reversal': {
      const name = customer(m.customerId);
      return { section: 'source', key: `return:${m.customerId || ''}`, kind: 'customer-return', label: name ? `Returned by ${name}` : 'Returned by customers not recorded', units: q, ...(name ? {} : { unknown: true }) };
    }
    case 'sale': case 'sale-reversal': {
      const name = customer(m.customerId);
      const labels = Object.entries(m.labels || {}).sort(([a], [b]) => a.localeCompare(b));
      const where = labels.map(([dim, id]) => names.label(dim, id)).join(' · ');
      return {
        section: 'use', key: `customer:${m.customerId || ''}|${labels.map(([d, v]) => `${d}=${v}`).join(',')}`, kind: 'customer',
        label: `${name ? `Sold to ${name}` : 'Sold, customer not recorded'}${where ? ` · ${where}` : ''}`, units: -q, ...(name ? {} : { unknown: true }),
      };
    }
    case 'purchase-return': case 'purchase-return-reversal': {
      const name = vendor(m.vendorId);
      return { section: 'use', key: `vendor-return:${m.vendorId || ''}`, kind: 'vendor-return', label: name ? `Sent back to ${name}` : 'Sent back to vendors not recorded', units: -q, ...(name ? {} : { unknown: true }) };
    }
    case 'manual-cogs':
      return { section: 'use', key: 'manual-cogs', kind: 'manual-cogs', label: 'Cost of goods sold recorded by hand', units: -q };
    default: {
      // adjustments and counts, and a value-only change (a revaluation moves no units)
      if (q === 0) return { section: 'cost', key: 'revaluation', kind: 'revaluation', label: 'Cost changes', units: 0 };
      const reason = why ? `: ${why}` : ' (no reason written)';
      if (q > 0) return { section: 'source', key: `adjusted-up:${why || ''}`, kind: 'adjusted', label: `${m.kind === 'count' ? 'Counted up' : 'Adjusted up'}${reason}`, units: q, ...(why ? {} : { unknown: true }) };
      return { section: 'use', key: `adjusted-down:${why || ''}`, kind: 'adjusted', label: `${m.kind === 'count' ? 'Counted down' : 'Adjusted down'}${reason}`, units: -q, ...(why ? {} : { unknown: true }) };
    }
  }
}

export function stockSourcesUses(details: ItemDetails[], names: FlowNames): ItemSourcesUses[] {
  return details.map(d => {
    const sources = new Map<string, FlowLine>();
    const uses = new Map<string, FlowLine>();
    const costChanges = { valueCents: 0, moves: 0 };
    const transfers = { moves: 0, net: 0 };
    for (const m of d.moves) {
      const c = classify(m, names);
      if (c.section === 'transfer') { transfers.moves++; transfers.net = round6(transfers.net + c.units); continue; }
      if (c.section === 'cost') { costChanges.valueCents += Number(m.valueCents) || 0; costChanges.moves++; continue; }
      const book = c.section === 'source' ? sources : uses;
      const line = book.get(c.key) || { key: c.key, kind: c.kind, label: c.label, quantity: 0, valueCents: 0, moves: 0, ...(c.unknown ? { unknown: true } : {}) };
      line.quantity = round6(line.quantity + c.units);
      // value in the section's direction too: a use's value is what left stock
      line.valueCents += c.section === 'source' ? Number(m.valueCents) || 0 : -(Number(m.valueCents) || 0);
      line.moves++;
      book.set(c.key, line);
    }
    const sum = (lines: FlowLine[]) => round6(lines.reduce((s, l) => s + l.quantity, 0));
    const src = [...sources.values()].sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label));
    const use = [...uses.values()].sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label));
    const differenceUnits = round6(d.opening.quantity + sum(src) - sum(use) + transfers.net - d.closing.quantity);
    const unknownUnits = round6([...src, ...use].filter(l => l.unknown).reduce((s, l) => s + Math.abs(l.quantity), 0));
    return { itemId: d.itemId, itemName: d.itemName, opening: d.opening, sources: src, uses: use, costChanges, transfers, closing: d.closing, differenceUnits, unknownUnits };
  });
}

/** CSV rows: item, section, line, units, value (cents as money), moves. */
export function stockSourcesUsesCsv(rows: ItemSourcesUses[], money: (cents: number) => string): string[][] {
  const out: string[][] = [['Item', 'Section', 'Line', 'Units', 'Value', 'Moves']];
  for (const r of rows) {
    out.push([r.itemName, 'Opening', '', String(r.opening.quantity), money(r.opening.valueCents), '']);
    for (const l of r.sources) out.push([r.itemName, 'Source', l.label, String(l.quantity), money(l.valueCents), String(l.moves)]);
    for (const l of r.uses) out.push([r.itemName, 'Use', l.label, String(l.quantity), money(l.valueCents), String(l.moves)]);
    if (r.costChanges.moves) out.push([r.itemName, 'Cost changes', '', '0', money(r.costChanges.valueCents), String(r.costChanges.moves)]);
    if (r.transfers.moves) out.push([r.itemName, 'Moved between locations', '', String(r.transfers.net), '', String(r.transfers.moves)]);
    out.push([r.itemName, 'Closing', '', String(r.closing.quantity), money(r.closing.valueCents), '']);
    if (r.differenceUnits) out.push([r.itemName, 'Does not add up', `${r.differenceUnits} units not explained by the history`, String(r.differenceUnits), '', '']);
  }
  return out;
}
