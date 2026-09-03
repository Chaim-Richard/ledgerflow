import Decimal from 'decimal.js';
import { ChartAccount, Transaction, TransactionLine } from '../../types';
import { DoubleEntryValidator } from '../validation/DoubleEntryValidator';

export interface ClosingResult {
  closingTransaction: Transaction;
  netIncomeCents: number;
  revenueAccountsClosed: number;
  expenseAccountsClosed: number;
  retainedEarningsAccountId: string;
  generatedRetainedEarningsAccount?: ChartAccount;
  summary: {
    totalRevenueCents: number;
    totalExpenseCents: number;
    netSurplusCents: number;
  };
}

export class ClosingEntryEngine {
  /**
   * Computes the temporary account balances (Income/Expense) as of closingDate
   * and generates a GAAP-compliant balanced closing journal entry that zeroes
   * all temporary accounts into the Retained Earnings equity account.
   */
  static generateClosingJournalEntry(params: {
    workspaceId: string;
    uid: string;
    closingDate: string; // YYYY-MM-DD
    accounts: ChartAccount[];
    transactions: Transaction[];
    retainedEarningsAccountId?: string;
  }): ClosingResult {
    const { workspaceId, uid, closingDate, accounts, transactions } = params;

    if (!closingDate || !/^\d{4}-\d{2}-\d{2}$/.test(closingDate)) {
      throw new Error(`Invalid closing date format: "${closingDate}". Expected YYYY-MM-DD.`);
    }

    // 1. Identify all temporary accounts (Income, Revenue, Expense, Cost of Goods)
    const incomeAccountMap = new Map<string, ChartAccount>();
    const expenseAccountMap = new Map<string, ChartAccount>();

    accounts.forEach(acc => {
      if (acc.workspaceId && acc.workspaceId !== workspaceId) return;
      if (acc.type === 'income' || acc.type === 'revenue') {
        incomeAccountMap.set(acc.id, acc);
      } else if (acc.type === 'expense' || acc.type === 'cost_of_goods') {
        expenseAccountMap.set(acc.id, acc);
      }
    });

    // 2. Tally running balances for temporary accounts up to closingDate
    // In LedgerFlow: line.amountCents > 0 is Debit, < 0 is Credit.
    // Income accounts have normal Credit balance (net negative sum of amountCents).
    // Expense accounts have normal Debit balance (net positive sum of amountCents).
    const incomeBalances = new Map<string, Decimal>();
    const expenseBalances = new Map<string, Decimal>();

    // Opening balances
    incomeAccountMap.forEach((acc, id) => {
      // Opening balance on income: credit nature
      const opening = acc.openingBalanceCents || 0;
      incomeBalances.set(id, new Decimal(opening));
    });

    expenseAccountMap.forEach((acc, id) => {
      const opening = acc.openingBalanceCents || 0;
      expenseBalances.set(id, new Decimal(opening));
    });

    // Replay transactions on or before closing date (excluding void, failed, or prior closing entries)
    transactions.forEach(tx => {
      if (!tx || typeof tx !== 'object') return;
      if (tx.workspaceId && tx.workspaceId !== workspaceId) return;
      if (tx.status === 'void' || tx.status === 'failed' || tx.deletedAt) return;
      if (tx.date > closingDate) return;

      if (Array.isArray(tx.lines)) {
        tx.lines.forEach(line => {
          if (!line || !line.accountId) return;
          const rate = (typeof line.exchangeRate === 'number' && line.exchangeRate > 0)
            ? line.exchangeRate
            : ((typeof tx.exchangeRate === 'number' && tx.exchangeRate > 0) ? tx.exchangeRate : 1);
          
          const rawCents = typeof line.amountCents === 'number' ? line.amountCents : 0;
          const convertedCents = Math.round(rawCents * rate);

          if (incomeAccountMap.has(line.accountId)) {
            // Negative amountCents = Credit (Revenue earned)
            // Positive amountCents = Debit (Revenue returns/reductions)
            // Normal revenue = Credits - Debits = -amountCents
            const current = incomeBalances.get(line.accountId) || new Decimal(0);
            incomeBalances.set(line.accountId, current.plus(new Decimal(-convertedCents)));
          } else if (expenseAccountMap.has(line.accountId)) {
            // Positive amountCents = Debit (Expense incurred)
            // Negative amountCents = Credit (Expense reduction/refund)
            // Normal expense = Debits - Credits = +amountCents
            const current = expenseBalances.get(line.accountId) || new Decimal(0);
            expenseBalances.set(line.accountId, current.plus(new Decimal(convertedCents)));
          }
        });
      }
    });

    // 3. Resolve Retained Earnings Equity Account
    let retainedEarningsAcc = params.retainedEarningsAccountId
      ? accounts.find(a => a.id === params.retainedEarningsAccountId)
      : undefined;

    let isSynthetic = false;

    if (!retainedEarningsAcc) {
      retainedEarningsAcc = accounts.find(a => 
        a.workspaceId === workspaceId && 
        (a.subtype === 'retained_earnings' || a.category === 'retained_earnings')
      );
    }

    if (!retainedEarningsAcc) {
      retainedEarningsAcc = accounts.find(a => 
        a.workspaceId === workspaceId && 
        a.type === 'equity' && 
        (a.name.toLowerCase().includes('retained') || a.code === '3000' || a.code === '3900' || a.code === '3200')
      );
    }

    if (!retainedEarningsAcc) {
      retainedEarningsAcc = accounts.find(a => a.workspaceId === workspaceId && a.type === 'equity');
    }

    if (!retainedEarningsAcc) {
      // Create fallback synthetic retained earnings id
      isSynthetic = true;
      retainedEarningsAcc = {
        id: `retained-earnings-${workspaceId}`,
        uid,
        workspaceId,
        name: 'Retained Earnings',
        code: '3000',
        type: 'equity',
        subtype: 'retained_earnings',
        category: 'Equity',
        balanceCents: 0
      };
    }

    // 4. Construct the closing lines:
    // To close an Income Account with positive revenue balance R:
    // We must DEBIT the income account by +R cents (amountCents = +R).
    // To close an Expense Account with positive expense balance E:
    // We must CREDIT the expense account by -E cents (amountCents = -E).
    const closingLines: TransactionLine[] = [];
    let totalRevenueDec = new Decimal(0);
    let totalExpenseDec = new Decimal(0);
    let revenueCount = 0;
    let expenseCount = 0;

    incomeBalances.forEach((balDec, accountId) => {
      const balCents = balDec.toNumber();
      if (balCents !== 0) {
        const acc = incomeAccountMap.get(accountId)!;
        // If balance > 0 (normal revenue): debit it (+balCents) to make account 0
        // If balance < 0 (contra revenue): credit it (-|balCents|)
        closingLines.push({
          accountId,
          accountName: acc.name,
          amountCents: balCents, // Debit to close
          description: `Close ${acc.name} to Retained Earnings (${closingDate})`
        });
        totalRevenueDec = totalRevenueDec.plus(balDec);
        revenueCount++;
      }
    });

    expenseBalances.forEach((balDec, accountId) => {
      const balCents = balDec.toNumber();
      if (balCents !== 0) {
        const acc = expenseAccountMap.get(accountId)!;
        // If balance > 0 (normal expense): credit it (-balCents) to make account 0
        // If balance < 0 (contra expense): debit it (+|balCents|)
        closingLines.push({
          accountId,
          accountName: acc.name,
          amountCents: -balCents, // Credit to close
          description: `Close ${acc.name} to Retained Earnings (${closingDate})`
        });
        totalExpenseDec = totalExpenseDec.plus(balDec);
        expenseCount++;
      }
    });

    // Net Income = Total Revenue - Total Expense
    const netIncomeDec = totalRevenueDec.minus(totalExpenseDec);
    const netIncomeCents = netIncomeDec.toNumber();

    // Offsetting entry to Retained Earnings:
    // If Net Income > 0 (Profit): Credit Retained Earnings (-netIncomeCents)
    // If Net Income < 0 (Loss): Debit Retained Earnings (+|netIncomeCents|)
    if (netIncomeCents !== 0 || closingLines.length > 0) {
      closingLines.push({
        accountId: retainedEarningsAcc.id,
        accountName: retainedEarningsAcc.name,
        amountCents: -netIncomeCents, // Credit for profit, Debit for loss
        description: `Net Income Transfer to Retained Earnings for Period Ending ${closingDate}`
      });
    }

    if (closingLines.length < 2) {
      // Nothing to close or balanced single line
      if (closingLines.length === 1) {
        // Balance with retained earnings zero leg to satisfy 2-leg invariant
        closingLines.push({
          accountId: retainedEarningsAcc.id,
          accountName: retainedEarningsAcc.name,
          amountCents: 0,
          description: `Zero balance close placeholder for ${closingDate}`
        });
      } else {
        // Zero temporary balances across the board
        closingLines.push(
          {
            accountId: retainedEarningsAcc.id,
            accountName: retainedEarningsAcc.name,
            amountCents: 0,
            description: `Fiscal year close - No open revenue or expense balances`
          },
          {
            accountId: retainedEarningsAcc.id,
            accountName: retainedEarningsAcc.name,
            amountCents: 0,
            description: `Period sealed as of ${closingDate}`
          }
        );
      }
    }

    // Absolute total debit amount for the transaction header
    const totalDebitCents = closingLines
      .filter(l => l.amountCents > 0)
      .reduce((sum, l) => sum + l.amountCents, 0);

    const txId = `close-${closingDate.replace(/-/g, '')}-${Date.now().toString(36)}`;

    const closingTransaction: Transaction = {
      id: txId,
      uid,
      workspaceId,
      date: closingDate,
      description: `Fiscal Year Close (${closingDate}) - Transfer P&L to Retained Earnings`,
      totalAmountCents: totalDebitCents || Math.abs(netIncomeCents),
      currency: 'USD',
      exchangeRate: 1,
      status: 'completed',
      type: 'adjustment',
      isCleared: true,
      lines: closingLines,
      createdAt: new Date().toISOString(),
      metadata: {
        isYearEndClose: true,
        closingDate,
        netIncomeCents,
        revenueAccountsClosed: revenueCount,
        expenseAccountsClosed: expenseCount,
        totalRevenueCents: totalRevenueDec.toNumber(),
        totalExpenseCents: totalExpenseDec.toNumber(),
        closedAt: new Date().toISOString()
      }
    };

    // Verify double-entry balancing invariant
    DoubleEntryValidator.validateJournalEntry(closingTransaction);

    return {
      closingTransaction,
      netIncomeCents,
      revenueAccountsClosed: revenueCount,
      expenseAccountsClosed: expenseCount,
      retainedEarningsAccountId: retainedEarningsAcc.id,
      generatedRetainedEarningsAccount: isSynthetic ? retainedEarningsAcc : undefined,
      summary: {
        totalRevenueCents: totalRevenueDec.toNumber(),
        totalExpenseCents: totalExpenseDec.toNumber(),
        netSurplusCents: netIncomeCents
      }
    };
  }
}
