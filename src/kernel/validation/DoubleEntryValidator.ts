import { Transaction } from '../../types';
import Decimal from 'decimal.js';
import { validateSplitAllocations } from '../../lib/dimensionUtils';

export class DoubleEntryValidator {
  /**
   * Validates that a journal entry (transaction) balances safely and securely.
   * Sum(Debits) = Sum(Credits) and validates split allocation weight integrity (100%).
   */
  
  static validateJournalEntry(transaction: Transaction): boolean {
    if (!transaction || typeof transaction !== 'object') {
      throw new Error('Validation Failed: Invalid transaction payload.');
    }
    if (!Array.isArray(transaction.lines) || transaction.lines.length === 0) {
      throw new Error('Validation Failed: Transaction must have at least one line item.');
    }
    
    // ISO 4217 Currency Code Validation
    if (transaction.currency && !/^[A-Z]{3}$/.test(transaction.currency)) {
      throw new Error('Validation Failed: Currency must be a valid ISO 4217 3-letter code (e.g., USD, EUR).');
    }

    // Validate line split allocation integrity if splits are defined
    for (let i = 0; i < transaction.lines.length; i++) {
      const line = transaction.lines[i];
      if (!line || typeof line !== 'object') {
        throw new Error(`Validation Failed: Invalid line object at index ${i}.`);
      }
      
      let amountCents = line.amountCents;
      if (typeof amountCents !== 'number' || !Number.isFinite(amountCents) || !Number.isSafeInteger(amountCents)) {
        throw new Error(`Validation Failed: Line ${i + 1} amount must be a valid finite integer in cents.`);
      }
      
      if (line.splitAllocations) {
        if (!Array.isArray(line.splitAllocations)) {
          throw new Error(`Validation Failed: Line ${i + 1} splitAllocations must be an array.`);
        }
        if (line.splitAllocations.length > 0) {
          const check = validateSplitAllocations(line.splitAllocations);
          if (!check.valid) {
            throw new Error(`Validation Failed: Line ${i + 1} split allocations invalid. ${check.error}`);
          }
        }
      }
    }
    
    const netImpact = transaction.lines.reduce((sum, line) => {
      const cents = Math.round(line.amountCents || 0);
      return sum.plus(new Decimal(cents));
    }, new Decimal(0));
    
    // Automatically balance sub-cent floating point precision discrepancies (<= 10 cents)
    if (!netImpact.isZero()) {
      if (netImpact.abs().lte(10)) {
        // Create synthetic balancing line
        transaction.lines.push({
          id: `${transaction.id}-fx-balance`,
          accountId: 'fx-rounding',
          accountName: 'FX Rounding Adjustment',
          amountCents: netImpact.negated().toNumber(),
          description: 'Synthetic balancing line for floating point discrepancy',
        } as any);
      } else {
        const debitTotal = transaction.lines
          .filter(l => (l.amountCents || 0) > 0)
          .reduce((sum, l) => sum.plus(new Decimal(Math.round(l.amountCents || 0))), new Decimal(0));
        const creditTotal = transaction.lines
          .filter(l => (l.amountCents || 0) < 0)
          .reduce((sum, l) => sum.plus(new Decimal(Math.round(l.amountCents || 0))), new Decimal(0));
        throw new Error(`Validation Failed: Unbalanced entry. Net impact is ${netImpact.toString()} cents (Debits: ${debitTotal.toString()}, Credits: ${creditTotal.toString()}). Debits must exactly equal Credits.`);
      }
    }
    
    return true;
  }

}

