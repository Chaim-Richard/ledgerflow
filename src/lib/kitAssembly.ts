/**
 * A-116: kits assembled on demand (built on A-19's bundles). A bundle is never a stock item
 * (`itemBundles.ts`): a kit "assembled on demand" is built out of its parts at the moment it is
 * needed, so what matters is (a) how many kits the parts on hand can build, and (b) what building
 * N kits consumes. This module answers both, from the parts' own stock — and then records nothing:
 * stock, cost and posting stay the parts' own, exactly as on an invoice made of the parts.
 *
 * Pure: the Kit Assembly report and the item dialog call it. Nothing here writes.
 */
import { isBundle, type BundleHost, type BundlePart } from './itemBundles';

/** The stock fields a part's status needs (a subset, so tests need no full records). */
export interface KitPartStock {
  id: string;
  name: string;
  sku?: string;
  quantityAtHand?: number;
}

export interface KitPartStatus {
  itemId: string;
  name: string;
  sku?: string;
  /** how many of the part one kit takes */
  perKit: number;
  onHand: number;
  /** how many kits the on-hand stock of this part alone can build */
  buildable: number;
  /** how many of this part are missing for one kit (0 when it can build one) */
  shortfallPerKit: number;
}

export interface KitConsumptionLine {
  itemId: string;
  name: string;
  perKit: number;
  /** how many units N kits take */
  needed: number;
  onHand: number;
  /** what would be left after building N kits (may be negative: that is the shortfall) */
  remaining: number;
}

export interface KitBuildPlan {
  /** the kit asked about */
  kitId: string;
  kitName: string;
  parts: KitPartStatus[];
  /** how many complete kits the parts on hand can build (0 when any part is missing) */
  buildableKits: number;
  /** the N asked for, when asked */
  requestedKits?: number;
  consumption?: KitConsumptionLine[];
  /** why N kits cannot be built from what is on hand, or null when they can (or when none was asked) */
  problem?: string | null;
}

const whole = (n: number) => Number.isInteger(n) && n > 0;

/**
 * The parts of one kit, their on-hand stock and how many kits can be built. `requestedKits` adds
 * the consumption of building that many: each part × per kit, and what would remain. A part that is
 * not in the item list counts as none on hand — the plan names it, never invents stock. Pure.
 */
export function kitBuildPlan(kit: BundleHost & { name: string }, items: KitPartStock[], requestedKits?: number): KitBuildPlan {
  const stock = new Map(items.map(i => [i.id, i]));
  const parts: KitPartStatus[] = (kit.bundleParts || []).map((part: BundlePart) => {
    const item = stock.get(part.itemId);
    const onHand = round6(Number(item?.quantityAtHand) || 0);
    const perKit = Number(part.quantity) || 0;
    return {
      itemId: part.itemId,
      name: item?.name || part.itemId,
      ...(item?.sku ? { sku: item.sku } : {}),
      perKit,
      onHand,
      buildable: perKit > 0 ? Math.floor(onHand / perKit) : 0,
      shortfallPerKit: perKit > onHand ? round6(perKit - onHand) : 0,
    };
  });
  const buildableKits = parts.length ? Math.max(0, Math.min(...parts.map(p => p.buildable))) : 0;
  const plan: KitBuildPlan = { kitId: kit.id, kitName: kit.name, parts, buildableKits };
  if (requestedKits === undefined || Number.isNaN(requestedKits)) return plan;
  const n = Math.floor(Number(requestedKits) || 0);
  plan.requestedKits = n;
  plan.consumption = parts.map(p => ({
    itemId: p.itemId, name: p.name, perKit: p.perKit,
    needed: round6(p.perKit * n), onHand: p.onHand, remaining: round6(p.onHand - p.perKit * n),
  }));
  const short = plan.consumption.filter(c => c.remaining < 0);
  plan.problem = !whole(n) && n !== 0
    ? 'Enter how many kits to build (a whole number, zero or more)'
    : short.length
      ? `Only ${buildableKits} ${buildableKits === 1 ? 'kit' : 'kits'} can be built from what is on hand; ${short.map(c => `${c.name} is short ${-c.remaining}`).join(', ')}`
      : null;
  return plan;
}

/** The "can we build N?" line for the inventory list: "5 kits from stock" or what is missing. */
export function kitBuildableSummary(kit: BundleHost & { name: string }, items: KitPartStock[]): string {
  if (!kit.bundleParts?.length) return 'no parts';
  const plan = kitBuildPlan(kit, items);
  if (!plan.parts.length) return 'no parts';
  const short = plan.parts.filter(p => p.shortfallPerKit > 0);
  const ready = `${plan.buildableKits} ${plan.buildableKits === 1 ? 'kit' : 'kits'} from stock`;
  return short.length ? `${ready}; missing ${short.map(p => `${p.shortfallPerKit} ${p.name}`).join(', ')} per kit` : ready;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * The `assembleOnDemand` mark on an item: the kit is built out of its parts when it is needed and
 * keeps no stock of its own (bundles never do). Kept on the item document beside `bundleParts`.
 */
export const assembleOnDemandOf = (item: { assembleOnDemand?: boolean } | null | undefined): boolean => Boolean(item?.assembleOnDemand);

/** Why the mark may not be saved, or null: only a bundle can be assembled on demand. */
export function assembleOnDemandProblem(item: BundleHost, on: boolean): string | null {
  if (on && !isBundle(item)) return 'Only a bundle (an item with parts) can be assembled on demand.';
  return null;
}
