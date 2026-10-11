/**
 * An employee's deductions (U-05 benefits and deductions, U-06 garnishments), each pay period:
 * - pre-tax (401(k), health, HSA): taken from gross pay before income tax is worked out;
 * - after-tax (Roth 401(k), union dues, after-tax insurance): taken from what is left after taxes;
 * - garnishments (court or agency orders: child support, a levy): taken after taxes and before the
 *   after-tax deductions, never more than the order's share of disposable earnings (gross pay less
 *   the taxes withheld; 25% unless the order says otherwise, at most 65%).
 * Each is a fixed amount a period or a percent (of gross pay; for a garnishment, of disposable
 * earnings). Nothing ever takes pay below zero: a deduction that does not fit is cut to what is left.
 * Every deduction is owed to someone else, so the pay run credits it to payroll liabilities and the
 * entry still balances (src/lib/payRunPosting.ts).
 */
export type DeductionKind = 'pre_tax' | 'post_tax' | 'garnishment';

export interface EmployeeDeduction {
  id: string;
  name: string;
  kind: DeductionKind;
  /** a fixed amount each pay period … */
  amountCents?: number;
  /** … or a percent (of gross pay; for a garnishment, of disposable earnings) */
  percent?: number;
  /** garnishments: the most the order allows, as a percent of disposable earnings (default 25) */
  maxPercent?: number;
}

export interface DeductionLine { id: string; name: string; kind: DeductionKind; cents: number; requestedCents: number }

export const KIND_LABEL: Record<DeductionKind, string> = { pre_tax: 'Pre-tax', post_tax: 'After-tax', garnishment: 'Garnishment' };
export const DEFAULT_GARNISHMENT_PERCENT = 25;
export const MAX_GARNISHMENT_PERCENT = 65;

const twoDecimals = (n: number) => Math.round(n * 100) / 100 === n;

/** Why a deduction cannot be saved, or null. */
export function deductionProblem(d: Partial<EmployeeDeduction>): string | null {
  const name = String(d.name || '').trim();
  if (!name) return 'Name the deduction';
  if (name.length > 60) return 'Keep the name to 60 characters';
  if (!d.kind || !(d.kind in KIND_LABEL)) return 'Choose pre-tax, after-tax or garnishment';
  const hasAmount = d.amountCents !== undefined;
  const hasPercent = d.percent !== undefined;
  if (hasAmount === hasPercent) return 'Enter either an amount a pay period or a percent';
  if (hasAmount && (!Number.isSafeInteger(d.amountCents) || (d.amountCents as number) <= 0)) return 'The amount must be more than zero';
  if (hasPercent && (!Number.isFinite(d.percent) || (d.percent as number) <= 0 || (d.percent as number) > 100 || !twoDecimals(d.percent as number))) return 'The percent must be more than 0 and at most 100, with two decimals at most';
  if (d.maxPercent !== undefined) {
    if (d.kind !== 'garnishment') return 'Only a garnishment has a limit';
    if (!Number.isFinite(d.maxPercent) || d.maxPercent <= 0 || d.maxPercent > MAX_GARNISHMENT_PERCENT || !twoDecimals(d.maxPercent)) return `The limit is more than 0% and at most ${MAX_GARNISHMENT_PERCENT}% of disposable earnings`;
  }
  return null;
}

const requested = (d: EmployeeDeduction, baseCents: number) =>
  d.amountCents !== undefined ? Math.max(0, d.amountCents) : Math.round(baseCents * Math.max(0, d.percent || 0) / 100);

/** The pre-tax deductions taken from a period's gross pay (each cut to what is left of it). */
export function preTaxLines(deductions: EmployeeDeduction[], grossCents: number, alreadyCents = 0): DeductionLine[] {
  let left = Math.max(0, grossCents - alreadyCents);
  return deductions.filter(d => d.kind === 'pre_tax').map(d => {
    const want = requested(d, grossCents);
    const cents = Math.min(want, left);
    left -= cents;
    return { id: d.id, name: d.name, kind: d.kind, cents, requestedCents: want };
  });
}

/**
 * Garnishments, then after-tax deductions, from what is left after pre-tax deductions and taxes.
 * `disposableCents` is gross pay less the taxes withheld.
 */
export function afterTaxLines(deductions: EmployeeDeduction[], leftCents: number, grossCents: number, disposableCents: number): DeductionLine[] {
  let left = Math.max(0, leftCents);
  let garnished = 0;
  const lines: DeductionLine[] = [];
  for (const d of deductions.filter(x => x.kind === 'garnishment')) {
    const want = requested(d, disposableCents);
    const room = Math.max(0, Math.floor(disposableCents * (d.maxPercent ?? DEFAULT_GARNISHMENT_PERCENT) / 100) - garnished);
    const cents = Math.min(want, room, left);
    garnished += cents;
    left -= cents;
    lines.push({ id: d.id, name: d.name, kind: d.kind, cents, requestedCents: want });
  }
  for (const d of deductions.filter(x => x.kind === 'post_tax')) {
    const want = requested(d, grossCents);
    const cents = Math.min(want, left);
    left -= cents;
    lines.push({ id: d.id, name: d.name, kind: d.kind, cents, requestedCents: want });
  }
  return lines;
}
