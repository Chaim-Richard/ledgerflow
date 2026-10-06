import type { ParsedBankLine } from './mt940Parser';
import { bankStatementDate } from './bankStatementDate';

export type QIFDateOrder = 'mdy' | 'dmy';

/** Bank/Cash/CCard QIF only. Dates are chosen explicitly; split categories never create postings. */
export function parseQIFStatement(content: string, dateOrder: QIFDateOrder): ParsedBankLine[] {
  const fail = (line: number, message: string): never => { throw new Error(`QIF line ${line}: ${message}`); };
  if (dateOrder !== 'mdy' && dateOrder !== 'dmy') fail(1, 'Choose month/day or day/month dates.');
  const lines = content.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  const result: ParsedBankLine[] = [];
  let header = false;
  let fields = new Map<string, { value: string; line: number }>();
  let start = 1;
  for (const [index, raw] of lines.entries()) {
    const line = index + 1;
    const text = raw.trim();
    if (!text) continue;
    if (text.startsWith('!')) {
      if (fields.size) fail(line, 'Missing ^ record terminator.');
      if (!/^!Type:(Bank|Cash|CCard)$/i.test(text)) fail(line, 'Only Bank, Cash and CCard statements are supported; export one account.');
      if (header) fail(line, 'Export one account per file.');
      header = true;
      continue;
    }
    if (!header) fail(line, 'Expected !Type:Bank, !Type:Cash or !Type:CCard.');
    if (text === '^') {
      const date = fields.get('D');
      const amount = fields.get('T') ?? fields.get('U');
      if (!date || !amount) fail(start, 'Each transaction needs a date (D) and amount (T or U).');
      const match = date!.value.match(/^(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*(?:[/.-]|')\s*(\d{2}|\d{4})$/);
      if (!match) fail(date!.line, 'Invalid date; use numeric month/day/year or day/month/year.');
      const yearRaw = Number(match![3]);
      const year = match![3].length === 2 ? (yearRaw < 70 ? 2000 : 1900) + yearRaw : yearRaw;
      const month = Number(match![dateOrder === 'mdy' ? 1 : 2]);
      const day = Number(match![dateOrder === 'mdy' ? 2 : 1]);
      const dateISO = bankStatementDate(year, month, day);
      if (!dateISO) fail(date!.line, 'Invalid calendar date for the selected date order.');
      const parseAmount = (field: { value: string; line: number }) => {
        if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(field.value)) fail(field.line, 'Amount must be a number with at most two decimal places.');
        const normalized = field.value.replace(/,/g, '');
        const [whole, fraction = ''] = normalized.replace(/^[+-]/, '').split('.');
        const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
        if (!Number.isSafeInteger(cents)) fail(field.line, 'Amount exceeds the supported whole-cent range.');
        return normalized.startsWith('-') ? -cents : cents;
      };
      const amountCents = parseAmount(amount!);
      const alternate = fields.get('U');
      if (fields.has('T') && alternate && parseAmount(alternate) !== amountCents) fail(alternate.line, 'T and U amounts disagree.');
      const description = [fields.get('P')?.value, fields.get('M')?.value].filter(Boolean).join(' - ') || 'QIF Entry';
      const reference = fields.get('N')?.value;
      result.push({ date: dateISO!, amountCents, description, ...(reference ? { reference } : {}), type: amountCents < 0 ? 'debit' : 'credit' });
      fields = new Map();
    } else {
      if (!fields.size) start = line;
      const key = text[0];
      // Split fields describe categories, not extra bank transactions. Ignore them and use T.
      if (!'DTUPMNCLSAE$'.includes(key)) fail(line, `Unsupported field ${key}.`);
      if ('DTUPMN'.includes(key)) {
        if (fields.has(key)) fail(line, `Duplicate ${key} field.`);
        fields.set(key, { value: text.slice(1).trim(), line });
      }
    }
  }
  if (fields.size) fail(start, 'Missing ^ record terminator.');
  if (!header || !result.length) fail(1, 'No bank transactions found.');
  return result;
}
