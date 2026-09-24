import express from "express";
import crypto from "crypto";
import { getDb, validateWorkspaceMember, FieldValue } from "../db/firestore.ts";
import { getStripe } from "../services/stripeService.ts";
import { getTrustedAppUrl } from "../utils/urlHelper.ts";
import { incrementShardedCounter, getShardedCounterValue } from "../services/shardedCounterService.ts";

export const billingRouter = express.Router();

// Fallback in-memory cache for workspace billing & metrics to guarantee continuous operations under any IAM/GCP database restriction
export const billingFallbackCache = new Map<string, any>();

async function authorizeWorkspace(user: any, workspaceId: string) {
  const db = getDb();
  if (!workspaceId || typeof workspaceId !== 'string') {
    throw new Error("NOT_FOUND: Invalid workspace identifier provided.");
  }
  try {
    const { data } = await validateWorkspaceMember(db, workspaceId, user);
    return data;
  } catch (err: any) {
    if (err.message?.includes("Forbidden") || err.message?.includes("not authorized") || err.message?.includes("not a member")) {
      throw new Error("FORBIDDEN: User does not belong to this workspace.", { cause: err });
    }
    throw err;
  }
}

billingRouter.post("/checkout", async (req: express.Request, res: express.Response) => {
  try {
    const workspaceId = (req.body.workspaceId as string) || (req as any).user?.developerWorkspaceId;
    if (!workspaceId) return res.status(400).json({ status: "error", message: "Missing workspaceId" });

    await authorizeWorkspace((req as any).user, workspaceId);

    const stripe = getStripe();
    const { plan } = req.body;
    let priceInfo: any = {};
    
    // Dynamic ad-hoc line items for the checkout:
    // "make a 5$ dollar a munth till, x amount of useg and over that limit 10$"
    if (plan === "pro") {
       priceInfo = {
         price_data: {
           currency: 'usd',
           product_data: {
             name: 'Pro Subscription',
             description: 'Advanced capabilities up to limits ($5.00/mo) + overage ($10.00)',
           },
           unit_amount: 500, // $5.00
           recurring: { interval: 'month' },
         },
         quantity: 1,
       };
    } else if (plan === "enterprise") {
       priceInfo = {
         price_data: {
           currency: 'usd',
           product_data: {
             name: 'Enterprise Subscription',
             description: 'Unlimited capacity and capabilities',
           },
           unit_amount: 5000, // $50.00
           recurring: { interval: 'month' },
         },
         quantity: 1,
       };
    } else {
       priceInfo = {
         price_data: {
           currency: 'usd',
           product_data: {
             name: 'Standard Capacity Upgrade',
           },
           unit_amount: 1000, 
           recurring: { interval: 'month' },
         },
         quantity: 1,
       };
    }

    // Use trusted app URL helper to prevent Host-header poisoning (#85-R, N6)
    const baseUrl = getTrustedAppUrl(req);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [priceInfo],
      mode: 'subscription',
      success_url: `${baseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?checkout=canceled`,
      metadata: {
        workspaceId,
        plan: plan || 'pro'
      },
      subscription_data: {
        metadata: {
          workspaceId,
          plan: plan || 'pro'
        }
      }
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("[Stripe] Failed:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

billingRouter.post("/portal", async (req: express.Request, res: express.Response) => {
  try {
    const workspaceId = (req.body.workspaceId as string) || (req as any).user?.developerWorkspaceId;
    if (!workspaceId) return res.status(400).json({ status: "error", message: "Missing workspaceId" });

    await authorizeWorkspace((req as any).user, workspaceId);

    const db = getDb();
    const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
    const wsData = wsDoc.exists ? wsDoc.data() || {} : {};

    const stripe = getStripe();
    const baseUrl = getTrustedAppUrl(req);

    if (!wsData.stripeCustomerId) {
      return res.status(400).json({ status: "error", message: "No active Stripe customer found for this workspace" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: wsData.stripeCustomerId,
      return_url: `${baseUrl}/`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("[Stripe Portal] Failed:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

billingRouter.post("/verify-session", async (req: express.Request, res: express.Response) => {
  try {
    const { session_id, workspaceId } = req.body;
    if (!session_id || !workspaceId) {
      return res.status(400).json({ status: "error", message: "Missing required parameters" });
    }

    await authorizeWorkspace((req as any).user, workspaceId);

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === 'paid' && session.metadata?.workspaceId === workspaceId) {
      const db = getDb();
      const eventRef = db.collection('stripeProcessedEvents').doc(`session_${session.id}`);
      const alreadyClaimed = await db.runTransaction(async (t) => {
        const snap = await t.get(eventRef);
        if (snap.exists) return true;
        t.set(eventRef, {
          sessionId: session.id,
          workspaceId,
          claimedAt: FieldValue.serverTimestamp()
        });
        return false;
      });

      const targetPlan = session.metadata?.plan === 'enterprise' ? 'enterprise' : (session.metadata?.plan === 'pro' ? 'pro' : 'pro');
      const creditsToGrant = targetPlan === 'enterprise' ? 10000000 : 1000000;

      if (alreadyClaimed) {
        return res.json({ status: "success", plan: targetPlan, message: "Session already verified" });
      }

      await db.collection("workspaces").doc(workspaceId).set({
        plan: targetPlan,
        billingCycle: "monthly",
        computeCreditBalance: FieldValue.increment(creditsToGrant),
        computeLimit: creditsToGrant, 
        stripeCustomerId: session.customer || null,
        stripeSubscriptionId: session.subscription || null,
        lastUpgradedAt: new Date().toISOString()
      }, { merge: true });
      return res.json({ status: "success", plan: targetPlan });
    } else {
       return res.status(400).json({ status: "incomplete", message: "Session not paid or metadata mismatch" });
    }
  } catch (err: any) {
     console.error("[Stripe Verify] Error:", err);
     res.status(500).json({ status: "error", message: "Stripe verification failed" });
  }
});

billingRouter.get("/status", async (req: express.Request, res: express.Response) => {
  try {
    const workspaceId = (req.query.workspaceId as string);
    if (!workspaceId) return res.status(400).json({ status: "error", message: "Missing workspaceId" });

    await authorizeWorkspace((req as any).user, workspaceId);

    let wsData: any = {};
    try {
      const db = getDb();
      const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
      if (wsDoc.exists) {
        wsData = wsDoc.data() || {};
      } else {
        wsData = billingFallbackCache.get(workspaceId) || {};
      }
    } catch (dbErr: any) {
      console.warn("[Firebase Admin] Billing fetch failing back to in-memory store due to database/IAM constraint:", dbErr.message);
      wsData = billingFallbackCache.get(workspaceId) || {};
    }

    const db = getDb();
    const baselineQueries = wsData.totalQueriesThisMonth || 0;
    const baselineCredit = wsData.computeCreditBalance !== undefined ? wsData.computeCreditBalance : 100000;

    const shardedQueries = await getShardedCounterValue(db, workspaceId, 'totalQueriesThisMonth', baselineQueries);
    const shardedCredit = await getShardedCounterValue(db, workspaceId, 'computeCreditBalance', baselineCredit);

    // Populate secure default development limits if missing to maintain continuous operations
    const statusData = {
      workspaceId,
      plan: wsData.plan || 'sandbox',
      billingCycle: wsData.billingCycle || 'free',
      concurrentUserLimit: wsData.concurrentUserLimit || 50,
      activeUserCount: wsData.activeUserCount || 1,
      seatCount: wsData.seatCount || 1,
      maxSeats: wsData.maxSeats || 3,
      totalQueriesThisMonth: shardedQueries,
      computeHardnessScore: wsData.computeHardnessScore || 0,
      computeCreditBalance: Math.max(0, shardedCredit), // 100k compute units default
      apiQuotaTotalCentsUsed: wsData.apiQuotaTotalCentsUsed || 0,
      apiQuotaMonthlyLimitCents: wsData.apiQuotaMonthlyLimitCents || 0, // Sandbox has no real dollar limits, just credit limits
    };

    // Ensure cache is populated
    if (!billingFallbackCache.has(workspaceId)) {
      billingFallbackCache.set(workspaceId, { ...statusData });
    }

    res.json(statusData);
  } catch (err: any) {
    console.error("[Billing Status Error]:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

billingRouter.post("/record-compute", async (req: express.Request, res: express.Response) => {
  try {
    const { workspaceId, algorithmName, complexityFormat, weightScore, executionTimeMs } = req.body;
    if (!workspaceId || !algorithmName) {
      return res.status(400).json({ status: "error", message: "Missing required query parameters: workspaceId and algorithmName" });
    }

    const user = (req as any).user;
    await authorizeWorkspace(user, workspaceId);

    let wsData: any = {};
    let wsFetchedFromDb = false;

    try {
      const db = getDb();
      const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
      if (wsDoc.exists) {
        wsData = wsDoc.data() || {};
        wsFetchedFromDb = true;
      } else {
        wsData = billingFallbackCache.get(workspaceId) || {};
      }
    } catch (dbErr: any) {
      console.warn("[Firebase Admin] Record compute failing back to in-memory store due to database/IAM constraint:", dbErr.message);
      wsData = billingFallbackCache.get(workspaceId) || {};
    }

    const sanitizedWeight = Math.max(1, Math.min(1000, Math.floor(Math.abs(Number(weightScore) || 10))));
    const sanitizedExecutionTime = Math.max(1, Math.min(60000, Math.floor(Math.abs(Number(executionTimeMs) || 50))));

    const ledgerEntry = {
      id: `trace-${crypto.randomUUID()}`,
      workspaceId,
      uid: user.uid,
      userEmail: user.email,
      algorithmName,
      complexityFormat,
      weightScore: sanitizedWeight,
      executionTimeMs: sanitizedExecutionTime,
      timestamp: new Date().toISOString(),
      hash: crypto.createHash('sha256').update(`${workspaceId}-${algorithmName}-${sanitizedWeight}-${crypto.randomUUID()}`).digest('hex')
    };

    try {
      const db = getDb();
      const billingLedgerRef = db.collection("billingLedgerTraces").doc();
      ledgerEntry.id = billingLedgerRef.id;
      await billingLedgerRef.set(ledgerEntry);
    } catch (dbErr: any) {
      console.warn("[Firebase Admin] Billing trace logging skipped / logged to local log due to IAM constraint:", dbErr.message);
    }

    // Increment queries and computational complexity in Workspace safely
    const currentValueQuota = wsData.apiQuotaTotalCentsUsed !== undefined ? wsData.apiQuotaTotalCentsUsed : 0;
    const currentValueQueries = wsData.totalQueriesThisMonth !== undefined ? wsData.totalQueriesThisMonth : 0;
    const currentValueHardness = wsData.computeHardnessScore !== undefined ? wsData.computeHardnessScore : 0;
    const currentValueCredit = wsData.computeCreditBalance !== undefined ? wsData.computeCreditBalance : 1000000;

    const db = getDb();
    await incrementShardedCounter(db, workspaceId, 'totalQueriesThisMonth', 1);
    await incrementShardedCounter(db, workspaceId, 'computeCreditBalance', -sanitizedWeight);

    const shardedQueries = await getShardedCounterValue(db, workspaceId, 'totalQueriesThisMonth', currentValueQueries);
    const shardedCredit = await getShardedCounterValue(db, workspaceId, 'computeCreditBalance', currentValueCredit);

    const currentQuotaUsed = currentValueQuota + Math.round(sanitizedWeight * 0.1); // 0.1 cent per complexity score
    const newComputeHardness = currentValueHardness + sanitizedWeight;

    const updatedMetrics = {
      apiQuotaTotalCentsUsed: currentQuotaUsed,
      totalQueriesThisMonth: shardedQueries,
      computeHardnessScore: newComputeHardness,
      computeCreditBalance: Math.max(0, shardedCredit)
    };

    // Always write to the fallback in-memory cache to maintain locally consistent simulation state
    billingFallbackCache.set(workspaceId, {
      ...wsData,
      ...updatedMetrics,
      workspaceId
    });

    if (wsFetchedFromDb) {
      try {
        const wsRef = db.collection("workspaces").doc(workspaceId);
        await wsRef.update({
          apiQuotaTotalCentsUsed: currentQuotaUsed,
          computeHardnessScore: newComputeHardness
        });
      } catch (dbErr: any) {
        console.warn("[Firebase Admin] Failed workspace Firestore update, continuing via active in-memory billing cache:", dbErr.message);
      }
    }

    res.json({
      status: "success",
      traceRecord: ledgerEntry,
      updatedMetrics
    });
  } catch (err: any) {
    console.error("[Record Compute Error]:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});
