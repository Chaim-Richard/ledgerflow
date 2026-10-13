/**
 * A-52 (PLAN §3): EU cross-border B2B reverse charge as rules. Two rules per member state:
 *  - services (Directive 2006/112/EC Arts 44 and 196): the place of supply is the buyer's country,
 *    so the supplier charges none of its own VAT and the buyer self-assesses — from 1 Jan 2010
 *    (Directive 2008/8/EC);
 *  - goods (Art. 138 with Arts 2 and 20): an intra-community supply is exempt with credit in the
 *    supplier's country and the buyer accounts for acquisition VAT — from 1 Jan 1993 (the single
 *    market).
 * Both require the buyer's VAT number to be **verified** ('valid' with checked evidence — VIES or
 * the certificate itself): a declared label alone leaves the rule blocked, and the block says what
 * is missing. The rules switch off the supplier's own standard-rate rule (A-25's), which is the
 * "exclude" the task asks for; the buyer's own country taxes the supply instead. Status
 * 'calculation': a planning answer with its evidence trail, never a filed position.
 */
import { EU_VAT_RATES } from '../../tax/euVat';
import type { Condition } from '../rules';
import type { FactAttribute } from '../facts';
import { rateRule, where, slug, type ReverseChargeEffect, type TaxRulePack } from './shared';

/** A condition that an attribute is stated and is none of these (the buyer is in another member state). */
const whereNot = (attribute: FactAttribute, values: string[]): Condition => ({ attribute, op: 'notIn', values });

const DIRECTIVE = { authority: 'EUR-Lex — Council Directive 2006/112/EC', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32006L0112', retrieved: '2026-10-13' };

/** The member states and their standard-rate rule ids, taken from A-25's own table. */
export const EU_MEMBER_STATES: Array<{ country: string; countryName: string; standardRuleIds: string[] }> = (() => {
  const standards = EU_VAT_RATES.filter(row => row.kind === 'standard');
  const seen = new Map<string, { country: string; countryName: string; standardRuleIds: string[] }>();
  for (const row of standards) {
    const entry = seen.get(row.country) || { country: row.country, countryName: row.countryName, standardRuleIds: [] };
    entry.standardRuleIds.push(`eu-${slug(row.country)}-standard-${slug(row.validFrom)}-${slug(String(row.rate))}`);
    seen.set(row.country, entry);
  }
  return [...seen.values()];
})();

export const EU_MEMBER_STATE_CODES = EU_MEMBER_STATES.map(s => s.country);

function reverseChargeRules(): TaxRulePack['rules'] {
  return EU_MEMBER_STATES.flatMap(state => {
    const base = {
      scope: 'line' as const,
      when: [where('country', [state.country]), where('buyerCountry', EU_MEMBER_STATE_CODES), whereNot('buyerCountry', [state.country]), where('buyerVatStatus', ['valid'])],
      requiresVerified: ['buyerVatStatus'] as FactAttribute[],
      combine: 'exclude' as const,
      targets: state.standardRuleIds,
      source: DIRECTIVE,
    };
    return [
      rateRule<ReverseChargeEffect>({
        ...base,
        id: `eu-rc-services-${slug(state.country)}`,
        name: `${state.countryName}: B2B services to a VAT-registered buyer in another member state — the buyer accounts`,
        when: [...base.when, where('supplyKind', ['services'])],
        effect: {
          kind: 'reverse-charge', supplierCountry: state.country, supply: 'services',
          basis: 'Directive 2006/112/EC Art. 44 (the place of supply is where the buyer belongs) and Art. 196 (the buyer pays the VAT)',
          taxedBy: 'buyer',
          note: 'The supplier issues no own-country VAT and the invoice says "reverse charge"; the buyer self-assesses in their member state.',
        },
        validFrom: '2010-01-01',
      }),
      rateRule<ReverseChargeEffect>({
        ...base,
        id: `eu-rc-goods-${slug(state.country)}`,
        name: `${state.countryName}: intra-community B2B supply of goods to a VAT-registered buyer — exempt with credit`,
        when: [...base.when, where('supplyKind', ['goods'])],
        effect: {
          kind: 'reverse-charge', supplierCountry: state.country, supply: 'goods',
          basis: 'Directive 2006/112/EC Art. 138 (the supply is exempt with credit) and Arts 2 and 20 (the buyer accounts for acquisition VAT)',
          taxedBy: 'buyer',
          note: 'The goods must be transported out of the supplier\'s member state and the buyer\'s VAT number must be valid in another member state; the supplier\'s report keeps the evidence.',
        },
        validFrom: '1993-01-01',
      }),
    ];
  });
}

export function euReverseChargePack(): TaxRulePack {
  return { id: 'eu-reverse-charge', name: 'EU cross-border B2B reverse charge', rules: reverseChargeRules(), unmapped: [] };
}
