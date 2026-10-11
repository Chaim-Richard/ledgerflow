/**
 * E-11: five read-only adapters for official state/local sales-tax rate tables.
 * Input tables are already parsed from CSV/XLSX or manually checked publications.
 * Rows preserve source URL, effective date and rate provenance, and DO NOT feed
 * the posting/tax lookup engine until address-level jurisdiction selection is verified.
 */
import { validCustomReportPeriod } from '../reportCustomPeriod';
export type LocalRateState = 'TX' | 'CA' | 'NY' | 'WA' | 'CO';
export interface StateLocalRateRow {
  state: LocalRateState;
  jurisdiction: string;
  rate: number; // fraction of price: 8.25% is 0.0825
  validFrom: string;
  source: string;
  basis: 'combined' | 'component';
  code?: string;
  zip?: string;
  zip4Low?: string;
  zip4High?: string;
}
export interface LocalRateImport {
  rows: StateLocalRateRow[];
  issues: Array<{ row: number; reason: string }>;
  readyForTaxCalculation: false;
}
const SOURCES: Record<LocalRateState, string> = {
  TX:'https://comptroller.texas.gov/taxes/sales/city.php',
  CA:'https://cdtfa.ca.gov/taxes-and-fees/sales-use-tax-rates.htm',
  NY:'https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_tax_rate_publications.htm',
  WA:'https://dor.wa.gov/taxes-rates/sales-use-tax-rates/downloadable-database',
  CO:'https://tax.colorado.gov/DR1002',
};
const header = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const val = (cols: readonly string[], cells: readonly string[], ...names: string[]) => {
  const idx=cols.findIndex(c=>names.map(header).includes(header(c)));
  return idx<0 ? '' : String(cells[idx] ?? '').trim();
};
export function parseRateFraction(raw: string, mode: 'decimal' | 'percentage' | 'auto'): number {
  let text=raw.trim().replace(/,/g,'');
  const fraction: Record<string,string> = { '¼':'.25', '½':'.5', '¾':'.75' };
  text=text.replace(/[¼½¾]/g,c=>fraction[c]);
  const pct=text.endsWith('%');
  if(pct) text=text.slice(0,-1);
  if(!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) throw new Error('Rate is not numeric.');
  const value=Number(text);
  const rate=(pct||mode==='percentage')?value/100:mode==='decimal'?value:value>1?value/100:value;
  if(!Number.isFinite(rate)||rate<0||rate>0.2) throw new Error('Rate exceeds 0–20% validation range.');
  return Number(rate.toFixed(8));
}
export function parseStateLocalRateRows(state:LocalRateState, table:readonly (readonly string[])[], validFrom:string): LocalRateImport {
  if(!validCustomReportPeriod({startDate:validFrom,endDate:validFrom})) throw new Error('Supply a valid effective date from the source publication.');
  if(!SOURCES[state]) throw new Error('Unsupported state source.');
  if(table.length===0) throw new Error('Missing column headings.');
  const [cols,...data]=table;
  const rows:StateLocalRateRow[]=[],issues:LocalRateImport['issues']=[];
  for(let i=0;i<data.length;i++){
    const cells=data[i];
    if(cells.every(cell=>!String(cell||'').trim())) continue;
    try{
      let jurisdiction='',raw='',basis:StateLocalRateRow['basis']='combined',code='',zip='',zip4Low='',zip4High='';
      switch(state){
        case 'TX':
          jurisdiction=val(cols,cells,'Name','City County Name');
          code=val(cols,cells,'Local Code');
          raw=val(cols,cells,'Total Rate') || val(cols,cells,'Local Rate');
          basis=val(cols,cells,'Total Rate')?'combined':'component';
          break;
        case 'CA':
          jurisdiction=val(cols,cells,'Location','City','City County');
          raw=val(cols,cells,'Rate','Tax Rate','Total Rate');
          code=val(cols,cells,'Type');
          break;
        case 'NY':
          jurisdiction=val(cols,cells,'County or other locality','Jurisdiction','Taxing Jurisdiction');
          raw=val(cols,cells,'Tax rate %','Tax Rate','Rate');
          code=val(cols,cells,'Reporting code','Code');
          break;
        case 'WA':
          jurisdiction=val(cols,cells,'Location','Jurisdiction','City','Location Name') || 'ZIP region';
          zip=val(cols,cells,'ZIP','ZIP Code','ZIP5');
          zip4Low=val(cols,cells,'ZIP+4 Low','Zip4Low','Low','Plus4 Low');
          zip4High=val(cols,cells,'ZIP+4 High','Zip4High','High','Plus4 High');
          code=val(cols,cells,'Location Code','Location ID');
          raw=val(cols,cells,'Rate','Combined Rate','Total Rate');
          if(!/^\d{5}$/.test(zip)) throw new Error('Washington entry must include a five-digit ZIP.');
          if((zip4Low||zip4High)&&(!/^\d{4}$/.test(zip4Low)||!/^\d{4}$/.test(zip4High)||zip4Low>zip4High)) throw new Error('Invalid ZIP+4 range.');
          break;
        case 'CO':
          jurisdiction=val(cols,cells,'Location','Taxing Jurisdiction','City County','Jurisdiction');
          raw=val(cols,cells,'Sales Tax Rate','Sales Rate','Tax Rate','Rate');
          code=val(cols,cells,'Location Code','Code');
          basis='component'; // DR 1002 often lists each level separately.
          break;
      }
      if(!jurisdiction||!raw) throw new Error('Missing jurisdiction or rate.');
      const rate=parseRateFraction(raw,state==='TX'?'decimal':state==='CA'||state==='NY'||state==='CO'?'percentage':'auto');
      rows.push({state,jurisdiction,rate,validFrom,source:SOURCES[state],basis,
        ...(code?{code}:{}),...(zip?{zip}:{}),...(zip4Low?{zip4Low,zip4High}:{})});
    }catch(error){issues.push({row:i+2,reason:error instanceof Error?error.message:String(error)});}
  }
  return {rows,issues,readyForTaxCalculation:false};
}
export const parseTexasLocalRates=(table:readonly (readonly string[])[],validFrom:string)=>parseStateLocalRateRows('TX',table,validFrom);
export const parseCaliforniaLocalRates=(table:readonly (readonly string[])[],validFrom:string)=>parseStateLocalRateRows('CA',table,validFrom);
export const parseNewYorkLocalRates=(table:readonly (readonly string[])[],validFrom:string)=>parseStateLocalRateRows('NY',table,validFrom);
export const parseWashingtonLocalRates=(table:readonly (readonly string[])[],validFrom:string)=>parseStateLocalRateRows('WA',table,validFrom);
export const parseColoradoLocalRates=(table:readonly (readonly string[])[],validFrom:string)=>parseStateLocalRateRows('CO',table,validFrom);
