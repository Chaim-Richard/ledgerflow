/**
 * Tax code suggestions that learn (PLAN §6, point 5). From the documents already saved, LedgerFlow
 * suggests the tax code a new one most likely needs: what the same customer (or vendor), item and
 * entity got before, falling back to fewer of them. A correction is simply the next document: what
 * the person changed it to counts from then on, and recent documents count more. It also flags a
 * document whose tax code differs from what the same customer, item and entity usually get. Never
 * applied silently: the screens show the suggestion and the person accepts it. Pure.
 */
export interface TaxHistoryRow {
  date: string;
  taxCodeId?: string;
  /** customer or vendor id */
  contactId?: string;
  itemId?: string;
  /** the entity label value (World / Entity), when the books use one */
  entity?: string;
}

export interface TaxSuggestion {
  taxCodeId: string;
  /** share of the matching documents with this code, 0 to 1 (weighted by how recent) */
  share: number;
  /** how many documents it is based on */
  basedOn: number;
  /** which match was used: the most specific one with history */
  match: 'contact+item+entity' | 'contact+item' | 'contact' | 'item' | 'entity';
}

type MatchKey = 'contactId' | 'itemId' | 'entity';
const LEVELS: Array<[TaxSuggestion['match'], MatchKey[]]> = [
  ['contact+item+entity', ['contactId', 'itemId', 'entity']],
  ['contact+item', ['contactId', 'itemId']],
  ['contact', ['contactId']],
  ['item', ['itemId']],
  ['entity', ['entity']],
];

/** A document's weight by age: 1 today, a half after `halfLifeDays`. */
const weight = (date: string, today: string, halfLifeDays: number) => {
  const days = Math.max(0, (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
  return Number.isFinite(days) ? 0.5 ** (days / halfLifeDays) : 0;
};

export function suggestTaxCode(history: TaxHistoryRow[], query: Partial<Pick<TaxHistoryRow, MatchKey>>, today: string, halfLifeDays = 180): TaxSuggestion | null {
  for (const [match, keys] of LEVELS) {
    if (keys.some(k => !query[k])) continue;
    const rows = history.filter(r => r.taxCodeId && r.date <= today && keys.every(k => r[k] === query[k]));
    if (!rows.length) continue;
    const scores = new Map<string, number>();
    let total = 0;
    for (const r of rows) {
      const w = weight(r.date, today, halfLifeDays);
      scores.set(r.taxCodeId!, (scores.get(r.taxCodeId!) || 0) + w);
      total += w;
    }
    const [taxCodeId, score] = [...scores].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    return { taxCodeId, share: total > 0 ? Math.round((score / total) * 100) / 100 : 0, basedOn: rows.length, match };
  }
  return null;
}

/**
 * Whether a document's tax code is unusual: the same customer, item and entity got another code in
 * at least `minShare` of at least `minCount` earlier documents.
 */
export function unusualTaxCode(history: TaxHistoryRow[], row: TaxHistoryRow, minCount = 3, minShare = 0.8): TaxSuggestion | null {
  const earlier = history.filter(r => r.date < row.date || (r.date === row.date && r !== row));
  const usual = suggestTaxCode(earlier, row, row.date);
  if (!usual || usual.basedOn < minCount || usual.share < minShare || usual.taxCodeId === row.taxCodeId) return null;
  return usual;
}
