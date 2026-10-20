import { parseCsv } from './csv';
import { parseMoneyCents } from './recordImport';

/**
 * E-57: read-only comparison of a QuickBooks Trial Balance CSV with the full-history
 * LedgerFlow server trial balance. No browser-cache fallback and no posting.
 * This does not replace AU-4's server-side, one-snapshot migration verification.
 */
export interface SourceTrialBalance {
  accounts: Array<{ name: string; debitCents: number; creditCents: number }>;
  totalDebitCents: number;
  totalCreditCents: number;
}

export interface ServerTrialBalanceAccount {
  id: string;
  name: string;
  debit: number;
  credit: number;
}

export interface ServerTrialBalanceSnapshot {
  accounts: ServerTrialBalanceAccount[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface TrialBalanceDifference {
  account: string;
  sourceCents: number;
  ledgerCents: number;
  differenceCents: number;
  problem: 'difference' | 'missing-in-ledger' | 'extra-in-ledger' | 'ambiguous-name';
}

const keyOf = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
const safeCents = (n: number): boolean => Number.isSafeInteger(n) && Math.abs(n) <= 900_000_000_000_000;
const addSafe = (a: number, b: number): number => {
  const result = a + b;
  if (!safeCents(result)) throw new Error('Trial balance totals exceed safe integer cents.');
  return result;
};

function readAmount(raw: string, row: number, field: string): number {
  if (!raw.trim()) return 0;
  const cents = parseMoneyCents(raw);
  if (cents === null || !safeCents(cents) || cents < 0) {
    throw new Error(`Row ${row}: ${field} must be a nonnegative amount with at most two decimals.`);
  }
  return cents;
}

export function parseQuickBooksTrialBalance(text: string): SourceTrialBalance {
  if (text.length > 2_000_000) throw new Error('Trial balance file exceeds 2 MB.');
  const table = parseCsv(text);
  const header = table.findIndex(row => {
    const cells = row.map(keyOf);
    return cells.includes('account') && cells.includes('debit') && cells.includes('credit');
  });
  if (header < 0 || header > 12) {
    throw new Error('Expected QuickBooks Trial Balance columns: Account, Debit, Credit.');
  }
  const fields = table[header].map(keyOf);
  const accountCol = fields.indexOf('account');
  const debitCol = fields.indexOf('debit');
  const creditCol = fields.indexOf('credit');
  const seen = new Set<string>();
  const accounts: SourceTrialBalance['accounts'] = [];
  let totalDebitCents = 0;
  let totalCreditCents = 0;
  let declaredTotals: { debit: number; credit: number } | undefined;

  for (let i = header + 1; i < table.length; i++) {
    const row = table[i];
    const name = String(row[accountCol] ?? '').trim();
    if (!name && row.every(cell => !cell.trim())) continue;
    if (!name) throw new Error(`Row ${i + 1}: account name is missing.`);
    const debit = readAmount(row[debitCol] ?? '', i + 1, 'Debit');
    const credit = readAmount(row[creditCol] ?? '', i + 1, 'Credit');
    if (keyOf(name) === 'total' || keyOf(name) === 'total for all accounts') {
      if (declaredTotals || i !== table.length - 1) {
        throw new Error('Only one final total row is supported.');
      }
      declaredTotals = { debit, credit };
      continue;
    }
    if (debit && credit) throw new Error(`Row ${i + 1}: one account cannot have both debit and credit balances.`);
    const key = keyOf(name);
    if (seen.has(key)) throw new Error(`Row ${i + 1}: duplicate account ${name}; use a unique account name or export format.`);
    seen.add(key);
    totalDebitCents = addSafe(totalDebitCents, debit);
    totalCreditCents = addSafe(totalCreditCents, credit);
    accounts.push({ name, debitCents: debit, creditCents: credit });
  }
  if (!accounts.length) throw new Error('The Trial Balance file has no accounts.');
  if (declaredTotals && (declaredTotals.debit !== totalDebitCents || declaredTotals.credit !== totalCreditCents)) {
    throw new Error('QuickBooks total row does not match its account rows.');
  }
  return { accounts, totalDebitCents, totalCreditCents };
}

export function compareTrialBalances(source: SourceTrialBalance, server: ServerTrialBalanceSnapshot) {
  if (!server || !Array.isArray(server.accounts) ||
      !safeCents(server.totalDebit) || !safeCents(server.totalCredit) ||
      typeof server.isBalanced !== 'boolean') {
    throw new Error('Server trial balance is unavailable or invalid.');
  }
  const ledgerByName = new Map<string, { name: string; net: number; repeated: boolean }>();
  let rawDebit = 0;
  let rawCredit = 0;
  let ledgerDebitCents = 0;
  let ledgerCreditCents = 0;
  for (const acc of server.accounts) {
    if (!acc || typeof acc.name !== 'string' || !acc.name.trim() ||
        !safeCents(acc.debit) || !safeCents(acc.credit) || acc.debit < 0 || acc.credit < 0) {
      throw new Error('Server returned an invalid account balance.');
    }
    rawDebit = addSafe(rawDebit, acc.debit);
    rawCredit = addSafe(rawCredit, acc.credit);
    const net = addSafe(acc.debit, -acc.credit);
    ledgerDebitCents = addSafe(ledgerDebitCents, Math.max(0, net));
    ledgerCreditCents = addSafe(ledgerCreditCents, Math.max(0, -net));
    const key = keyOf(acc.name);
    const old = ledgerByName.get(key);
    ledgerByName.set(key, {
      name: acc.name, net: old ? addSafe(old.net, net) : net, repeated: Boolean(old),
    });
  }
  // Do not silently accept a partial, malformed or internally inconsistent response.
  if (rawDebit !== server.totalDebit || rawCredit !== server.totalCredit ||
      server.isBalanced !== (rawDebit === rawCredit)) {
    throw new Error('Server trial balance does not reconcile to its account rows.');
  }

  const differences: TrialBalanceDifference[] = [];
  const sourceNames = new Set<string>();
  for (const acc of source.accounts) {
    const key = keyOf(acc.name);
    sourceNames.add(key);
    const found = ledgerByName.get(key);
    const expected = acc.debitCents - acc.creditCents;
    if (!found) {
      differences.push({ account: acc.name, sourceCents: expected, ledgerCents: 0, differenceCents: -expected, problem: 'missing-in-ledger' });
    } else if (found.repeated) {
      differences.push({ account: acc.name, sourceCents: expected, ledgerCents: found.net, differenceCents: found.net - expected, problem: 'ambiguous-name' });
    } else if (found.net !== expected) {
      differences.push({ account: acc.name, sourceCents: expected, ledgerCents: found.net, differenceCents: found.net - expected, problem: 'difference' });
    }
  }
  for (const [key, account] of ledgerByName) {
    if (!sourceNames.has(key) && account.net !== 0) {
      differences.push({ account: account.name, sourceCents: 0, ledgerCents: account.net, differenceCents: account.net, problem: 'extra-in-ledger' });
    }
  }
  // Even an entirely matching trial balance does NOT establish A/R, A/P, cash or tax
  // payable document-level correctness. AU-4 must supply consistent certified figures.
  return {
    sourceDebitCents: source.totalDebitCents,
    sourceCreditCents: source.totalCreditCents,
    ledgerDebitCents,
    ledgerCreditCents,
    debitDifferenceCents: ledgerDebitCents - source.totalDebitCents,
    creditDifferenceCents: ledgerCreditCents - source.totalCreditCents,
    differences,
    accountsMatch: differences.length === 0 &&
      ledgerDebitCents === source.totalDebitCents &&
      ledgerCreditCents === source.totalCreditCents,
    financialMigrationVerified: false as const,
  };
}
