import { errorMessage, requestUser } from '../auth/requestUser';
import express from "express";
import type { DecodedIdToken } from "../auth/supabaseAuth";
import type { DocumentData, Query } from "../db/firestore";
import { z } from "zod";
import { getDb, validateWorkspaceMember } from "../db/firestore";
import { isOpenBill, isOpenInvoice, isPostable, lineAmount } from "../../lib/txFilters";
import { ReportRangeSchema, WorkspaceIdSchema } from "../../schemas";
import { getLocalDateISO } from "../../lib/utils";
import crypto from "crypto";
import {
  computeProfitAndLoss,
  computeBalanceSheet,
  computeTrialBalance,
  computeCashFlow,
  computeGeneralLedger,
  computeStatement
} from "../reports/computeReports";
import type { Bill, Budget, ChartAccount, CreditNote, Customer, Invoice, Payment, Transaction as LedgerTransaction, VendorCredit } from "../../types";
import { agingBucket, daysOverdue, outstandingBaseCents } from '../../lib/aging';
import { GroupReportError, groupSummary } from '../reports/groupReport';
import { profitByLabel } from '../reports/byLabel';
import { cashBasisBalanceSheet, cashBasisEntries, type CashBasisPayment } from '../reports/cashBasis';
import { explainFigure } from '../reports/explain';
import { stockMovesReady } from '../services/stockMoveService';
import { itemDetails, stockAging, type StockMove } from '../../lib/stockMoves';

export const reportRouter = express.Router();

const REPORT_CACHE = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 60000; // 60 seconds

function getCacheKey(req: express.Request): string {
  const payload = JSON.stringify({ path: req.path, query: req.query, body: req.body, user: requestUser(req)?.uid });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

interface AuthUser extends DecodedIdToken {
  email_verified: boolean;
}

interface AuthenticatedRequest extends express.Request {
  user: AuthUser;
}

function sendError(res: express.Response, message: string, status: number = 500, details?: unknown) {
  console.error(`[API Error] ${status}: ${message} (Path: ${res.req?.originalUrl || "unknown"})`, details || "");
  res.status(status).json({
    status: "error",
    message,
    ...(details ? { details } : {})
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
  
  let txQuery: Query = db.collection("transactions").where("workspaceId", "==", workspaceId);
  if (startDate) {
    txQuery = txQuery.where("date", ">=", startDate);
  }
  if (endDate) {
    txQuery = txQuery.where("date", "<=", endDate);
  }
  
  const transactions: LedgerTransaction[] = [];
  const txStream = txQuery.stream();
  
  // the row's own id: a restored entry's data does not repeat it (DA-07)
  for await (const chunk of txStream as AsyncIterable<{ id: string; data: () => DocumentData }>) {
    transactions.push({ ...chunk.data(), id: chunk.id } as LedgerTransaction);
  }
  
  return {
    accounts: accountsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ChartAccount),
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
    // N-08: on cash basis, invoices and bills count when paid (cashBasis.ts): their postings may be
    // older than the period, so the whole history up to the end is read, with the payments
    if (req.query.basis === 'cash') {
      const { accounts, transactions } = await getReportContext(authReq, workspaceId, undefined, endDate || undefined);
      const payments = (await getDb().collection('payments').where('workspaceId', '==', workspaceId).get()).docs.map(d => ({ ...d.data(), id: d.id }) as CashBasisPayment);
      const { entries, leftOut } = cashBasisEntries(accounts, transactions, payments);
      const pl = { ...computeProfitAndLoss(accounts, entries, startDate, endDate), basis: 'cash', leftOut };
      REPORT_CACHE.set(cacheKey, { data: pl, expiry: Date.now() + CACHE_TTL_MS });
      return res.json(pl);
    }
    const { accounts, transactions } = await getReportContext(authReq, workspaceId, startDate, endDate);
    const pl = computeProfitAndLoss(accounts, transactions, startDate, endDate);
    REPORT_CACHE.set(cacheKey, { data: pl, expiry: Date.now() + CACHE_TTL_MS });
    res.json(pl);
  } catch (error) {
    if (errorMessage(error) === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (errorMessage(error) === "NOT_FOUND" || errorMessage(error).includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Internal Reporting Error", 500, errorMessage(error));
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
    // N-08: on cash basis, without trade receivables and payables (cashBasis.ts)
    if (req.query.basis === 'cash') {
      const payments = (await getDb().collection('payments').where('workspaceId', '==', workspaceId).get()).docs.map(d => ({ ...d.data(), id: d.id }) as CashBasisPayment);
      const cashBs = cashBasisBalanceSheet(accounts, transactions, payments, endDate || undefined);
      REPORT_CACHE.set(cacheKey, { data: cashBs, expiry: Date.now() + CACHE_TTL_MS });
      return res.json(cashBs);
    }
    const bs = computeBalanceSheet(accounts, transactions, endDate);
    REPORT_CACHE.set(cacheKey, { data: bs, expiry: Date.now() + CACHE_TTL_MS });
    res.json(bs);
  } catch (error) {
    if (errorMessage(error) === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (errorMessage(error) === "NOT_FOUND" || errorMessage(error).includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Internal Reporting Error", 500, errorMessage(error));
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

    let items = snap.docs.map((doc) => doc.data() as Invoice | Bill);
    
    // open documents only (approved bills too; drafts, void, cancelled and paid are not owed)
    items = items.filter(item => (type === 'ar' ? isOpenInvoice(item) : isOpenBill(item)));
    const aging = {
      current: 0,
      "1-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
      total: 0
    };

    // the same rule as the aging screens (src/lib/aging.ts): what is still owed, base currency, by due date
    const side = type === 'ar' ? 'customer' : 'vendor';
    const keyOf = { current: 'current', d1_30: '1-30', d31_60: '31-60', d61_90: '61-90', d90plus: '90+' } as const;
    const todayIso = getLocalDateISO();
    items.forEach((item) => {
      const outstanding = outstandingBaseCents(item, side);
      if (outstanding <= 0) return;
      aging[keyOf[agingBucket(daysOverdue(item, todayIso))]] += outstanding;
      aging.total += outstanding;
    });

    res.json(aging);
  } catch (error) {
    if (errorMessage(error) === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (errorMessage(error) === "NOT_FOUND" || errorMessage(error).includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Failed to generate aging report", 500, errorMessage(error));
  }
});

/**
 * N-12: explain this number. The lines behind a report figure (accounts, period, optional label),
 * from the full history, adding up to the figure (explain.ts), with each line's document, bank match
 * and attached files.
 */
/**
 * J-10: inventory item details for a period, from the stock-moves ledger (every change to each item's
 * quantity, written by the server with the change): opening, each movement, closing. Any member reads.
 */
reportRouter.get("/inventory-details", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const parsed = z.object({ workspaceId: z.string().min(1).max(200), startDate: day, endDate: day }).safeParse(req.query);
  if (!parsed.success || parsed.data.startDate > parsed.data.endDate) return sendError(res, "Say the workspace and the period (from before to)", 400);
  const q = parsed.data;
  try {
    const db = getDb();
    await validateWorkspaceMember(db, q.workspaceId, authReq.user);
    if (!(await stockMovesReady(db))) return sendError(res, "Stock history is not set up in this database yet", 503);
    const moves = (await db.collection('stockMoves').where('workspaceId', '==', q.workspaceId).where('date', '<=', q.endDate).get()).docs.map(d => ({ ...d.data(), id: d.id }) as StockMove);
    res.json({ startDate: q.startDate, endDate: q.endDate, items: itemDetails(moves, q.startDate, q.endDate) });
  } catch (error) {
    if (/not a member|Unauthorized|FORBIDDEN/i.test(errorMessage(error))) return sendError(res, "Forbidden", 403);
    if (/not found/i.test(errorMessage(error))) return sendError(res, "Workspace not found", 404);
    sendError(res, "Could not read the stock history", 500, errorMessage(error));
  }
});

/** W-09: how old the stock on hand is, item by item, from the stock-moves ledger (stockMoves.ts `stockAging`). */
reportRouter.get("/stock-aging", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const parsed = z.object({ workspaceId: z.string().min(1).max(200), asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(req.query);
  if (!parsed.success) return sendError(res, "Say the workspace and the day (YYYY-MM-DD)", 400);
  const q = parsed.data;
  try {
    const db = getDb();
    await validateWorkspaceMember(db, q.workspaceId, authReq.user);
    if (!(await stockMovesReady(db))) return sendError(res, "Stock history is not set up in this database yet", 503);
    const moves = (await db.collection('stockMoves').where('workspaceId', '==', q.workspaceId).where('date', '<=', q.asOf).get()).docs.map(d => ({ ...d.data(), id: d.id }) as StockMove);
    res.json({ asOf: q.asOf, items: stockAging(moves, q.asOf) });
  } catch (error) {
    if (/not a member|Unauthorized|FORBIDDEN/i.test(errorMessage(error))) return sendError(res, "Forbidden", 403);
    if (/not.found/i.test(errorMessage(error))) return sendError(res, "Workspace not found", 404);
    sendError(res, "Could not read the stock history", 500, errorMessage(error));
  }
});

reportRouter.get("/explain", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const parsed = z.object({
    workspaceId: z.string().min(1), accountIds: z.string().min(1).max(4000), startDate: day.optional(), endDate: day.optional(),
    labelDimension: z.string().max(100).optional(), labelValue: z.string().max(200).optional(),
  }).safeParse(req.query);
  if (!parsed.success) return sendError(res, "Say which accounts and which period", 400, parsed.error.issues);
  const q = parsed.data;
  try {
    const { accounts, transactions } = await getReportContext(authReq, q.workspaceId, undefined, q.endDate);
    const explanation = explainFigure(accounts, transactions, {
      accountIds: q.accountIds.split(',').filter(Boolean), ...(q.startDate ? { startDate: q.startDate } : {}), ...(q.endDate ? { endDate: q.endDate } : {}),
      ...(q.labelDimension && q.labelValue ? { label: { dimensionId: q.labelDimension, value: q.labelValue } } : {}),
    });
    // attached files, counted without reading them
    const documentIds = [...new Set(explanation.lines.map(l => l.document?.type !== 'transaction' ? l.document?.id : undefined).filter((x): x is string => Boolean(x)))];
    if (documentIds.length > 0) {
      const { rows } = await getDb().pool.query(`select data->>'linkedId' as id, count(*)::int as n from public.documents where workspace_id = $1 and data->>'linkedId' = any($2) group by 1`, [q.workspaceId, documentIds]);
      const counts = new Map(rows.map(r => [String(r.id), Number(r.n)]));
      for (const line of explanation.lines) if (line.document) line.attachments = counts.get(line.document.id) || 0;
    }
    res.json(explanation);
  } catch (error) {
    if (/not a member|Unauthorized|FORBIDDEN/i.test(errorMessage(error))) return sendError(res, "Forbidden", 403);
    if (/not found/i.test(errorMessage(error))) return sendError(res, "Workspace not found", 404);
    sendError(res, "Could not explain this number", 500, errorMessage(error));
  }
});

/** CB-25: the profit and loss split by the values of one label, adding back to the P&L (byLabel.ts). */
reportRouter.get("/by-label", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const parsed = z.object({ workspaceId: z.string().min(1).max(200), dimensionId: z.string().min(1).max(100), startDate: day, endDate: day }).safeParse(req.query);
  if (!parsed.success || parsed.data.startDate > parsed.data.endDate) return sendError(res, "Choose a label and the period (from before to)", 400);
  const q = parsed.data;
  try {
    const { accounts, transactions } = await getReportContext(authReq, q.workspaceId, q.startDate, q.endDate);
    res.json(profitByLabel(accounts, transactions, q.dimensionId, q.startDate, q.endDate));
  } catch (error) {
    if (/not a member|Unauthorized|FORBIDDEN/i.test(errorMessage(error))) return sendError(res, "Forbidden", 403);
    if (/not.found/i.test(errorMessage(error))) return sendError(res, "Workspace not found", 404);
    sendError(res, "Could not make the report by label", 500, errorMessage(error));
  }
});

/** Z-20: one of the person's groups of books, each member side by side and the total (groupReport.ts). */
reportRouter.get("/group-summary", async (req, res) => {
  const parsed = z.object({
    groupId: z.string().min(1).max(100), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // Z-17: translate into one currency, with rates as JSON { "EUR": { "closing": 1.1, "average": 1.08, "historical": 1.05 } }
    reportCurrency: z.string().regex(/^[A-Z]{3}$/).optional(), rates: z.string().max(5000).optional(),
    // Z-20: account by account as well
    detail: z.enum(['accounts']).optional(),
  }).safeParse(req.query);
  if (!parsed.success) return sendError(res, "Choose a group and the period (YYYY-MM-DD)", 400, parsed.error.issues);
  let rates: Record<string, { closing: number; average: number; historical: number }> | undefined;
  try {
    rates = parsed.data.rates ? z.record(z.string().regex(/^[A-Z]{3}$/), z.object({ closing: z.number(), average: z.number(), historical: z.number() })).parse(JSON.parse(parsed.data.rates)) : undefined;
  } catch {
    return sendError(res, "The rates could not be read", 400);
  }
  const user = requestUser(req);
  // an API key belongs to one workspace: a group report is for people
  if (user.developerWorkspaceId) return sendError(res, "Group reports are not available with an API key", 403);
  try {
    res.json(await groupSummary(getDb(), { uid: user.uid, ...parsed.data, rates }));
  } catch (error) {
    if (error instanceof GroupReportError) return sendError(res, error.message, error.status);
    sendError(res, "Could not make the group summary", 500, errorMessage(error));
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
  } catch (error) {
    if (errorMessage(error) === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (errorMessage(error) === "NOT_FOUND" || errorMessage(error).includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Trial Balance Failure", 500, errorMessage(error));
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
  } catch (error) {
    if (errorMessage(error) === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (errorMessage(error) === "NOT_FOUND" || errorMessage(error).includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Failed to generate cash flow statement", 500, errorMessage(error));
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

    let txQuery: Query = db.collection("transactions").where("workspaceId", "==", workspaceId);
    
    const targetMonth = month ? String(month) : getLocalDateISO(new Date()).substring(0, 7);
    const { startDate: mStart, endDate: mEnd } = calculateMonthDateRange(targetMonth);
    txQuery = txQuery.where("date", ">=", mStart).where("date", "<=", mEnd);

    const [budgetsSnap, accountsSnap] = await Promise.all([
      db.collection("budgets").where("workspaceId", "==", workspaceId).get(),
      db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get()
    ]);

    let transactions: LedgerTransaction[] = [];
    await new Promise<void>((resolve, reject) => {
      txQuery.stream()
        .on("data", (doc: { id: string; data: () => DocumentData }) => transactions.push({ ...doc.data(), id: doc.id } as LedgerTransaction))
        .on("end", () => resolve())
        .on("error", async (err: unknown) => {
          try {
            const snap = await txQuery.get();
            transactions = snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as LedgerTransaction);
            resolve();
          } catch {
            reject(err);
          }
        });
    });

    // Budgets name their account in targetId (by id, name or code, as Budgets → BudgetManager
    // shows them); older budgets used accountId.
    const budgets = budgetsSnap.docs.map((doc) => doc.data() as Budget & { accountId?: string });
    const accounts = accountsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ChartAccount);

    transactions = transactions.filter(tx => tx.date && tx.date.startsWith(targetMonth));

    const report = budgets.map((b) => {
      const target = b.targetId || b.accountId || '';
      const targetLower = target.toLowerCase();
      const account = accounts.find(a =>
        a.id === target || (a.name || '').toLowerCase() === targetLower || (a.code || '').toLowerCase() === targetLower);
      let actual = 0;
      transactions.forEach((tx) => {
        if (!isPostable(tx)) return;
        tx.lines?.forEach((line) => {
          if (line.accountId === target || (account && line.accountId === account.id)) {
            actual += Math.max(0, lineAmount(line, tx));
          }
        });
      });

      return {
        accountName: account?.name || target || 'Unknown',
        budget: b.amountCents,
        actual,
        variance: b.amountCents - actual,
        percent: b.amountCents > 0 ? (actual / b.amountCents) * 100 : 0
      };
    });

    res.json(report);
  } catch (error) {
    if (errorMessage(error) === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (errorMessage(error) === "NOT_FOUND" || errorMessage(error).includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Failed to generate budget vs actual report", 500, errorMessage(error));
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
  } catch (error) {
    if (errorMessage(error) === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (errorMessage(error) === "NOT_FOUND" || errorMessage(error).includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Failed to generate General Ledger report", 500, errorMessage(error));
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

    const [invSnap, billSnap, paySnap, creditSnap] = await Promise.all([
      db.collection("invoices").where("workspaceId", "==", workspaceId).get(),
      db.collection("bills").where("workspaceId", "==", workspaceId).get(),
      db.collection("payments").where("workspaceId", "==", workspaceId).get(),
      db.collection(type === 'customer' ? "creditNotes" : "vendorCredits").where("workspaceId", "==", workspaceId).get()
    ]);

    const invoices = invSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Invoice);
    const bills = billSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bill);
    const payments = paySnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment);

    const statement = computeStatement(
      { id: contactSnap.id, ...contactSnap.data() } as unknown as Customer,
      invoices,
      bills,
      payments,
      startDate,
      endDate,
      type,
      creditSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as CreditNote | VendorCredit)
    );

    res.json(statement);
  } catch (error) {
    if (errorMessage(error) === "FORBIDDEN") return sendError(res, "Forbidden", 403);
    if (errorMessage(error) === "NOT_FOUND" || errorMessage(error).includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
    sendError(res, "Failed to generate Statement", 500, errorMessage(error));
  }
});

