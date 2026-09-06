import express from "express";
import admin from "firebase-admin";
import { z } from "zod";
import { getDb, validateWorkspaceMember } from "../db/firestore";
import { calculateNetIncome, isPostable, isRevenueAccount, isExpenseAccount } from "../../lib/txFilters";
import { ReportRangeSchema, WorkspaceIdSchema } from "../../schemas";

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
  if (!workspaceId || typeof workspaceId !== 'string') {
    throw new Error("NOT_FOUND: Invalid workspace identifier provided.");
  }
  const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
  if (!wsDoc.exists) {
    throw new Error(`NOT_FOUND: Workspace with ID ${workspaceId} not found in database.`);
  }
  const data = wsDoc.data();
  const isOwner = data?.uid === req.user.uid;
  const isMember = Array.isArray(data?.members) && data.members.includes(req.user.uid);
  const isAdmin = data?.admins?.[req.user.uid] === true || req.user.admin;

  if (!isOwner && !isMember && !isAdmin) {
    throw new Error("FORBIDDEN");
  }
}

async function getReportContext(req: AuthenticatedRequest, workspaceId: string) {
  const db = getDb();
  await authorizeWorkspace(req, workspaceId);
  const accountsSnap = await db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get();
  
  const transactions: any[] = [];
  const txStream = db.collection("transactions").where("workspaceId", "==", workspaceId).stream();
  
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
    const { accounts, transactions } = await getReportContext(authReq, workspaceId);
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
      if (tx.date < start || tx.date > end) continue;
      tx.lines?.forEach((line: any) => {
        if (pl.income.accounts[line.accountId]) {
          const val = -line.amountCents; 
          pl.income.accounts[line.accountId].balance += val;
          pl.income.total += val;
        } else if (pl.expense.accounts[line.accountId]) {
          const val = line.amountCents;
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
    const { accounts, transactions } = await getReportContext(authReq, workspaceId);
    const end = endDate || "2099-12-31";

    const balances: Record<string, number> = {};
    accounts.forEach((acc: any) => {
      balances[acc.id] = acc.openingBalanceCents || 0;
    });

    for (const tx of transactions) {
      if (!isPostable(tx)) continue;
      if (tx.date > end) continue;
      tx.lines?.forEach((line: any) => {
        if (balances[line.accountId] !== undefined) {
          balances[line.accountId] += line.amountCents;
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
    
    const allowedStatuses = ["unpaid", "pending", "overdue", "sent"];
    items = items.filter(item => allowedStatuses.includes(item.status));
    const now = new Date();
    
    const aging = {
      current: 0,
      "1-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
      total: 0
    };

    items.forEach((item: any) => {
      const dueDate = new Date(item.dueDate);
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const amount = item.amountCents || item.totalCents || 0;

      if (diffDays <= 0) aging.current += amount;
      else if (diffDays <= 30) aging["1-30"] += amount;
      else if (diffDays <= 60) aging["31-60"] += amount;
      else if (diffDays <= 90) aging["61-90"] += amount;
      else aging["90+"] += amount;

      aging.total += amount;
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
        if (trialBalance[line.accountId]) {
          if (line.amountCents > 0) trialBalance[line.accountId].debit += line.amountCents;
          else trialBalance[line.accountId].credit += Math.abs(line.amountCents);
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
    
    const [accountsSnap, transactionsSnap] = await Promise.all([
      db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get(),
      db.collection("transactions").where("workspaceId", "==", workspaceId).get()
    ]);

    const accounts = accountsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    let transactions = transactionsSnap.docs.map((doc: any) => doc.data());

    if (startDate || endDate) {
      const start = startDate ? String(startDate) : "1970-01-01";
      const end = endDate ? String(endDate) : "2099-12-31";
      transactions = transactions.filter((tx: any) => tx.date >= start && tx.date <= end);
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

        if (acc.type === 'income') cashFlow.operating.total -= line.amountCents;
        if (acc.type === 'expense') cashFlow.operating.total -= line.amountCents;

        if (acc.type === 'asset' && acc.category === 'Receivable') cashFlow.operating.total -= line.amountCents;
        if (acc.type === 'liability' && acc.category === 'Payable') cashFlow.operating.total += line.amountCents;

        if (acc.type === 'asset' && acc.category === 'Fixed Asset') {
          cashFlow.investing.total -= line.amountCents;
          cashFlow.investing.items.push({ name: tx.description, amount: -line.amountCents });
        }

        if (acc.type === 'equity' || (acc.type === 'liability' && acc.category === 'Long Term Liability')) {
          cashFlow.financing.total += line.amountCents;
          cashFlow.financing.items.push({ name: tx.description, amount: line.amountCents });
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

reportRouter.get("/budget-vs-actual", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const result = WorkspaceIdSchema.extend({ month: z.string().optional() }).safeParse(req.query);
  if (!result.success) return sendError(res, "Invalid parameters", 400, result.error.issues);
  const { workspaceId, month } = result.data;

  try {
    await authorizeWorkspace(authReq, workspaceId);
    const db = getDb();
    const [budgetsSnap, transactionsSnap, accountsSnap] = await Promise.all([
      db.collection("budgets").where("workspaceId", "==", workspaceId).get(),
      db.collection("transactions").where("workspaceId", "==", workspaceId).get(),
      db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get()
    ]);

    const budgets = budgetsSnap.docs.map((doc: any) => doc.data());
    let transactions = transactionsSnap.docs.map((doc: any) => doc.data());
    const accounts = accountsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    if (month) {
      const monthStr = String(month);
      transactions = transactions.filter(tx => tx.date && tx.date.startsWith(monthStr));
    }

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
