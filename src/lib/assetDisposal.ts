/**
 * Selling or scrapping a fixed asset (X-03). One ledger entry on the disposal date:
 * - depreciation still due through the disposal month (what src/lib/depreciationEngine.ts says is
 *   due, minus what was posted): DR depreciation expense, CR accumulated depreciation;
 * - the asset leaves the books: DR accumulated depreciation (all of it), CR the asset account (its cost);
 * - the money received, if any: DR the account it went to;
 * - the difference is the gain (CR) or loss (DR) on the chosen account:
 *   proceeds + accumulated depreciation − cost.
 * Lines on the same account are added together. Positive cents are debits, negative credits.
 */
export interface DisposalAccounts {
  asset: { id: string; name: string };
  accumulated: { id: string; name: string };
  expense?: { id: string; name: string };
  gainLoss?: { id: string; name: string };
  proceeds?: { id: string; name: string };
}

export interface DisposalInput {
  costCents: number;
  /** Depreciation already posted. */
  postedDepreciationCents: number;
  /** Depreciation still due through the disposal month (0 when up to date). */
  catchUpCents: number;
  proceedsCents: number;
}

export interface DisposalLine { accountId: string; accountName: string; amountCents: number }

/** Proceeds plus all depreciation minus cost: positive is a gain, negative a loss. */
export function disposalGainLoss(input: DisposalInput): number {
  return input.proceedsCents + input.postedDepreciationCents + input.catchUpCents - input.costCents;
}

/** What is missing or wrong, or null. */
export function disposalProblem(input: DisposalInput, accounts: Partial<DisposalAccounts>): string | null {
  if (!Number.isSafeInteger(input.proceedsCents) || input.proceedsCents < 0) return 'The amount received must be zero or more';
  if (!accounts.asset) return 'Choose the account the asset is in (for example Equipment)';
  if (!accounts.accumulated && input.postedDepreciationCents + input.catchUpCents > 0) return 'Choose the accumulated depreciation account';
  if (input.catchUpCents > 0 && !accounts.expense) return 'Choose the depreciation expense account';
  if (input.proceedsCents > 0 && !accounts.proceeds) return 'Choose the account the money went to';
  if (disposalGainLoss(input) !== 0 && !accounts.gainLoss) return 'Choose the account for the gain or loss on disposal';
  return null;
}

export function disposalLines(input: DisposalInput, accounts: DisposalAccounts): DisposalLine[] {
  const totals = new Map<string, DisposalLine>();
  const add = (account: { id: string; name: string } | undefined, cents: number) => {
    if (!account || !cents) return;
    const row = totals.get(account.id) || { accountId: account.id, accountName: account.name, amountCents: 0 };
    row.amountCents += cents;
    totals.set(account.id, row);
  };
  add(accounts.expense, input.catchUpCents);
  add(accounts.accumulated, -input.catchUpCents);
  add(accounts.accumulated, input.postedDepreciationCents + input.catchUpCents);
  add(accounts.proceeds, input.proceedsCents);
  add(accounts.asset, -input.costCents);
  add(accounts.gainLoss, -disposalGainLoss(input));
  return [...totals.values()].filter(l => l.amountCents !== 0);
}
