export interface AccountRegisterEntry {
  id: string;
  date: string;
  reference?: string;
  payee?: string;
  description: string;
  accountId: string;
  amountMinor: number;
  debitMinor: number;
  creditMinor: number;
  isCleared?: boolean;
}

export interface RegisterCalculationResult {
  endingBalanceMinor: number;
  runningNewestFirst: number[];
}

/**
 * Calculates running balances newest-first while staying mathematically exact
 * when the transaction list is paginated or truncated.
 * 
 * Anchors on endingBalanceMinor = calculationStartMinor + totalActivityMinor,
 * and steps backwards through the newest-first amounts.
 */
export function calculateAccountRegisterBalances(
  calculationStartMinor: number,
  totalActivityMinor: number,
  newestAmountsMinor: number[]
): RegisterCalculationResult {
  if (!Number.isSafeInteger(calculationStartMinor)) {
    throw new TypeError('calculationStartMinor must be a safe integer');
  }
  if (!Number.isSafeInteger(totalActivityMinor)) {
    throw new TypeError('totalActivityMinor must be a safe integer');
  }

  const endingBalanceMinor = calculationStartMinor + totalActivityMinor;
  if (!Number.isSafeInteger(endingBalanceMinor)) {
    throw new RangeError('Ending balance exceeded safe integer range');
  }

  const runningNewestFirst: number[] = new Array(newestAmountsMinor.length);
  let currentRunning = endingBalanceMinor;

  for (let i = 0; i < newestAmountsMinor.length; i++) {
    const amt = newestAmountsMinor[i];
    if (!Number.isSafeInteger(amt)) {
      throw new TypeError(`Amount at index ${i} must be a safe integer`);
    }
    runningNewestFirst[i] = currentRunning;
    currentRunning = currentRunning - amt;
    if (!Number.isSafeInteger(currentRunning)) {
      throw new RangeError(`Running balance calculation at index ${i} exceeded safe integer range`);
    }
  }

  return {
    endingBalanceMinor,
    runningNewestFirst
  };
}

/**
 * Filters visible entries for checkbook reconciliation.
 */
export function visibleAccountRegisterEntries<T extends { isCleared?: boolean }>(
  entries: T[],
  unclearedOnly: boolean
): T[] {
  if (!unclearedOnly) return entries;
  return entries.filter(e => e.isCleared !== true);
}
