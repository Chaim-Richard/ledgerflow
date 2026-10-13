/**
 * A-41 (PLAN §10): marketplace facilitator rules. A line whose facts say the sale went through a
 * marketplace gets one `exclude` rule per jurisdiction, which switches off that state's own rate
 * rule (A-22/A-38): the facilitator collects, so the seller's line must not also be taxed.
 *
 * The rule is written as an exclusion rather than a zero rate on purpose — a zero-rate row would look
 * like the seller made a tax-free sale, while the truth is that a different person is the vendor.
 *
 * Limit (stated, not hidden): local rules from the reviewed import pack (A-40) are built per
 * workspace, so this pack cannot name their ids. Where the state's marketplace law also covers local
 * tax (most now do), the caller adds the local pack's result only after confirming that — the pack
 * says which states these are in its own notes, and never silently adds local tax on top.
 */
import { US_MARKETPLACE_FACILITATORS, US_MARKETPLACE_ROW_LIMITS } from '../../tax/usMarketplaceFacilitator';
import type { Rule } from '../rules';
import { usSalesTaxPack } from './usSalesTaxPack';
import { rateRule, slug, type MarketplaceEffect, type TaxRulePack, type UnmappedRow } from './shared';

/** The state rate rule ids a channel exclusion switches off: every row of that state, all dates. */
function stateRateTargets(state: string): string[] {
  return usSalesTaxPack().rules
    .filter(rule => rule.when.some(c => c.attribute === 'state' && (c.values || []).includes(state)))
    .map(rule => rule.id);
}

export function marketplaceChannelPack(): TaxRulePack {
  const rules: Array<Rule<MarketplaceEffect>> = US_MARKETPLACE_FACILITATORS.map(row => {
    const targets = stateRateTargets(row.state);
    return rateRule<MarketplaceEffect>({
      id: `us-marketplace-${slug(row.state)}-${slug(row.validFrom)}`,
      name: `${row.stateName}: the marketplace collects, not the seller`,
      when: [
        { attribute: 'country', op: 'in', values: ['US'] },
        { attribute: 'state', op: 'in', values: [row.state] },
        { attribute: 'channel', op: 'in', values: ['marketplace'] },
      ],
      combine: 'exclude',
      targets,
      effect: {
        kind: 'marketplace',
        state: row.state,
        stateName: row.stateName,
        assertedFrom: row.validFrom,
        note: row.note || '',
      },
      validFrom: row.validFrom,
      ...(row.validTo ? { validTo: row.validTo } : {}),
      source: {
        authority: `${row.stateName} Department of Revenue`,
        url: row.source,
        retrieved: row.checked,
      },
      status: 'calculation',
    });
  });

  const unmapped: UnmappedRow[] = US_MARKETPLACE_ROW_LIMITS.map(row => ({
    row: `${row.state} (${row.stateName})`,
    reason: row.reason,
  }));

  return {
    id: 'us-marketplace-facilitator',
    name: 'US marketplace facilitator collection (channel rules)',
    rules,
    unmapped,
  };
}

/** The rule id a state's channel exclusion has on a date, for screens that explain a line. */
export function marketplaceRuleId(state: string, date: string): string | undefined {
  const row = US_MARKETPLACE_FACILITATORS.find(r => r.state === state.toUpperCase() && r.validFrom <= date && (!r.validTo || date <= r.validTo));
  return row ? `us-marketplace-${slug(row.state)}-${slug(row.validFrom)}` : undefined;
}
