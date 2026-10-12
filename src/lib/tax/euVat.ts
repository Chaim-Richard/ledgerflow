/**
 * A-25 (PLAN §3 step 4): the European Union's VAT rates — 27 member states, dated rows with a source
 * per row (the member state's tax authority).
 *
 * What this is: the standard rate in force for a **domestic** sale in each member state, and the
 * reduced rates with what they apply to, so a product category can pick its rate. What it is not:
 * place-of-supply rules, OSS, reverse charge or intra-community zero-rating — those belong to the
 * engine. Every row is `status: 'calculation'`; the 2025–2026 changes are dated rows.
 */
import type { RateTable, TaxComponent } from './resolveLineTax';
import type { TaxPlace } from './profile';

export type EuVatKind = 'standard' | 'reduced' | 'zero';

export interface EuVatRow {
  /** ISO 3166-1 alpha-2 code (EL for Greece, as the EU uses it) */
  country: string;
  countryName: string;
  kind: EuVatKind;
  /** for a reduced row: what the rate applies to, in plain words */
  appliesTo?: string;
  rate: number;
  validFrom: string;
  validTo?: string;
  source: string;
  checked: string;
  note?: string;
}

const CHECKED = '2026-10-11';
const COM = 'https://taxation-customs.ec.europa.eu/taxation/vat/vat-rates_en';

/** Standard rates, then each country's reduced rates (with what they apply to). */
export const EU_VAT_RATES: EuVatRow[] = [
  { country: 'AT', countryName: 'Austria', kind: 'standard', rate: 0.2, validFrom: '2016-01-01', source: 'https://www.bmf.gv.at/', checked: CHECKED },
  { country: 'AT', countryName: 'Austria', kind: 'reduced', appliesTo: 'plants, culture, domestic fuel', rate: 0.13, validFrom: '2016-01-01', source: 'https://www.bmf.gv.at/', checked: CHECKED },
  { country: 'AT', countryName: 'Austria', kind: 'reduced', appliesTo: 'food, books, transport', rate: 0.1, validFrom: '2016-01-01', validTo: '2026-06-30', source: 'https://www.bmf.gv.at/', checked: CHECKED },
  { country: 'AT', countryName: 'Austria', kind: 'reduced', appliesTo: 'books, transport, other reduced goods', rate: 0.1, validFrom: '2026-07-01', source: 'https://www.bmf.gv.at/', checked: CHECKED },
  { country: 'AT', countryName: 'Austria', kind: 'reduced', appliesTo: 'food', rate: 0.05, validFrom: '2026-07-01', source: 'https://www.bmf.gv.at/', checked: CHECKED, note: 'food VAT cut to 5% on 1 Jul 2026' },

  { country: 'BE', countryName: 'Belgium', kind: 'standard', rate: 0.21, validFrom: '1996-01-01', source: 'https://finance.belgium.be/en/experts/vat', checked: CHECKED },
  { country: 'BE', countryName: 'Belgium', kind: 'reduced', appliesTo: 'hotels, catering, leisure', rate: 0.12, validFrom: '2026-03-01', source: 'https://finance.belgium.be/en/experts/vat', checked: CHECKED, note: 'moved from 6% to 12% on 1 Mar 2026' },
  { country: 'BE', countryName: 'Belgium', kind: 'reduced', appliesTo: 'hotels, catering, leisure', rate: 0.06, validFrom: '1996-01-01', validTo: '2026-02-28', source: 'https://finance.belgium.be/en/experts/vat', checked: CHECKED },
  { country: 'BE', countryName: 'Belgium', kind: 'reduced', appliesTo: 'food, water, medicines, books', rate: 0.06, validFrom: '1996-01-01', source: 'https://finance.belgium.be/en/experts/vat', checked: CHECKED },

  { country: 'BG', countryName: 'Bulgaria', kind: 'standard', rate: 0.2, validFrom: '1999-01-01', source: 'https://www.nra.bg/en/', checked: CHECKED },
  { country: 'BG', countryName: 'Bulgaria', kind: 'reduced', appliesTo: 'accommodation, some food', rate: 0.09, validFrom: '1999-01-01', source: 'https://www.nra.bg/en/', checked: CHECKED },

  { country: 'HR', countryName: 'Croatia', kind: 'standard', rate: 0.25, validFrom: '2013-07-01', source: 'https://www.porezna-uprava.hr/en', checked: CHECKED },
  { country: 'HR', countryName: 'Croatia', kind: 'reduced', appliesTo: 'food, newspapers, accommodation', rate: 0.13, validFrom: '2021-01-01', source: 'https://www.porezna-uprava.hr/en', checked: CHECKED },
  { country: 'HR', countryName: 'Croatia', kind: 'reduced', appliesTo: 'medicines, books, some food', rate: 0.05, validFrom: '2013-07-01', source: 'https://www.porezna-uprava.hr/en', checked: CHECKED },

  { country: 'CY', countryName: 'Cyprus', kind: 'standard', rate: 0.19, validFrom: '2014-01-13', source: 'https://www.mof.gov.cy/en', checked: CHECKED },
  { country: 'CY', countryName: 'Cyprus', kind: 'reduced', appliesTo: 'restaurants, accommodation', rate: 0.09, validFrom: '2014-01-13', source: 'https://www.mof.gov.cy/en', checked: CHECKED },
  { country: 'CY', countryName: 'Cyprus', kind: 'reduced', appliesTo: 'food, medicines, books', rate: 0.05, validFrom: '2014-01-13', source: 'https://www.mof.gov.cy/en', checked: CHECKED },

  { country: 'CZ', countryName: 'Czechia', kind: 'standard', rate: 0.21, validFrom: '2024-01-01', source: 'https://www.financnisprava.cz/en', checked: CHECKED, note: 'two reduced rates were merged into one 12% rate in 2024' },
  { country: 'CZ', countryName: 'Czechia', kind: 'reduced', appliesTo: 'food, books, medicines, accommodation', rate: 0.12, validFrom: '2024-01-01', source: 'https://www.financnisprava.cz/en', checked: CHECKED },
  { country: 'CZ', countryName: 'Czechia', kind: 'zero', appliesTo: 'prescription medicines (a 0% list)', rate: 0, validFrom: '2024-01-01', source: 'https://www.financnisprava.cz/en', checked: CHECKED },

  { country: 'DK', countryName: 'Denmark', kind: 'standard', rate: 0.25, validFrom: '1992-01-01', source: 'https://skat.dk/en-us', checked: CHECKED, note: 'the EU’s only single-rate country' },

  { country: 'EE', countryName: 'Estonia', kind: 'standard', rate: 0.24, validFrom: '2025-07-01', source: 'https://www.emta.ee/en', checked: CHECKED, note: '24% from 1 Jul 2025 (22% from 1 Jan 2024)' },
  { country: 'EE', countryName: 'Estonia', kind: 'standard', rate: 0.22, validFrom: '2024-01-01', validTo: '2025-06-30', source: 'https://www.emta.ee/en', checked: CHECKED },
  { country: 'EE', countryName: 'Estonia', kind: 'reduced', appliesTo: 'accommodation, books, medicines', rate: 0.13, validFrom: '2025-07-01', source: 'https://www.emta.ee/en', checked: CHECKED },
  { country: 'EE', countryName: 'Estonia', kind: 'reduced', appliesTo: 'other listed goods', rate: 0.09, validFrom: '2009-01-01', source: 'https://www.emta.ee/en', checked: CHECKED },

  { country: 'FI', countryName: 'Finland', kind: 'standard', rate: 0.255, validFrom: '2024-09-01', source: 'https://vero.fi/en', checked: CHECKED, note: '25.5% from 1 Sep 2024 (24% before)' },
  { country: 'FI', countryName: 'Finland', kind: 'reduced', appliesTo: 'food, restaurants, books, medicines', rate: 0.135, validFrom: '2026-01-01', source: 'https://vero.fi/en', checked: CHECKED, note: 'cut from 14% on 1 Jan 2026' },
  { country: 'FI', countryName: 'Finland', kind: 'reduced', appliesTo: 'transport, culture, accommodation', rate: 0.1, validFrom: '2024-09-01', source: 'https://vero.fi/en', checked: CHECKED },

  { country: 'FR', countryName: 'France', kind: 'standard', rate: 0.2, validFrom: '2014-01-01', source: 'https://www.impots.gouv.fr/', checked: CHECKED },
  { country: 'FR', countryName: 'France', kind: 'reduced', appliesTo: 'restaurants, transport, some renovations', rate: 0.1, validFrom: '2014-01-01', source: 'https://www.impots.gouv.fr/', checked: CHECKED },
  { country: 'FR', countryName: 'France', kind: 'reduced', appliesTo: 'food, books, energy', rate: 0.055, validFrom: '2014-01-01', source: 'https://www.impots.gouv.fr/', checked: CHECKED },
  { country: 'FR', countryName: 'France', kind: 'reduced', appliesTo: 'prescription medicines, newspapers', rate: 0.021, validFrom: '1986-01-01', source: 'https://www.impots.gouv.fr/', checked: CHECKED },

  { country: 'DE', countryName: 'Germany', kind: 'standard', rate: 0.19, validFrom: '2007-01-01', source: 'https://www.bundesfinanzministerium.de/EN', checked: CHECKED },
  { country: 'DE', countryName: 'Germany', kind: 'reduced', appliesTo: 'food, books, restaurants (7% from 2026)', rate: 0.07, validFrom: '2007-01-01', source: 'https://www.bundesfinanzministerium.de/EN', checked: CHECKED },

  { country: 'EL', countryName: 'Greece', kind: 'standard', rate: 0.24, validFrom: '2016-06-01', source: 'https://www.aade.gr/en', checked: CHECKED },
  { country: 'EL', countryName: 'Greece', kind: 'reduced', appliesTo: 'food, energy, hotels', rate: 0.13, validFrom: '2016-06-01', source: 'https://www.aade.gr/en', checked: CHECKED },
  { country: 'EL', countryName: 'Greece', kind: 'reduced', appliesTo: 'medicines, books, theatre', rate: 0.06, validFrom: '2016-06-01', source: 'https://www.aade.gr/en', checked: CHECKED, note: 'island reductions rolled over' },

  { country: 'HU', countryName: 'Hungary', kind: 'standard', rate: 0.27, validFrom: '2012-01-01', source: 'https://nav.gov.hu/en', checked: CHECKED, note: 'the highest standard rate in the world' },
  { country: 'HU', countryName: 'Hungary', kind: 'reduced', appliesTo: 'food, accommodation, outdoor events', rate: 0.18, validFrom: '2012-01-01', source: 'https://nav.gov.hu/en', checked: CHECKED },
  { country: 'HU', countryName: 'Hungary', kind: 'reduced', appliesTo: 'medicines, books, some food', rate: 0.05, validFrom: '2004-01-01', source: 'https://nav.gov.hu/en', checked: CHECKED },

  { country: 'IE', countryName: 'Ireland', kind: 'standard', rate: 0.23, validFrom: '2012-01-01', source: 'https://www.revenue.ie/en/vat/', checked: CHECKED },
  { country: 'IE', countryName: 'Ireland', kind: 'reduced', appliesTo: 'construction, energy, some food', rate: 0.135, validFrom: '2012-01-01', source: 'https://www.revenue.ie/en/vat/', checked: CHECKED },
  { country: 'IE', countryName: 'Ireland', kind: 'reduced', appliesTo: 'hospitality and restaurants', rate: 0.09, validFrom: '2026-07-01', source: 'https://www.revenue.ie/en/vat/', checked: CHECKED, note: 'cut to 9% on 1 Jul 2026' },
  { country: 'IE', countryName: 'Ireland', kind: 'reduced', appliesTo: 'livestock, some agricultural inputs', rate: 0.048, validFrom: '2011-01-01', source: 'https://www.revenue.ie/en/vat/', checked: CHECKED },

  { country: 'IT', countryName: 'Italy', kind: 'standard', rate: 0.22, validFrom: '2013-10-01', source: 'https://www.agenziaentrate.gov.it/portale/en', checked: CHECKED },
  { country: 'IT', countryName: 'Italy', kind: 'reduced', appliesTo: 'restaurants, hotels, some food', rate: 0.1, validFrom: '1997-01-01', source: 'https://www.agenziaentrate.gov.it/portale/en', checked: CHECKED },
  { country: 'IT', countryName: 'Italy', kind: 'reduced', appliesTo: 'some food, transport, social services', rate: 0.05, validFrom: '1997-01-01', source: 'https://www.agenziaentrate.gov.it/portale/en', checked: CHECKED },
  { country: 'IT', countryName: 'Italy', kind: 'reduced', appliesTo: 'books, newspapers, medicines', rate: 0.04, validFrom: '1997-01-01', source: 'https://www.agenziaentrate.gov.it/portale/en', checked: CHECKED },

  { country: 'LV', countryName: 'Latvia', kind: 'standard', rate: 0.21, validFrom: '2013-07-01', source: 'https://www.vid.gov.lv/en', checked: CHECKED },
  { country: 'LV', countryName: 'Latvia', kind: 'reduced', appliesTo: 'medicines, accommodation, some food', rate: 0.12, validFrom: '2013-07-01', source: 'https://www.vid.gov.lv/en', checked: CHECKED },
  { country: 'LV', countryName: 'Latvia', kind: 'reduced', appliesTo: 'books, some food, heating', rate: 0.05, validFrom: '2013-07-01', source: 'https://www.vid.gov.lv/en', checked: CHECKED },

  { country: 'LT', countryName: 'Lithuania', kind: 'standard', rate: 0.21, validFrom: '2009-09-01', source: 'https://www.vmi.lt/en', checked: CHECKED },
  { country: 'LT', countryName: 'Lithuania', kind: 'reduced', appliesTo: 'accommodation, culture, publications', rate: 0.12, validFrom: '2026-01-01', source: 'https://www.vmi.lt/en', checked: CHECKED, note: 'raised from 9% on 1 Jan 2026' },
  { country: 'LT', countryName: 'Lithuania', kind: 'reduced', appliesTo: 'medicines, some food', rate: 0.05, validFrom: '2010-01-01', source: 'https://www.vmi.lt/en', checked: CHECKED },

  { country: 'LU', countryName: 'Luxembourg', kind: 'standard', rate: 0.17, validFrom: '2015-01-01', source: 'https://pfi.public.lu/en.html', checked: CHECKED, note: 'the lowest standard rate in the EU' },
  { country: 'LU', countryName: 'Luxembourg', kind: 'reduced', appliesTo: 'food, books, medicines (a 14% list)', rate: 0.14, validFrom: '2015-01-01', source: 'https://pfi.public.lu/en.html', checked: CHECKED },
  { country: 'LU', countryName: 'Luxembourg', kind: 'reduced', appliesTo: 'books, some transport, agriculture', rate: 0.08, validFrom: '2015-01-01', source: 'https://pfi.public.lu/en.html', checked: CHECKED },

  { country: 'MT', countryName: 'Malta', kind: 'standard', rate: 0.18, validFrom: '2011-01-01', source: 'https://www.cfr.gov.mt/', checked: CHECKED },
  { country: 'MT', countryName: 'Malta', kind: 'reduced', appliesTo: 'accommodation, electricity', rate: 0.07, validFrom: '2011-01-01', source: 'https://www.cfr.gov.mt/', checked: CHECKED },
  { country: 'MT', countryName: 'Malta', kind: 'reduced', appliesTo: 'food, books, medicines', rate: 0.05, validFrom: '2011-01-01', source: 'https://www.cfr.gov.mt/', checked: CHECKED },

  { country: 'NL', countryName: 'Netherlands', kind: 'standard', rate: 0.21, validFrom: '2012-10-01', source: 'https://www.belastingdienst.nl/wps/wcm/connect/en/', checked: CHECKED, note: 'accommodation moved to the standard rate on 1 Jan 2026' },
  { country: 'NL', countryName: 'Netherlands', kind: 'reduced', appliesTo: 'food, medicines, books, transport', rate: 0.09, validFrom: '2019-01-01', source: 'https://www.belastingdienst.nl/wps/wcm/connect/en/', checked: CHECKED },

  { country: 'PL', countryName: 'Poland', kind: 'standard', rate: 0.23, validFrom: '2011-01-01', source: 'https://www.podatki.gov.pl/en', checked: CHECKED },
  { country: 'PL', countryName: 'Poland', kind: 'reduced', appliesTo: 'construction, accommodation, some food', rate: 0.08, validFrom: '2011-01-01', source: 'https://www.podatki.gov.pl/en', checked: CHECKED },
  { country: 'PL', countryName: 'Poland', kind: 'reduced', appliesTo: 'basic food, books, medicines', rate: 0.05, validFrom: '2011-01-01', source: 'https://www.podatki.gov.pl/en', checked: CHECKED },

  { country: 'PT', countryName: 'Portugal', kind: 'standard', rate: 0.23, validFrom: '2011-01-01', source: 'https://www.portaldasfinancas.gov.pt/', checked: CHECKED },
  { country: 'PT', countryName: 'Portugal', kind: 'reduced', appliesTo: 'food, restaurants, wine', rate: 0.13, validFrom: '2011-01-01', source: 'https://www.portaldasfinancas.gov.pt/', checked: CHECKED },
  { country: 'PT', countryName: 'Portugal', kind: 'reduced', appliesTo: 'basic food, books, medicines', rate: 0.06, validFrom: '2011-01-01', source: 'https://www.portaldasfinancas.gov.pt/', checked: CHECKED },

  { country: 'RO', countryName: 'Romania', kind: 'standard', rate: 0.21, validFrom: '2025-08-01', source: 'https://www.mfinante.gov.ro/', checked: CHECKED, note: '21% from Aug 2025 (19% before)' },
  { country: 'RO', countryName: 'Romania', kind: 'reduced', appliesTo: 'food, medicines, accommodation, books', rate: 0.11, validFrom: '2025-08-01', source: 'https://www.mfinante.gov.ro/', checked: CHECKED, note: 'the 5% and 9% lists were merged into 11% in Aug 2025' },

  { country: 'SK', countryName: 'Slovakia', kind: 'standard', rate: 0.23, validFrom: '2025-01-01', source: 'https://www.financnasprava.sk/en', checked: CHECKED, note: '23% from 1 Jan 2025 (20% before)' },
  { country: 'SK', countryName: 'Slovakia', kind: 'reduced', appliesTo: 'food, medicines, books, accommodation', rate: 0.19, validFrom: '2025-01-01', source: 'https://www.financnasprava.sk/en', checked: CHECKED },
  { country: 'SK', countryName: 'Slovakia', kind: 'reduced', appliesTo: 'basic food, some construction', rate: 0.05, validFrom: '2011-01-01', source: 'https://www.financnasprava.sk/en', checked: CHECKED },

  { country: 'SI', countryName: 'Slovenia', kind: 'standard', rate: 0.22, validFrom: '2013-07-01', source: 'https://www.fu.gov.si/en', checked: CHECKED },
  { country: 'SI', countryName: 'Slovenia', kind: 'reduced', appliesTo: 'food, construction, accommodation', rate: 0.095, validFrom: '2013-07-01', source: 'https://www.fu.gov.si/en', checked: CHECKED },
  { country: 'SI', countryName: 'Slovenia', kind: 'reduced', appliesTo: 'books, medicines, culture', rate: 0.05, validFrom: '2013-07-01', source: 'https://www.fu.gov.si/en', checked: CHECKED },

  { country: 'ES', countryName: 'Spain', kind: 'standard', rate: 0.21, validFrom: '2012-09-01', source: 'https://sede.agenciatributaria.gob.es/Sede/en_gb.html', checked: CHECKED },
  { country: 'ES', countryName: 'Spain', kind: 'reduced', appliesTo: 'food, restaurants, transport', rate: 0.1, validFrom: '2012-09-01', source: 'https://sede.agenciatributaria.gob.es/Sede/en_gb.html', checked: CHECKED, note: 'the temporary energy rate ended 1 Jul 2026' },
  { country: 'ES', countryName: 'Spain', kind: 'reduced', appliesTo: 'basic food, books, medicines', rate: 0.04, validFrom: '1995-01-01', source: 'https://sede.agenciatributaria.gob.es/Sede/en_gb.html', checked: CHECKED },

  { country: 'SE', countryName: 'Sweden', kind: 'standard', rate: 0.25, validFrom: '1990-07-01', source: 'https://www.skatteverket.se/servicelankar/otherlanguages/englishengelska.4.html', checked: CHECKED },
  { country: 'SE', countryName: 'Sweden', kind: 'reduced', appliesTo: 'food, restaurants, accommodation', rate: 0.12, validFrom: '1990-07-01', source: 'https://www.skatteverket.se/servicelankar/otherlanguages/englishengelska.4.html', checked: CHECKED },
  { country: 'SE', countryName: 'Sweden', kind: 'reduced', appliesTo: 'books, culture, transport', rate: 0.06, validFrom: '1996-01-01', source: 'https://www.skatteverket.se/servicelankar/otherlanguages/englishengelska.4.html', checked: CHECKED },
];

export const EU_VAT_COUNTRIES: string[] = [...new Set(EU_VAT_RATES.map(r => r.country))];

const inForce = (r: EuVatRow, date: string) => r.validFrom <= date && (!r.validTo || date <= r.validTo);

/** The standard VAT row for a country on a date. */
export function euVatStandardRow(country: string, date: string): EuVatRow | undefined {
  const code = country.toUpperCase();
  return EU_VAT_RATES.find(r => r.country === code && r.kind === 'standard' && inForce(r, date));
}

/** The standard rate for a country on a date, or undefined when the country is not in the table. */
export function euVatStandardRate(country: string, date: string): number | undefined {
  return euVatStandardRow(country, date)?.rate;
}

/** Every reduced (or zero) row for a country in force on a date — the rate a product category may take. */
export function euVatReducedRows(country: string, date: string): EuVatRow[] {
  const code = country.toUpperCase();
  return EU_VAT_RATES.filter(r => r.country === code && r.kind !== 'standard' && inForce(r, date));
}

/** The reduced row whose `appliesTo` names this category (a plain word match, nothing inferred). */
export function euVatReducedFor(country: string, category: string, date: string): EuVatRow | undefined {
  const word = category.trim().toLowerCase();
  return euVatReducedRows(country, date).find(r => (r.appliesTo || '').toLowerCase().split(/[,;]/).some(w => w.trim() === word || w.trim().includes(word)));
}

/** `RateTables['FR']` and so on: the standard rate for a domestic EU sale. */
export function euVatRateTable(rows: EuVatRow[] = EU_VAT_RATES): RateTable {
  return (place: TaxPlace, date: string): TaxComponent[] | undefined => {
    const code = (place.country || '').toUpperCase();
    const row = rows.find(r => r.country === code && r.kind === 'standard' && r.validFrom <= date && (!r.validTo || date <= r.validTo));
    if (!row) return undefined;
    return [{ level: 'country', name: `${row.countryName} VAT`, rate: row.rate }];
  };
}

/** The Commission page that lists the rates; a screen that shows a rate shows where it was read. */
export const EU_VAT_INDEX = COM;
