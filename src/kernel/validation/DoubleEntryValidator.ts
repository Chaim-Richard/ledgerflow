import { Transaction } from '../../types';

export class DoubleEntryValidator {
  /**
   * Validates that a journal entry (transaction) balances.
   * Sum(Debits) = Sum(Credits)
   * In our system, debits are positive amountCents, credits are negative.
   * Or if amounts are absolute, we need to check debit vs credit accounts.
   * Assuming amountCents in lines represent their signed value for simplicity,
   * or they must sum to 0.
   */
  static validateJournalEntry(transaction: Transaction): boolean {
    if (!transaction.lines || transaction.lines.length === 0) {
      throw new Error('Validation Failed: Transaction must have at least one line item.');
    }

    const netImpact = transaction.lines.reduce((sum, line) => {
      // If we treat all positive as debit, negative as credit:
      return sum + (line.amountCents || 0);
    }, 0);

    // Allowing for minor floating point or rounding issues if necessary, but with integers (cents) it should be exact 0.
    if (netImpact !== 0) {
      const debitTotal = transaction.lines.filter(l => (l.amountCents || 0) > 0).reduce((sum, l) => sum + (l.amountCents || 0), 0);
      const creditTotal = transaction.lines.filter(l => (l.amountCents || 0) < 0).reduce((sum, l) => sum + (l.amountCents || 0), 0);
      throw new Error(`Validation Failed: Unbalanced entry. Net impact is ${netImpact} cents (Debits: ${debitTotal}, Credits: ${creditTotal}). Debits must exactly equal Credits.`);
    }

    return true;
  }
}
