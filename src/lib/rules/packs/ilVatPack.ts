/**
 * A-38: Israel's VAT (A-29) written as rules. The standard rows are dated accumulate rules; Eilat's
 * free-trade zone is an **override** that targets every standard rule, which is what the graph is
 * for: the zero area replaces the 18% for a line in Eilat, and the outcome says both (applied and
 * displaced), so the evidence trail shows why the line is 0.
 */
import { IL_VAT_SPECIAL_AREAS, ilVatAreaNames } from '../../tax/ilVat';
import { IL_VAT_STANDARD } from '../../tax/ilVatRates';
import { rateRule, where, slug, type TaxRulePack } from './shared';

export function ilVatPack(): TaxRulePack {
  const standardIds = IL_VAT_STANDARD.map(r => `il-vat-${slug(r.validFrom)}`);
  const standard = IL_VAT_STANDARD.map((row, i) => rateRule({
    id: standardIds[i],
    name: `Israel standard VAT ${(row.rate * 100).toFixed(0)}%`,
    when: [where('country', ['IL'])],
    effect: { kind: 'rate', level: 'country', name: 'VAT (מע"מ)', rate: row.rate },
    validFrom: row.validFrom,
    ...(row.validTo ? { validTo: row.validTo } : {}),
    source: { authority: 'Israel Tax Authority', url: row.source, retrieved: '2026-10-11' },
  }));
  const areas = IL_VAT_SPECIAL_AREAS.filter(row => row.treatment === 'zero').map(row => rateRule({
    id: `il-vat-area-${slug(row.area)}`,
    name: `${row.area} is outside the ordinary VAT`,
    // A-99: every spelling the row recognises, so the graph answers for the book the rate table answers for.
    when: [where('country', ['IL']), where('district', ilVatAreaNames(row))],
    effect: { kind: 'rate', level: 'district', name: `VAT — ${row.nameHebrew}`, rate: row.rate },
    combine: 'override',
    targets: standardIds,
    validFrom: row.validFrom,
    ...(row.validTo ? { validTo: row.validTo } : {}),
    source: { authority: row.sourceAuthority || 'Israel Tax Authority', url: row.source, retrieved: row.checked },
  }));
  return { id: 'il-vat', name: 'Israel VAT and its special areas', rules: [...standard, ...areas], unmapped: [] };
}
