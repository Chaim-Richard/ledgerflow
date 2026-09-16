import express from "express";
import admin from "firebase-admin";
import { z } from "zod";
import { getDb, validateWorkspaceMember } from "../db/firestore";
import { isTransactionInDateRange, isPostable } from "../../lib/txFilters";
import { ReportRangeSchema, WorkspaceIdSchema } from "../../schemas";
import { parseLocalDate, getLocalDateISO } from "../../lib/utils";
import crypto from "crypto";
import {
  computeProfitAndLoss,
  computeBalanceSheet,
  computeTrialBalance,
  computeCashFlow,
  computeGeneralLedger,
  computeStatement,
  computeTaxLiability
} from "../reports/computeReports";

export const reportRouter = express.Router();

const REPORT_CACHE = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 60000; // 60 seconds

function getCacheKey(req: express.Request): string {
  const payload = JSON.stringify({ path: req.path, query: req.query, body: req.body, user: (req as any).user?.uid });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

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
  
  let txQuery: admin.firestore.Query = db.collection("transactions").where("workspaceId", "==", workspaceId);
  if (startDate) {
    txQuery = txQuery.where("date", ">=", startDate);
  }
  if (endDate) {
    txQuery = txQuery.where("date", "<=", endDate);
  }
  
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

reportRouter.get(["/profit-and-loss", "/pl"], async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const result = ReportRangeSchema.safeParse(req.query);
  if (!result.success) return sendError(res, "Invalid parameters", 400, result.error.issues);
  const { workspaceId, startDate, endDate } = result.data;
  const cacheKey = getCacheKey(req);
  const cached = REPORT_CACHE.get(cacheKey);
  if (cached && cached.expiry > Date.now()) return res.json(cached.data);
  try {
    const { accounts, transactions } = await getReportContext(authReq, workspaceId, startDate, endDate);
    const pl = computeProfitAndLoss(accounts, transactions, startDate, endDate);
    REPORT_CACHE.set(cacheKey, { data: pl, expiry: Date.now() + CACHE_TTL_MS });
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
  const cacheKey = getCacheKey(req);
  const cached = REPORT_CACHE.get(cacheKey);
  if (cached && cached.expiry > Date.now()) return res.json(cached.data);
  try {
    const { accounts, transactions } = await getReportContext(authReq, workspaceId, undefined, endDate);
    const bs = computeBalanceSheet(accounts, transactions, endDate);
    REPORT_CACHE.set(cacheKey, { data: bs, expiry: Date.now() + CACHE_TTL_MS });
    res.json(bs);
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
  const asOfDate = (req.query.asOfDate || req.query.endDate) as string | undefined;
  try {
    const { accounts, transactions } = await getReportContext(authReq, workspaceId, undefined, asOfDate);
    const tb = computeTrialBalance(accounts, transactions, asOfDate);
    res.json(tb);
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
    const { accounts, transactions } = await getReportContext(authReq, workspaceId, startDate, endDate);
    const cf = computeCashFlow(accounts, transactions, startDate, endDate);
    res.json(cf);
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

    const [budgetsSnap, accountsSnap] = await Promise.all([
      db.collection("budgets").where("workspaceId", "==", workspaceId).get(),
      db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get()
    ]);

    let transactions: any[] = [];
    await new Promise<void>((resolve, reject) => {
      txQuery.stream()
        .on("data", (doc: any) => transactions.push(doc.data()))
        .on("end", () => resolve())
        .on("error", async (err: any) => {
          try {
            const snap = await txQuery.get();
            transactions = snap.docs.map((doc: any) => doc.data());
            resolve();
          } catch (fallbackErr) {
            reject(err);
          }
        });
    });

    const budgets = budgetsSnap.docs.map((doc: any) => doc.data());
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

reportRouter.get("/general-ledger", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const result = ReportRangeSchema.extend({ accountId: z.string().optional() }).safeParse(req.query);
  if (!result.success) return sendError(res, "Invalid parameters", 400, result.error.issues);
  const { workspaceId, startDate, endDate, accountId } = result.data;

  try {
    const { accounts, transactions } = await getReportContext(authReq, workspaceId, undefined, endDate);
    const gl = computeGeneralLedger(accounts, transactions, startDate, endDate, accountId);
    res.json(gl);
  } catch (error: any) {
    if (error.message === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (error.message === "NOT_FOUND" || error.message?.includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Failed to generate General Ledger report", 500, error.message);
  }
});

reportRouter.get("/statement", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const result = WorkspaceIdSchema.extend({
    type: z.enum(['customer', 'vendor']),
    contactId: z.string().min(1),
    startDate: z.string().optional(),
    endDate: z.string().optional()
  }).safeParse(req.query);
  if (!result.success) return sendError(res, "Invalid parameters", 400, result.error.issues);
  const { workspaceId, type, contactId, startDate = '1970-01-01', endDate = '2099-12-31' } = result.data;

  try {
    await authorizeWorkspace(authReq, workspaceId);
    const db = getDb();

    const contactCollection = type === 'customer' ? 'customers' : 'vendors';
    const contactSnap = await db.collection(contactCollection).doc(contactId).get();
    if (!contactSnap.exists) return sendError(res, "Contact not found", 404);

    const [invSnap, billSnap, paySnap] = await Promise.all([
      db.collection("invoices").where("workspaceId", "==", workspaceId).get(),
      db.collection("bills").where("workspaceId", "==", workspaceId).get(),
      db.collection("payments").where("workspaceId", "==", workspaceId).get()
    ]);

    const invoices = invSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const bills = billSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const payments = paySnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    const statement = computeStatement(
      { id: contactSnap.id, ...contactSnap.data() },
      invoices,
      bills,
      payments,
      startDate,
      endDate,
      type
    );

    res.json(statement);
  } catch (error: any) {
    if (error.message === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (error.message === "NOT_FOUND" || error.message?.includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Failed to generate Statement", 500, error.message);
  }
});

reportRouter.get("/tax-liability", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const result = ReportRangeSchema.safeParse(req.query);
  if (!result.success) return sendError(res, "Invalid parameters", 400, result.error.issues);
  const { workspaceId, startDate, endDate } = result.data;

  try {
    await authorizeWorkspace(authReq, workspaceId);
    const db = getDb();

    const [invSnap, billSnap] = await Promise.all([
      db.collection("invoices").where("workspaceId", "==", workspaceId).get(),
      db.collection("bills").where("workspaceId", "==", workspaceId).get()
    ]);

    const invoices = invSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const bills = billSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    const taxLiability = computeTaxLiability(invoices, bills, startDate, endDate);
    res.json(taxLiability);
  } catch (error: any) {
    if (error.message === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (error.message === "NOT_FOUND" || error.message?.includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Failed to generate Tax Liability report", 500, error.message);
  }
});
