import express from "express";
import crypto from "crypto";
import type { AutoRule, Transaction as LedgerTransaction } from "../../types";
import { errorMessage } from "../auth/requestUser";
import { authenticate, authorizeWorkspace, sendError } from "../http/serverKit";
import type { AuthenticatedRequest, ServerContext } from "../http/serverKit";
import { getDb } from "../db/firestore";
import { MatchingEngine } from "../../lib/MatchingEngine";

/** Routes moved out of server.ts (F-01), registered in the same place and order. */
export function registerLedgerMatchRoutes(app: express.Express, ctx: ServerContext): void {
  const { matchLimiter } = ctx;
  // Secure Server-Side Transaction Matching Engine API (Competitive Moat / IP Protection)
  app.post("/api/v1/ledger/match", authenticate, matchLimiter, async (req: express.Request, res: express.Response) => {
    try {
      const { descriptions, workspaceId } = req.body;
      if (!workspaceId) return sendError(res, "Missing workspaceId parameters", 400);

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      if (!Array.isArray(descriptions)) {
        return sendError(res, "descriptions must be an array of transaction raw strings", 400);
      }

      const db = getDb();
      
      // Select appropriate parameters from security store
      const rulesSnap = await db.collection("autoRules")
        .where("workspaceId", "==", workspaceId)
        .get();
      const rules = rulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as AutoRule);

      const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
      const wsData = wsDoc.data() || {};
      const analyticalCache = wsData.analyticalTopology?.analyticalPatternCache || {};
      const threshold = wsData.matchingThreshold !== undefined ? wsData.matchingThreshold : 0.85;

      // Fetch finished chronological transaction context elements (first 200 for Bayesian seed)
      const transactionsSnap = await db.collection("transactions")
        .where("workspaceId", "==", workspaceId)
        .limit(200)
        .get();
      const transactions = transactionsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as LedgerTransaction);

      // Dyn Salt Entropy combines Server Secret with client workspace signature to prevent side-channel inference
      const serverSecret = process.env.SESSION_SECRET as string;
      const strongSalt = crypto.createHmac("sha256", serverSecret).update(workspaceId).digest("hex");

      // Server instantiates the full-entropy matching engine
      const engine = new MatchingEngine(rules, analyticalCache, strongSalt, threshold, transactions);

      const matches = descriptions.map(desc => {
        const result = engine.resolveCategory(desc);
        const debug = engine.debugResolveCategory(desc);
        return {
          description: desc,
          resolved: result,
          debugInformation: debug
        };
      });

      res.status(200).json({
        status: "success",
        workspaceId,
        matches
      });
    } catch (err) {
      sendError(res, errorMessage(err), 500);
    }
  });
}
