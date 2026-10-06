/**
 * Loan amortisation (A-2, K-30, AI #3): the schedule behind a loan — every monthly payment split
 * into interest and principal, exactly to the cent, with the last payment taking the remainder so
 * the principal is repaid to the cent and the closing balance is exactly zero.
 *
 * Pure money maths, whole cents, no React and no database. The rate is a fraction of a year
 * (0.065 = 6.5% a year), interest is charged monthly on the balance still owed and rounded to the
 * cent (half up, the usual bank rounding), and the level payment is the annuity payment rounded up
 * so the loan can actually be repaid inside its term. Nothing here posts anything; the entries are
 * built in `src/lib/loans.ts` from these installments.
 */
import Decimal from 'decimal.js';
import { addToDateISO } from './utils';

export interface LoanScheduleInput {
  /** the money borrowed, whole cents */
  principalCents: number;
  /** a fraction of a year: 0.065 is 6.5% a year */
  annualRate: number;
  /** how many monthly payments the loan has */
  termMonths: number;
  /** the date the money arrived (YYYY-MM-DD) */
  startDate: string;
  /** the first payment date; one month after the start when not given */
  firstPaymentDate?: string;
}

export interface LoanInstallment {
  /** 1 … termMonths */
  number: number;
  dueDate: string;
  /** interest + principal for this payment */
  paymentCents: number;
  interestCents: number;
  principalCents: number;
  /** what is still owed after this payment */
  balanceCents: number;
}

export interface LoanSchedule {
  principalCents: number;
  annualRate: number;
  termMonths: number;
  /** the level payment the loan was planned around (the last one takes the remainder) */
  paymentCents: number;
  installments: LoanInstallment[];
  totalInterestCents: number;
  totalPaymentsCents: number;
}

export type LoanScheduleResult =
  | { ok: true; schedule: LoanSchedule }
  | { ok: false; problem: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Cents of interest for one month on a balance, rounded half up. */
export function interestForMonthCents(balanceCents: number, annualRate: number): number {
  return new Decimal(balanceCents)
    .times(annualRate)
    .div(12)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/** The level monthly payment that repays `principal` in `termMonths` at `annualRate` (annuity). */
export function levelPaymentCents(principalCents: number, annualRate: number, termMonths: number): number {
  if (annualRate <= 0) return Math.ceil(principalCents / termMonths);
  const monthlyRate = new Decimal(annualRate).div(12);
  const discount = new Decimal(1).minus(new Decimal(1).plus(monthlyRate).pow(-termMonths));
  return new Decimal(principalCents).times(monthlyRate).div(discount).ceil().toNumber();
}

/**
 * The schedule, or the reason there cannot be one. Refused: a principal, term or rate that is not
 * a real loan, a first payment that is not after the start, and a payment that does not even cover
 * the first month's interest (a loan like that grows instead of being repaid).
 */
export function buildLoanSchedule(input: LoanScheduleInput): LoanScheduleResult {
  const principalCents = Math.round(input.principalCents);
  const termMonths = Math.floor(input.termMonths);
  const annualRate = input.annualRate;
  const startDate = (input.startDate || '').slice(0, 10);
  const firstPaymentDate = (input.firstPaymentDate || addToDateISO(startDate, { months: 1 })).slice(0, 10);

  if (!Number.isFinite(principalCents) || principalCents <= 0) return { ok: false, problem: 'The principal must be a positive whole amount.' };
  if (!Number.isFinite(termMonths) || termMonths < 1 || termMonths > 600) return { ok: false, problem: 'The term must be between 1 and 600 monthly payments.' };
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 1) return { ok: false, problem: 'The rate must be between 0% and 100% a year.' };
  if (!DATE.test(startDate) || !DATE.test(firstPaymentDate)) return { ok: false, problem: 'Give a real start date and first payment date.' };
  if (firstPaymentDate <= startDate) return { ok: false, problem: 'The first payment must be after the money arrived.' };

  const paymentCents = levelPaymentCents(principalCents, annualRate, termMonths);
  if (paymentCents <= interestForMonthCents(principalCents, annualRate)) {
    return { ok: false, problem: 'At this rate and term the payment never covers the interest — lengthen the term or lower the rate.' };
  }

  const installments: LoanInstallment[] = [];
  let balance = principalCents;
  for (let number = 1; number <= termMonths && balance > 0; number++) {
    const interestCents = interestForMonthCents(balance, annualRate);
    // The last payment (or one that would overshoot) takes whatever is left, so the loan closes
    // exactly at zero and the principal parts add up to the principal.
    const principalPart = number === termMonths || paymentCents - interestCents >= balance
      ? balance
      : paymentCents - interestCents;
    const payment = principalPart + interestCents;
    balance -= principalPart;
    installments.push({
      number,
      dueDate: addToDateISO(firstPaymentDate, { months: number - 1 }),
      paymentCents: payment,
      interestCents,
      principalCents: principalPart,
      balanceCents: balance,
    });
  }

  const totalInterestCents = installments.reduce((sum, i) => sum + i.interestCents, 0);
  const totalPaymentsCents = installments.reduce((sum, i) => sum + i.paymentCents, 0);
  return {
    ok: true,
    schedule: {
      principalCents,
      annualRate,
      termMonths,
      paymentCents,
      installments,
      totalInterestCents,
      totalPaymentsCents,
    },
  };
}

/** The installments recorded so far, in the order they run. */
export function paidInstallmentNumbers(recorded: Array<{ installment: number }> | undefined): number[] {
  return [...new Set((recorded || []).map(p => p.installment))].sort((a, b) => a - b);
}

/** The next installment to pay (skipping over any already recorded), or null when the loan is done. */
export function nextInstallment(schedule: LoanSchedule, recorded: Array<{ installment: number }> | undefined): LoanInstallment | null {
  const paid = new Set((recorded || []).map(p => p.installment));
  return schedule.installments.find(installment => !paid.has(installment.number)) || null;
}

/**
 * What is still owed: the balance after the last recorded installment, counting only from the
 * start of the schedule — a payment recorded out of order does not move the balance until the ones
 * before it are recorded too.
 */
export function scheduleBalanceCents(schedule: LoanSchedule, recorded: Array<{ installment: number }> | undefined): number {
  const paid = new Set((recorded || []).map(p => p.installment));
  let balance = schedule.principalCents;
  for (const installment of schedule.installments) {
    if (!paid.has(installment.number)) break;
    balance = installment.balanceCents;
  }
  return balance;
}

/** Interest actually paid so far, by the same rule. */
export function scheduleInterestPaidCents(schedule: LoanSchedule, recorded: Array<{ installment: number }> | undefined): number {
  const paid = new Set((recorded || []).map(p => p.installment));
  let interest = 0;
  for (const installment of schedule.installments) {
    if (!paid.has(installment.number)) break;
    interest += installment.interestCents;
  }
  return interest;
}
