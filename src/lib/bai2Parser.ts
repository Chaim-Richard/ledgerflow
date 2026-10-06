import type { ParsedBankLine } from './mt940Parser';

interface RecordLine { text: string; line: number; count: number }

/** BAI2 v2, one account per file. Amounts are already minor units; 88 continues its parent. */
export function parseBAI2Statement(content: string, expectedCurrency?: string): ParsedBankLine[] {
  const fail = (line: number, message: string): never => { throw new Error(`BAI2 line ${line}: ${message}`); };
  const physical = content.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  const records: RecordLine[] = [];
  for (const [index, raw] of physical.entries()) {
    if (!raw.trim()) continue;
    if (!raw.trimEnd().endsWith('/')) fail(index + 1, 'Missing / record terminator.');
    for (const part of raw.trim().split(/\/(?=\s*\d{2},|\s*$)/).filter(s => s.trim())) {
      const text = part.trimStart();
      if (!/^\d{2},/.test(text)) fail(index + 1, 'Expected a two-digit record code.');
      if (text.startsWith('88,')) {
        const parent = records.at(-1);
        if (!parent || !/^(03|16),/.test(parent.text)) return fail(index + 1, '88 must continue an account summary or transaction.');
        parent.text += text.slice(3);
        parent.count++;
      } else records.push({ text, line: index + 1, count: 1 });
    }
  }
  const integer = (text: string | undefined, line: number, label: string): bigint => {
    if (!text || !/^-?\d+$/.test(text)) fail(line, `Invalid ${label}.`);
    return BigInt(text!);
  };
  const afterFunds = (fields: string[], index: number, line: number): number => {
    const type = fields[index] || '';
    if (['', '0', '1', '2'].includes(type)) return index + 1;
    if (type === 'S') {
      for (let i = 1; i <= 3; i++) integer(fields[index + i], line, 'distributed funds amount');
      return index + 4;
    }
    if (type === 'V') {
      if (!/^\d{6}$/.test(fields[index + 1] || '') || !/^(?:[01]\d|2[0-3])[0-5]\d$/.test(fields[index + 2] || '')) fail(line, 'Invalid value-dated funds date or time.');
      return index + 3;
    }
    if (type === 'D') {
      const count = integer(fields[index + 1], line, 'funds distribution count');
      if (count < 0n || count > 1000n) fail(line, 'Invalid funds distribution count.');
      for (let i = 0; i < Number(count); i++) {
        const days = integer(fields[index + 2 + i * 2], line, 'funds availability days');
        if (days < 0n) fail(line, 'Funds availability days must be nonnegative.');
        integer(fields[index + 3 + i * 2], line, 'funds distribution amount');
      }
      return index + 2 + Number(count) * 2;
    }
    return fail(line, 'Unsupported funds type; use 0, 1, 2, S, V or D.');
  };
  const result: ParsedBankLine[] = [];
  let state: 'file' | 'group' | 'account' | 'done' | 'start' = 'start';
  let date = '';
  let groupCurrency = '';
  let accountTotal = 0n;
  let groupTotal = 0n;
  let fileTotal = 0n;
  let accountRecords = 0;
  let groupRecords = 0;
  let fileRecords = 0;
  let groups = 0;
  let accounts = 0;
  let groupAccounts = 0;
  for (const record of records) {
    const { text, line, count } = record;
    const fields = text.split(',');
    const code = fields[0];
    fileRecords += count;
    if (state === 'group' || state === 'account') groupRecords += count;
    if (state === 'account') accountRecords += count;
    switch (code) {
      case '01':
        if (state !== 'start' || fields[8] !== '2') fail(line, 'Expected a BAI2 version 2 file header (01).');
        state = 'file';
        break;
      case '02': {
        if (state !== 'file') fail(line, 'Unexpected group header.');
        if (fields[3] !== '1') fail(line, 'Only update group status 1 is supported; export a complete statement.');
        const rawDate = fields[4];
        if (!/^\d{6}$/.test(rawDate ?? '')) fail(line, 'Expected a YYMMDD group date.');
        const yearRaw = Number(rawDate.slice(0, 2));
        const year = (yearRaw < 70 ? 2000 : 1900) + yearRaw;
        const month = Number(rawDate.slice(2, 4));
        const day = Number(rawDate.slice(4));
        const stamp = new Date(Date.UTC(year, month - 1, day));
        if (stamp.getUTCFullYear() !== year || stamp.getUTCMonth() !== month - 1 || stamp.getUTCDate() !== day) fail(line, 'Invalid group calendar date.');
        date = `${year}-${rawDate.slice(2, 4)}-${rawDate.slice(4)}`;
        groupCurrency = fields[6] || 'USD';
        groupRecords = count;
        groupAccounts = 0;
        groupTotal = 0n;
        groups++;
        state = 'group';
        break;
      }
      case '03': {
        if (state !== 'group' || !fields[1]) fail(line, 'Expected an account identifier inside a group.');
        if (++accounts > 1) fail(line, 'Export one account per file; accounts cannot be combined.');
        groupAccounts++;
        const currency = fields[2] || groupCurrency;
        if (expectedCurrency && currency !== expectedCurrency) fail(line, `Statement currency ${currency} differs from workspace currency ${expectedCurrency}; no exchange rate will be guessed.`);
        if (!/^[A-Z]{3}$/.test(currency)) fail(line, 'Invalid account currency.');
        try {
          if (new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits !== 2) fail(line, 'Only two-decimal statement currencies are supported.');
        } catch { fail(line, 'Unsupported account currency; use a two-decimal currency.'); }
        accountRecords = count;
        accountTotal = 0n;
        // Account balances and summary amounts participate in BAI control totals, but are not transactions.
        const summary = fields.slice(3);
        for (let i = 0; i < summary.length;) {
          if (i === summary.length - 1 && summary[i] === '') break;
          if (!/^\d{3}$/.test(summary[i])) fail(line, 'Invalid summary type code.');
          if (i + 1 >= summary.length) fail(line, 'Incomplete account summary (type and amount).');
          if (summary[i + 1]) accountTotal += integer(summary[i + 1], line, 'summary amount');
          if (summary[i + 2] && integer(summary[i + 2], line, 'summary item count') < 0n) fail(line, 'Summary item count must be nonnegative.');
          i = afterFunds(summary, i + 3, line);
        }
        state = 'account';
        break;
      }
      case '16': {
        if (state !== 'account') fail(line, 'Transaction outside an account.');
        const type = Number(fields[1]);
        // BAI detail credit types 100–399; debit types 400–699. Never infer direction from text.
        if (!/^\d{3}$/.test(fields[1] ?? '') || type < 100 || type >= 700) fail(line, 'Unsupported transaction type code.');
        const amount = integer(fields[2], line, 'transaction amount');
        if (amount < 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) fail(line, 'Transaction amount must be nonnegative whole minor units within the supported range.');
        accountTotal += amount;
        const referenceIndex = afterFunds(fields, 3, line);
        const reference = fields[referenceIndex + 1] || fields[referenceIndex];
        const description = fields.slice(referenceIndex + 2).join(',').trim() || `BAI2 Entry ${fields[1]}`;
        const credit = type < 400;
        result.push({ date, amountCents: Number(amount) * (credit ? 1 : -1), description, ...(reference ? { reference } : {}), type: credit ? 'credit' : 'debit' });
        break;
      }
      case '49':
        if (state !== 'account') fail(line, 'Unexpected account trailer.');
        if (integer(fields[1], line, 'account control total') !== accountTotal || integer(fields[2], line, 'account record count') !== BigInt(accountRecords)) fail(line, 'Account control total or record count does not match.');
        groupTotal += accountTotal;
        state = 'group';
        break;
      case '98':
        if (state !== 'group') fail(line, 'Unexpected group trailer.');
        if (integer(fields[1], line, 'group control total') !== groupTotal || integer(fields[2], line, 'account count') !== BigInt(groupAccounts) || integer(fields[3], line, 'group record count') !== BigInt(groupRecords)) fail(line, 'Group control total or record count does not match.');
        fileTotal += groupTotal;
        state = 'file';
        break;
      case '99':
        if (state !== 'file') fail(line, 'Unexpected file trailer.');
        if (integer(fields[1], line, 'file control total') !== fileTotal || integer(fields[2], line, 'group count') !== BigInt(groups) || integer(fields[3], line, 'file record count') !== BigInt(fileRecords)) fail(line, 'File control total or record count does not match.');
        state = 'done';
        break;
      default: fail(line, `Unsupported record code ${code}.`);
    }
  }
  if (state !== 'done') fail(physical.length, 'Incomplete file; expected account, group and file trailers.');
  if (!result.length) fail(1, 'No transaction detail records found.');
  return result;
}
