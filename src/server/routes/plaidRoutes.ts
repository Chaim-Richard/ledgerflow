import express from "express";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { getDb } from "../db/firestore.ts";
import { SecurityService } from "../../services/securityService.ts";
import { getLocalDateISO } from "../../lib/utils.ts";

export const plaidRouter = express.Router();

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig);

function sendError(res: express.Response, message: string, status: number = 500, details?: any) {
  console.error(`[API Error] ${status}: ${message} (Path: ${res.req?.originalUrl || "unknown"})`, details || "");
  res.status(status).json({
    status: "error",
    message,
    ...(details && { details })
  });
}

plaidRouter.post("/create_link_token", async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: user?.uid || "anonymous",
      },
      client_name: "LedgerFlow Finance",
      products: ["transactions", "auth"] as any[],
      country_codes: ["US"] as any[],
      language: "en",
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("[Plaid] Create link token error:", error.response?.data || error);
    sendError(res, "Failed to create plaid link token", 500, error.message);
  }
});

plaidRouter.post("/exchange_public_token", async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    const { public_token } = req.body;
    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const { access_token, item_id } = response.data;
    
    // Store encrypted access_token in Firestore associated with the user/workspace
    const db = getDb();
    await db.collection("users").doc(user.uid).collection("banks").add({
      access_token: SecurityService.encryptSensitiveField(access_token),
      item_id,
      createdAt: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Plaid] exchange_public_token error:", error.response?.data || error);
    sendError(res, "Failed to exchange plaid public token", 500, error.message);
  }
});

plaidRouter.post("/sync", async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    const db = getDb();
    
    // Get all banks for the user
    const banksSnap = await db.collection("users").doc(user.uid).collection("banks").get();
    if (banksSnap.empty) {
       return res.json({ transactions: [] });
    }

    let allSyncTransactions: any[] = [];
    
    for (const doc of banksSnap.docs) {
       const rawToken = doc.data().access_token;
       const access_token = SecurityService.decryptSensitiveField(rawToken);
       
       const today = new Date();
       const thirtyDaysAgo = new Date();
       thirtyDaysAgo.setDate(today.getDate() - 30);
       
       const response = await plaidClient.transactionsGet({
         access_token,
         start_date: getLocalDateISO(thirtyDaysAgo),
         end_date: getLocalDateISO(today)
       });
       
       allSyncTransactions = allSyncTransactions.concat(response.data.transactions);
    }
    
    res.json({ transactions: allSyncTransactions });
  } catch (error: any) {
    console.error("[Plaid] sync err:", error.response?.data || error);
    sendError(res, "Failed to sync plaid transactions", 500, error.message);
  }
});
