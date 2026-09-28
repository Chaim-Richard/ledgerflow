import express from "express";
import { z } from "zod";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { getDb, validateWorkspaceMember } from "../db/firestore.ts";
import { SecurityService } from "../../services/securityService.ts";
import { getLocalDateISO } from "../../lib/utils.ts";
import { requireWorkspaceRole } from "./workspaceRoutes.ts";
import { notify } from "../services/notificationService.ts";

/**
 * Bank feeds through Plaid. A connection (collection `banks`) belongs to one workspace: only its
 * owner/accountant/bookkeeper can connect or reconnect it, and a sync returns only that
 * workspace's banks. When a bank asks the user to log in again, the connection is marked
 * `login_required` and the sync carries on with the others; the screen offers "Reconnect"
 * (Plaid update mode).
 */
export const plaidRouter = express.Router();

/** The Plaid calls this router makes (tests swap in a fake). */
export type PlaidClientLike = Pick<PlaidApi, 'linkTokenCreate' | 'itemPublicTokenExchange' | 'transactionsGet'>;

let plaidClient: PlaidClientLike = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
}));

export function setPlaidClientForTests(client: PlaidClientLike) {
  plaidClient = client;
}

type AuthedRequest = express.Request & { user: { uid: string; admin?: boolean; developerWorkspaceId?: string } };

function plaidErrorCode(err: unknown): string | undefined {
  return (err as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
}

function sendError(res: express.Response, message: string, status = 500) {
  res.status(status).json({ status: "error", message });
}

const ledgerWriters = requireWorkspaceRole(['owner', 'accountant', 'bookkeeper']);

const linkTokenSchema = z.object({ workspaceId: z.string().min(1), bankId: z.string().min(1).optional() });

/** A Link token: a new connection, or with bankId the update-mode token to reconnect it. */
plaidRouter.post("/create_link_token", ledgerWriters, async (req, res) => {
  try {
    const { workspaceId, bankId } = linkTokenSchema.parse(req.body);
    const user = (req as AuthedRequest).user;
    let accessToken: string | undefined;
    if (bankId) {
      const bank = (await getDb().collection("banks").doc(bankId).get()).data();
      if (!bank || bank.workspaceId !== workspaceId) return sendError(res, "Bank connection not found", 404);
      accessToken = SecurityService.decryptSensitiveField(bank.access_token);
    }
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.uid },
      client_name: "LedgerFlow",
      country_codes: ["US"] as never[],
      language: "en",
      ...(accessToken ? { access_token: accessToken } : { products: ["transactions"] as never[] }),
    });
    res.json(response.data);
  } catch (error) {
    if (error instanceof z.ZodError) return sendError(res, "workspaceId is required", 400);
    console.error("[Plaid] create_link_token:", plaidErrorCode(error) || error);
    sendError(res, "Could not start the bank connection");
  }
});

const exchangeSchema = z.object({
  workspaceId: z.string().min(1),
  public_token: z.string().min(1),
  accountId: z.string().min(1).optional(),
  institutionName: z.string().max(200).optional(),
});

/** Stores a new connection (encrypted access token) for the workspace. */
plaidRouter.post("/exchange_public_token", ledgerWriters, async (req, res) => {
  try {
    const { workspaceId, public_token, accountId, institutionName } = exchangeSchema.parse(req.body);
    const user = (req as AuthedRequest).user;
    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = response.data;
    const ref = getDb().collection("banks").doc();
    await ref.set({
      workspaceId,
      uid: user.uid,
      access_token: SecurityService.encryptSensitiveField(access_token),
      item_id,
      accountId: accountId || null,
      institutionName: institutionName || '',
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    res.json({ success: true, bankId: ref.id });
  } catch (error) {
    if (error instanceof z.ZodError) return sendError(res, "workspaceId and public_token are required", 400);
    console.error("[Plaid] exchange_public_token:", plaidErrorCode(error) || error);
    sendError(res, "Could not save the bank connection");
  }
});

/** After the user logged in again (update mode): the connection works again. */
plaidRouter.post("/reconnected", ledgerWriters, async (req, res) => {
  try {
    const { workspaceId, bankId } = linkTokenSchema.required({ bankId: true }).parse(req.body);
    const ref = getDb().collection("banks").doc(bankId);
    const bank = (await ref.get()).data();
    if (!bank || bank.workspaceId !== workspaceId) return sendError(res, "Bank connection not found", 404);
    await ref.update({ status: 'active', updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return sendError(res, "workspaceId and bankId are required", 400);
    sendError(res, "Could not update the bank connection");
  }
});

/** The workspace's connections (never the tokens). */
plaidRouter.get("/banks", async (req, res) => {
  try {
    const workspaceId = String(req.query.workspaceId || '');
    if (!workspaceId) return sendError(res, "workspaceId is required", 400);
    const db = getDb();
    await validateWorkspaceMember(db, workspaceId, (req as AuthedRequest).user);
    const snap = await db.collection("banks").where("workspaceId", "==", workspaceId).get();
    res.json({ banks: snap.docs.map(d => ({ id: d.id, institutionName: d.data().institutionName || '', accountId: d.data().accountId || null, status: d.data().status || 'active', createdAt: d.data().createdAt })) });
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : "Could not list bank connections", 403);
  }
});

const syncSchema = z.object({ workspaceId: z.string().min(1), accountId: z.string().min(1).optional() });

/** Last 30 days of transactions from this workspace's connections (optionally one bank account). */
plaidRouter.post("/sync", async (req, res) => {
  let body: z.infer<typeof syncSchema>;
  try {
    body = syncSchema.parse(req.body);
  } catch {
    return sendError(res, "workspaceId is required", 400);
  }
  try {
    const db = getDb();
    await validateWorkspaceMember(db, body.workspaceId, (req as AuthedRequest).user);
    let query = db.collection("banks").where("workspaceId", "==", body.workspaceId);
    if (body.accountId) query = query.where("accountId", "==", body.accountId);
    const banksSnap = await query.get();

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const transactions: unknown[] = [];
    const needsReconnect: { bankId: string; institutionName: string }[] = [];
    for (const doc of banksSnap.docs) {
      const bank = doc.data();
      try {
        const response = await plaidClient.transactionsGet({
          access_token: SecurityService.decryptSensitiveField(bank.access_token),
          start_date: getLocalDateISO(thirtyDaysAgo),
          end_date: getLocalDateISO(today),
        });
        transactions.push(...response.data.transactions);
        if (bank.status === 'login_required') await doc.ref.update({ status: 'active', updatedAt: new Date().toISOString() });
      } catch (err) {
        if (plaidErrorCode(err) !== 'ITEM_LOGIN_REQUIRED') throw err;
        needsReconnect.push({ bankId: doc.id, institutionName: bank.institutionName || '' });
        const now = new Date().toISOString();
        await doc.ref.update({ status: 'login_required', updatedAt: now });
        if (bank.status !== 'login_required') {
          const name = bank.institutionName || 'A bank';
          await notify(db, {
            workspaceId: body.workspaceId, kind: 'bank.disconnected',
            title: `${name} needs to be reconnected`,
            message: `The bank login expired, so new bank lines can't be downloaded. Open Banking and choose Reconnect.`,
            eventKey: `bank.disconnected:${doc.id}:${now}`, recordId: doc.id, actorUid: (req as AuthedRequest).user?.uid,
          });
        }
      }
    }
    res.json({ success: transactions.length > 0, transactions, needsReconnect, banks: banksSnap.size });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/not a member|Unauthorized|not found/i.test(message)) return sendError(res, message, 403);
    console.error("[Plaid] sync:", plaidErrorCode(error) || error);
    sendError(res, "Could not sync the bank feed");
  }
});
