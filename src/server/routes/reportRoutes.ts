import express from "express";
import admin from "firebase-admin";
import { z } from "zod";
import { getDb, validateWorkspaceMember } from "../db/firestore";
import { calculateNetIncome, isPostable, isRevenueAccount, isExpenseAccount, lineAmount, isTransactionInDateRange } from "../../lib/txFilters";
import { ReportRangeSchema, WorkspaceIdSchema } from "../../schemas";
import { parseLocalDate, getLocalDateISO } from "../../lib/utils";

export const reportRouter = express.Router();

interface AuthUser extends admin.auth.DecodedIdToken {
  email_verified: boolean;
}

interface AuthenticatedRequest extends express.Request {
  user: AuthUser;
}

function sendError(res: express.Response, message: string, status: number = 500, details?: any) {
  console.error(`[API Error] ${status}: ${message} (Path: ${res.req?.originalUrl || "unknown"})`, details || "");
  res.status(status).json({
    status: "error",
    message,
    ...(details && { details })
  });
}

async function authorizeWorkspace(req: AuthenticatedRequest, workspaceId: string) {
  const db = getDb();
  await validateWorkspaceMember(db, workspaceId, req.user);
}

async function getReportContext(req: AuthenticatedRequest, workspaceId: string, startDate?: string, endDate?: string) {
  const db = getDb();
  await authorizeWorkspace(req, workspaceId);
  const accountsSnap = await db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get();
  
  const defaultStart = startDate || `${new Date().getFullYear()}-01-01`;
  const defaultEnd = endDate || getLocalDateISO(new Date());

  let txQuery: admin.firestore.Query = db.collection("transactions").where("workspaceId", "==", workspaceId);
  txQuery = txQuery.where("date", ">=", defaultStart);
  txQuery = txQuery.where("date", "<=", defaultEnd);
  
  const transactions: any[] = [];
  const txStream = txQuery.stream();
  
  for await (const chunk of txStream as any) {
    transactions.push((chunk as any).data());
  }
  
  return {
    accounts: accountsSnap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() as any) })),
    transactions
  };
}

reportRouter.get("/profit-and-loss", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const result = ReportRangeSchema.safeParse(req.query);
  if (!result.success) return sendError(res, "Invalid parameters", 400, result.error.issues);
  const { workspaceId, startDate, endDate } = result.data;
  try {
    const { accounts, transactions } = await getReportContext(authReq, workspaceId, startDate, endDate);
    const start = startDate || "1970-01-01";
    const end = endDate || "2099-12-31";
    const pl: any = {
      income: { total: 0, accounts: {} },
      expense: { total: 0, accounts: {} },
      grossProfit: 0,
      netIncome: 0
    };
    accounts.forEach((acc: any) => {
      if (isRevenueAccount(acc)) {
        pl.income.accounts[acc.id] = { name: acc.name, balance: 0, parentId: acc.parentId };
      } else if (isExpenseAccount(acc)) {
        pl.expense.accounts[acc.id] = { name: acc.name, balance: 0, parentId: acc.parentId };
      }
    });
    for (const tx of transactions) {
      if (!isPostable(tx)) continue;
      if (!isTransactionInDateRange(tx, start, end)) continue;
      tx.lines?.forEach((line: any) => {
        const amount = lineAmount(line, tx);
        if (pl.income.accounts[line.accountId]) {
          const val = -amount; 
          pl.income.accounts[line.accountId].balance += val;
          pl.income.total += val;
        } else if (pl.expense.accounts[line.accountId]) {
          const val = amount;
          pl.expense.accounts[line.accountId].balance += val;
          pl.expense.total += val;
        }
      });
    }
    const totals = calculateNetIncome(transactions, accounts, start, end);
    pl.grossProfit = totals.grossProfit;
    pl.netIncome = totals.netIncome;
    pl.income.total = totals.income;
    pl.expense.total = totals.expense;
    res.json(pl);
  } catch (error: any) {
    if (error.message === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (error.message === "NOT_FOUND" || error.message?.includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Internal Reporting Error", 500, error.message);
  }
});

reportRouter.get("/balance-sheet", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const result = ReportRangeSchema.safeParse(req.query);
  if (!result.success) return sendError(res, "Invalid parameters", 400, result.error.issues);
  const { workspaceId, endDate } = result.data;
  try {
    const { accounts, transactions } = await getReportContext(authReq, workspaceId, undefined, endDate);
    const end = endDate || "2099-12-31";

    const balances: Record<string, number> = {};
    accounts.forEach((acc: any) => {
      balances[acc.id] = acc.openingBalanceCents || 0;
    });

    for (const tx of transactions) {
      if (!isPostable(tx)) continue;
      if (!isTransactionInDateRange(tx, undefined, end)) continue;
      tx.lines?.forEach((line: any) => {
        if (balances[line.accountId] !== undefined) {
          balances[line.accountId] += lineAmount(line, tx);
        }
      });
    }

    const { netIncome } = calculateNetIncome(transactions, accounts, "1970-01-01", end);

    const assets: Record<string, { name: string; balance: number; subtype?: string }> = {};
    const liabilities: Record<string, { name: string; balance: number; subtype?: string }> = {};
    const equity: Record<string, { name: string; balance: number; subtype?: string }> = {};

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    accounts.forEach((acc: any) => {
      const bal = balances[acc.id] || 0;
      if (acc.type === 'asset') {
        assets[acc.id] = { name: acc.name, balance: bal, subtype: acc.subtype };
        totalAssets += bal;
      } else if (acc.type === 'liability') {
        const val = -bal;
        liabilities[acc.id] = { name: acc.name, balance: val, subtype: acc.subtype };
        totalLiabilities += val;
      } else if (acc.type === 'equity') {
        const val = -bal;
        equity[acc.id] = { name: acc.name, balance: val, subtype: acc.subtype };
        totalEquity += val;
      }
    });

    totalEquity += netIncome;

    res.json({
      assets: { total: totalAssets, accounts: assets },
      liabilities: { total: totalLiabilities, accounts: liabilities },
      equity: { total: totalEquity, accounts: equity, currentPeriodNetIncome: netIncome },
      totalAssets,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      isBalanced: totalAssets === (totalLiabilities + totalEquity)
    });
  } catch (error: any) {
    if (error.message === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (error.message === "NOT_FOUND" || error.message?.includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Internal Reporting Error", 500, error.message);
  }
});

reportRouter.get("/aging", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const result = WorkspaceIdSchema.extend({ type: z.enum(['ar', 'ap']) }).safeParse(req.query);
  if (!result.success) return sendError(res, "Invalid parameters", 400, result.error.issues);
  const { workspaceId, type } = result.data;

  try {
    await authorizeWorkspace(authReq, workspaceId);
    const db = getDb();
    const collectionName = type === 'ar' ? 'invoices' : 'bills';
    const snap = await db.collection(collectionName)
      .where("workspaceId", "==", workspaceId)
      .get();

    let items = snap.docs.map((doc: any) => doc.data());
    
    const allowedStatuses = ["unpaid", "pending", "overdue", "sent", "partially_paid"];
    items = items.filter(item => allowedStatuses.includes(item.status));
    const today = parseLocalDate(getLocalDateISO());
    
    const aging = {
      current: 0,
      "1-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
      total: 0
    };

    items.forEach((item: any) => {
      const rawTotal = item.amountCents || item.totalCents || item.amountTotalCents || 0;
      const rawPaid = item.amountPaidCents || item.paidAmountCents || 0;
      const outstanding = Math.max(0, rawTotal - rawPaid);
      if (outstanding <= 0) return;

      let diffDays = 0;
      const dateStr = item.dueDate || item.date;
      if (dateStr && typeof dateStr === 'string') {
        try {
          const parsed = parseLocalDate(dateStr);
          if (!isNaN(parsed.getTime())) {
            diffDays = Math.floor((today.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24));
          }
        } catch {
          diffDays = 0;
        }
      }

      if (diffDays <= 0) aging.current += outstanding;
      else if (diffDays <= 30) aging["1-30"] += outstanding;
      else if (diffDays <= 60) aging["31-60"] += outstanding;
      else if (diffDays <= 90) aging["61-90"] += outstanding;
      else aging["90+"] += outstanding;

      aging.total += outstanding;
    });

    res.json(aging);
  } catch (error: any) {
    if (error.message === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (error.message === "NOT_FOUND" || error.message?.includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Failed to generate aging report", 500, error.message);
  }
});

reportRouter.get("/trial-balance", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const result = WorkspaceIdSchema.safeParse(req.query);
  if (!result.success) return sendError(res, "Invalid parameters", 400, result.error.issues);
  const { workspaceId } = result.data;
  try {
    const { accounts, transactions } = await getReportContext(authReq, workspaceId);
    const trialBalance: Record<string, { name: string, debit: number, credit: number }> = {};
    accounts.forEach((acc: any) => {
      const opening = acc.openingBalanceCents || 0;
      trialBalance[acc.id] = {
        name: acc.name,
        debit: opening > 0 ? opening : 0,
        credit: opening < 0 ? Math.abs(opening) : 0
      };
    });
    for (const tx of transactions) {
      if (!isPostable(tx)) continue;
      tx.lines?.forEach((line: any) => {
        const amount = lineAmount(line, tx);
        if (trialBalance[line.accountId]) {
          if (amount > 0) trialBalance[line.accountId].debit += amount;
          else trialBalance[line.accountId].credit += Math.abs(amount);
        }
      });
    }
    const totalDebit = Object.values(trialBalance).reduce((sum, acc) => sum + acc.debit, 0);
    const totalCredit = Object.values(trialBalance).reduce((sum, acc) => sum + acc.credit, 0);
    res.json({ accounts: trialBalance, totalDebit, totalCredit, isBalanced: totalDebit === totalCredit });
  } catch (error: any) {
    if (error.message === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (error.message === "NOT_FOUND" || error.message?.includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Trial Balance Failure", 500, error.message);
  }
});

reportRouter.get("/cash-flow", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const result = ReportRangeSchema.safeParse(req.query);
  if (!result.success) return sendError(res, "Invalid parameters", 400, result.error.issues);
  const { workspaceId, startDate, endDate } = result.data;

  try {
    await authorizeWorkspace(authReq, workspaceId);
    const db = getDb();
    
    const defaultStart = startDate || `${new Date().getFullYear()}-01-01`;
    const defaultEnd = endDate || getLocalDateISO(new Date());

    let txQuery: admin.firestore.Query = db.collection("transactions").where("workspaceId", "==", workspaceId);
    txQuery = txQuery.where("date", ">=", String(defaultStart));
    txQuery = txQuery.where("date", "<=", String(defaultEnd));

    const [accountsSnap, transactionsSnap] = await Promise.all([
      db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get(),
      txQuery.get()
    ]);

    const accounts = accountsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    let transactions = transactionsSnap.docs.map((doc: any) => doc.data());

    if (startDate || endDate) {
      const start = startDate ? String(startDate) : "1970-01-01";
      const end = endDate ? String(endDate) : "2099-12-31";
      transactions = transactions.filter((tx: any) => isTransactionInDateRange(tx, start, end));
    }

    const cashFlow = {
      operating: { total: 0, items: [] as any[] },
      investing: { total: 0, items: [] as any[] },
      financing: { total: 0, items: [] as any[] },
      netChange: 0
    };

    transactions.forEach((tx: any) => {
      if (!isPostable(tx)) return;
      tx.lines?.forEach((line: any) => {
        const acc = accounts.find(a => a.id === line.accountId);
        if (!acc) return;
        const amount = lineAmount(line, tx);

        if (acc.type === 'income') cashFlow.operating.total -= amount;
        if (acc.type === 'expense') cashFlow.operating.total -= amount;

        if (acc.type === 'asset' && (acc.category === 'Receivables' || acc.category === 'Receivable' || acc.category === 'Accounts Receivable')) cashFlow.operating.total -= amount;
        if (acc.type === 'liability' && (acc.category === 'Payables' || acc.category === 'Payable' || acc.category === 'Accounts Payable')) cashFlow.operating.total -= amount;

        if (acc.type === 'asset' && (acc.category === 'Fixed Assets' || acc.category === 'Fixed Asset')) {
          cashFlow.investing.total -= amount;
          cashFlow.investing.items.push({ name: tx.description, amount: -amount });
        }

        if (acc.type === 'equity' || (acc.type === 'liability' && (acc.category === 'Long Term Liabilities' || acc.category === 'Long Term Liability'))) {
          cashFlow.financing.total -= amount;
          cashFlow.financing.items.push({ name: tx.description, amount: -amount });
        }
      });
    });

    cashFlow.netChange = cashFlow.operating.total + cashFlow.investing.total + cashFlow.financing.total;

    res.json(cashFlow);
  } catch (error: any) {
    if (error.message === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (error.message === "NOT_FOUND" || error.message?.includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Failed to generate cash flow statement", 500, error.message);
  }
});

function calculateMonthDateRange(monthStr: string): { startDate: string; endDate: string } {
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10);
  if (!year || !month || month < 1 || month > 12) {
    return { startDate: `${monthStr}-01`, endDate: `${monthStr}-31` };
  }
  const lastDay = new Date(year, month, 0).getDate();
  const mPadded = String(month).padStart(2, '0');
  const dPadded = String(lastDay).padStart(2, '0');
  return {
    startDate: `${year}-${mPadded}-01`,
    endDate: `${year}-${mPadded}-${dPadded}`
  };
}

reportRouter.get("/budget-vs-actual", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const result = WorkspaceIdSchema.extend({ month: z.string().optional() }).safeParse(req.query);
  if (!result.success) return sendError(res, "Invalid parameters", 400, result.error.issues);
  const { workspaceId, month } = result.data;

  try {
    await authorizeWorkspace(authReq, workspaceId);
    const db = getDb();

    let txQuery: admin.firestore.Query = db.collection("transactions").where("workspaceId", "==", workspaceId);
    
    const targetMonth = month ? String(month) : getLocalDateISO(new Date()).substring(0, 7);
    const { startDate: mStart, endDate: mEnd } = calculateMonthDateRange(targetMonth);
    txQuery = txQuery.where("date", ">=", mStart).where("date", "<=", mEnd);

    const [budgetsSnap, transactionsSnap, accountsSnap] = await Promise.all([
      db.collection("budgets").where("workspaceId", "==", workspaceId).get(),
      txQuery.get(),
      db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get()
    ]);

    const budgets = budgetsSnap.docs.map((doc: any) => doc.data());
    let transactions = transactionsSnap.docs.map((doc: any) => doc.data());
    const accounts = accountsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    transactions = transactions.filter(tx => tx.date && tx.date.startsWith(targetMonth));

    const report = budgets.map((b: any) => {
      const account = accounts.find(a => a.id === b.accountId);
      let actual = 0;
      transactions.forEach((tx: any) => {
        if (!isPostable(tx)) return;
        tx.lines?.forEach((line: any) => {
          if (line.accountId === b.accountId) {
            actual += Math.abs(line.amountCents);
          }
        });
      });

      return {
        accountName: account?.name || 'Unknown',
        budget: b.amountCents,
        actual,
        variance: b.amountCents - actual,
        percent: b.amountCents > 0 ? (actual / b.amountCents) * 100 : 0
      };
    });

    res.json(report);
  } catch (error: any) {
    if (error.message === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (error.message === "NOT_FOUND" || error.message?.includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Failed to generate budget vs actual report", 500, error.message);
  }
});
