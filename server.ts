import type { Transaction as LedgerTransaction } from "./src/types.ts";
import { registerWorkspaceApiRoutes } from "./src/server/routes/workspaceApiRoutes.ts";
import { registerDeveloperApiRoutes } from "./src/server/routes/developerApiRoutes.ts";
import { registerApiKeysRoutes } from "./src/server/routes/apiKeysRoutes.ts";
import { registerMetricsAuditRoutes } from "./src/server/routes/metricsAuditRoutes.ts";
import { registerBrainRoutes } from "./src/server/routes/brainRoutes.ts";
import { registerAdminRoutes } from "./src/server/routes/adminRoutes.ts";
import { registerLogsUploadRoutes } from "./src/server/routes/logsUploadRoutes.ts";
import { registerLabelingRoutes } from "./src/server/routes/labelingRoutes.ts";
import { registerAuthRoutes } from "./src/server/routes/authRoutes.ts";
import { errorMessage, requestUser } from "./src/server/auth/requestUser.ts";
import { globalAdminConfig, syncGlobalAdminConfig, sendError, authorizeWorkspace, authenticate, optionalAuthenticate } from "./src/server/http/serverKit.ts";
import type { ApiLog, AuthenticatedRequest, ServerContext } from "./src/server/http/serverKit.ts";
import { apiAuthenticate } from "./src/server/auth/apiAuthenticate.ts";
import { fxRouter } from "./src/server/routes/fxRoutes";
import { aiRouter } from "./src/server/routes/aiRoutes";
import { reportRouter } from "./src/server/routes/reportRoutes";
import { accountRouter } from "./src/server/routes/accountRoutes";
import { workspaceRouter } from "./src/server/routes/workspaceRoutes";
import { invitePublicRouter } from "./src/server/routes/invitePublicRoutes";
import { emailWebhookRouter } from "./src/server/routes/emailRoutes";
import { publicInvoiceRouter } from "./src/server/routes/publicInvoiceRoutes";
import { transactionRouter } from "./src/server/routes/transactionRoutes";
import { revenueRouter } from "./src/server/routes/revenueRoutes";
import { consolidationRouter } from "./src/server/routes/consolidationRoutes";
import { leaseRouter } from "./src/server/routes/leaseRoutes";
import { inventoryRouter } from "./src/server/routes/inventoryRoutes";
import { supportRouter } from "./src/server/routes/supportRoutes";
import { paymentRouter } from "./src/server/routes/paymentRoutes";
import { documentRouter } from "./src/server/routes/documentRoutes";
import { mathRouter } from "./src/server/routes/mathRoutes";
import { plaidRouter } from "./src/server/routes/plaidRoutes";
import { billingRouter } from "./src/server/routes/billingRoutes";
import { getStripe } from "./src/server/services/stripeService";
export { getStripe };
import { assertStartupConfig } from "./src/server/config/assertStartupConfig";
import { logger } from "./src/server/utils/logger";
import { recordStripeInvoicePayment } from "./src/server/services/onlinePaymentService";
import express from "express";
import { currencyRouter, taxDataRouter } from "./src/server/routes/externalDataRoutes.ts";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { z } from "zod";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import crypto from "crypto";
import { rateLimit as expressRateLimit } from "express-rate-limit";
import { SecurityService } from "./src/services/securityService.ts";
import { ErrorTelemetrySchema } from "./src/schemas.ts";
import { MatchingEngine } from "./src/lib/MatchingEngine.ts";
import { assertWorkspaceAccess, getDb, FieldValue } from "./src/server/db/firestore.ts";
import { cronRouter } from "./src/server/routes/cronRoutes.ts";
import { statusRouter } from "./src/server/routes/statusRoutes.ts";
import { runDailyMaintenance } from "./src/server/services/maintenanceService.ts";
import { verifyIdToken, supabaseUrl } from "./src/server/auth/supabaseAuth.ts";

import { processAllRecurring } from "./src/server/services/recurringService.ts";
import { processErrorDigest } from "./src/server/services/errorDigestService.ts";
import { csrfProtection } from "./src/server/middleware/csrf.ts";

import { 
  publicInvoiceLimiter, 
  pdfGenerationLimiter, 
  brainRateLimiter 
} from "./src/server/middleware/rateLimiters.ts";

dotenv.config();


// --- Environment Validation ---
// Determine default NODE_ENV: fail-safe to "production" unless explicitly set to "development" or running ts source directly
const isTsSourceRun = Boolean(process.argv[1]?.endsWith(".ts"));
const defaultNodeEnv = process.env.NODE_ENV || (isTsSourceRun ? "development" : "production");
process.env.NODE_ENV = defaultNodeEnv;

if (process.env.NODE_ENV !== "production") {
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dev_dummy_stripe_key_12345";
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || "dev_session_secret_32bytes_long_123456789";
  process.env.CURRENCY_API_KEY = process.env.CURRENCY_API_KEY || "dev_currency_api_key_12345";
  process.env.TAX_API_KEY = process.env.TAX_API_KEY || "dev_tax_api_key_12345";
  process.env.SYSTEM_SALT = process.env.SYSTEM_SALT || "dev_system_salt_12345";
  process.env.INVITE_SECRET = process.env.INVITE_SECRET || "dev_invite_secret_12345";
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default(defaultNodeEnv as "development" | "production" | "test"),
  GEMINI_API_KEY: z.string().optional(),
  // Third-party keys are optional at startup: their features report "not set up" until added.
  STRIPE_SECRET_KEY: z.string().optional(),
  SESSION_SECRET: z.string().min(1),
  CURRENCY_API_KEY: z.string().optional(),
  TAX_API_KEY: z.string().optional(),
  SYSTEM_SALT: z.string().min(1),
  DATABASE_URL: z.string().optional(),
});

const envResult = EnvSchema.safeParse(process.env);
if (!envResult.success) {
  console.error("❌ Invalid environment variables:", envResult.error.format());
  process.exit(1);
}

// Ensure validated/defaulted values propagate to process.env
process.env.NODE_ENV = envResult.data.NODE_ENV;

try {
  assertStartupConfig();
} catch (err) {
  console.error("❌ Startup config assertion failed:", errorMessage(err));
  if (process.env.NODE_ENV !== "test") {
    process.exit(1);
  }
}


async function buildApp(): Promise<{ app: express.Express; port: number }> {
  const app = express();
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : null;
  
  const isAllowedOrigin = (origin: string): boolean => {
    if (!origin) return true;
    
    if (allowedOriginsEnv && allowedOriginsEnv.includes(origin)) {
      return true;
    }
    
    if (process.env.APP_URL && (origin === process.env.APP_URL || origin === process.env.APP_URL.replace(/\/$/, ''))) {
      return true;
    }

    // This project's own Vercel deployments (production and preview URLs Vercel sets at runtime)
    const vercelHosts = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean);
    if (vercelHosts.some(host => origin === `https://${host}`)) {
      return true;
    }

    // Localhost & loopback
    if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?$/.test(origin)) {
      return true;
    }

    // Cloud Run and Google Cloud subdomains (*.run.app, *.us-east1.run.app, etc.)
    if (/^https:\/\/([a-z0-9-]+\.)*run\.app(:[0-9]+)?$/.test(origin)) {
      return true;
    }

    // Google AI Studio & Google domains
    if (/^https:\/\/([a-z0-9-]+\.)*(google\.com|googleusercontent\.com|aistudio\.google\.com|ai\.studio)(:[0-9]+)?$/.test(origin)) {
      return true;
    }

    // Firebase & Dev Workstations
    if (/^https:\/\/([a-z0-9-]+\.)*(web\.app|firebaseapp\.com|cloudworkstations\.dev)(:[0-9]+)?$/.test(origin)) {
      return true;
    }

    // Local private network development check (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:[0-9]+)?$/.test(origin)) {
      return true;
    }

    return false;
  };

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true
  }));

  // Port Resolution:
  // In AI Studio preview containers, Nginx reverse proxy listens on NGINX_PORT (8080) and routes to DEFAULT_APP_PORT (3000).
  // In standalone deployments (Cloud Run, Heroku, Render, local Docker), Node listens directly on process.env.PORT.
  const isAiStudioProxy = Boolean(process.env.APPLET_ID || process.env.NGINX_PORT || process.env.IS_AI_STUDIO_PREVIEW);
  const PORT = isAiStudioProxy
    ? Number(process.env.DEFAULT_APP_PORT || 3000)
    : (Number(process.env.PORT) || 3000);

  // Efficiency & Security Middleware
  app.set("trust proxy", 1); 
  app.use(compression());
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.plaid.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        // Supabase: data (https) and live updates (wss)
        connectSrc: ["'self'", supabaseUrl(), supabaseUrl().replace(/^http/, "ws"), "https://*.plaid.com", "https://*.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        frameSrc: ["'self'", "https://*.stripe.com", "https://cdn.plaid.com"],
        frameAncestors: isAiStudioProxy ? ["*"] : ["'self'"]
      }
    } : false,
    crossOriginEmbedderPolicy: false,
    frameguard: isAiStudioProxy ? false : { action: 'sameorigin' },
    hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use(morgan("tiny", {
    skip: (req) => !req.url || !req.url.startsWith("/api")
  }));
  
  // Stripe Webhook needs raw body
  app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const stripe = getStripe();
      const sig = req.headers['stripe-signature'];
      let event;

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret || !sig) {
        console.error('Missing Stripe webhook signature or STRIPE_WEBHOOK_SECRET configuration.');
        return res.status(400).send('Webhook Error: Missing signature or STRIPE_WEBHOOK_SECRET');
      }

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err) {
        console.error('Webhook signature verification failed.', errorMessage(err));
        return res.status(400).send(`Webhook Error: ${errorMessage(err)}`);
      }

      const eventId = event.id;
      const db = getDb();
      const eventRef = db.collection('stripeProcessedEvents').doc(eventId);

      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        const session = event.data.object as any;
        const isPaid = session.payment_status === 'paid';
        
        // --- 1. A customer paid an invoice through its payment link (K-11) ---
        if (session.metadata?.invoiceId) {
          const outcome = await recordStripeInvoicePayment(db, eventId, event.type, session);
          if (outcome.status === 'already_processed') {
            logger.info('Stripe webhook event already processed, skipping replay', { eventId });
            return res.json({ received: true, skipped: true });
          }
          logger.info('Stripe invoice payment', { eventId, outcome: outcome.status });
        }
        
        // --- 2. Subscription Upgrade & Credit Provisioning ---
        if (isPaid && (session.mode === 'subscription' || session.metadata?.plan)) {
          const workspaceId = session.metadata?.workspaceId;
          const plan = session.metadata?.plan || 'pro';
          
          if (workspaceId) {
            const creditsToGrant = plan === 'enterprise' ? 10000000 : 1000000;
            const wsRef = db.collection("workspaces").doc(workspaceId);
            
            const subResult = await db.runTransaction(async (t) => {
              const eventSnap = await t.get(eventRef);
              if (eventSnap.exists) {
                return { alreadyProcessed: true };
              }

              const wsSnap = await t.get(wsRef);
              const wsData = wsSnap.data() || {};
              const currentSubId = wsData.stripeSubscriptionId;
              const incomingSubId = session.subscription || null;

              // Only increment compute credits if this is a fresh upgrade or distinct subscription
              const isNewSubscription = incomingSubId && incomingSubId !== currentSubId;
              const updatePayload: Record<string, any> = {
                plan: plan,
                billingCycle: "monthly",
                computeLimit: creditsToGrant,
                stripeCustomerId: session.customer || null,
                stripeSubscriptionId: incomingSubId,
                lastUpgradedAt: new Date().toISOString()
              };

              if (isNewSubscription || wsData.computeCreditBalance === undefined) {
                updatePayload.computeCreditBalance = FieldValue.increment(creditsToGrant);
              }

              t.set(wsRef, updatePayload, { merge: true });

              t.set(eventRef, {
                id: eventId,
                type: event.type,
                processedAt: FieldValue.serverTimestamp()
              });

              return { success: true };
            });

            if (subResult?.alreadyProcessed) {
              logger.info('Stripe webhook event already processed, skipping replay', { eventId });
              return res.json({ received: true, skipped: true });
            }
            
            logger.info('Workspace upgraded with compute credits', { workspaceId, plan, creditsGranted: creditsToGrant });
          }
        }
      } else if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        const subscriptionId = subscription.id;
        
        await db.runTransaction(async (t) => {
          const eventSnap = await t.get(eventRef);
          if (eventSnap.exists) {
            return;
          }

          let wsSnap = await t.get(db.collection("workspaces").where("stripeSubscriptionId", "==", subscriptionId).limit(1));
          if (wsSnap.empty && customerId) {
            wsSnap = await t.get(db.collection("workspaces").where("stripeCustomerId", "==", customerId).limit(1));
          }

          if (!wsSnap.empty) {
            const wsDoc = wsSnap.docs[0];
            t.set(wsDoc.ref, {
              plan: 'starter',
              billingCycle: 'free',
              stripeSubscriptionId: null,
              lastDowngradedAt: new Date().toISOString()
            }, { merge: true });
          }

          t.set(eventRef, {
            id: eventId,
            type: event.type,
            processedAt: FieldValue.serverTimestamp()
          });
        });
      } else {
        // Record event idempotency for other unhandled types
        await eventRef.set({
          id: eventId,
          type: event.type,
          processedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

      res.json({received: true});
    } catch (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    }
  });

  app.use(express.json({ limit: "50mb" })); // Increased limit to securely support ~100,000 transaction bulk imports
  app.use((req, _res, next) => { req.body ??= {}; next(); }); // Express 5 leaves req.body undefined without a body
  app.use(csrfProtection({ isAllowedOrigin }));

  // Rate Limiting - Increased for production SPA load
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // increased to 1000 to prevent false positives in high-density SPA usage
    message: { status: "error", message: "Maximum rate limit reached. Please hold for calibration." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  // Apply to API routes
  app.use("/api/", limiter);
  app.use("/api/v1/brain", brainRateLimiter);
  app.use("/api/v1/documents", pdfGenerationLimiter);
    // --- Enterprise: AI Intelligence Hub ---
  
  // Rate limiter specifically for transaction matching to prevent abuse / DOS (Strategic Key Protection)
  const matchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 120, // 120 matching inquiries per minute
    message: { status: "error", message: "Transaction matching rate limit exceeded. Please throttle request intensity." },
    standardHeaders: true,
    legacyHeaders: false,
  });

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
      const rules = rulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
      const wsData = wsDoc.data() || {};
      const analyticalCache = wsData.analyticalTopology?.analyticalPatternCache || {};
      const threshold = wsData.matchingThreshold !== undefined ? wsData.matchingThreshold : 0.85;

      // Fetch finished chronological transaction context elements (first 200 for Bayesian seed)
      const transactionsSnap = await db.collection("transactions")
        .where("workspaceId", "==", workspaceId)
        .limit(200)
        .get();
      const transactions = transactionsSnap.docs.map(doc => doc.data() as LedgerTransaction);

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

  // API routes
  // Telemetry and Error Tracking API
  app.post("/api/v1/telemetry/errors", optionalAuthenticate, expressRateLimit({ windowMs: 60 * 1000, max: 60 }), async (req: express.Request, res: express.Response) => {
    try {
      const parsed = ErrorTelemetrySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: "error", message: "Invalid error payload", issues: parsed.error.issues });
      }

      const db = getDb();
      const rawData = parsed.data;
      const errorId = rawData.id || `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const authUser = (req as AuthenticatedRequest).user;

      const sanitizedMessage = SecurityService.scrubPII(rawData.message).slice(0, 2000);
      const sanitizedStack = rawData.stack ? SecurityService.scrubPII(rawData.stack).slice(0, 4000) : undefined;
      const sanitizedComponentStack = rawData.componentStack ? SecurityService.scrubPII(rawData.componentStack).slice(0, 2000) : undefined;

      // Determine validated workspaceId: only allow tenant tagging if user is authenticated
      let validatedWorkspaceId = 'unauthenticated';
      let validatedUserId: string | undefined = undefined;
      let validatedUserEmail: string | undefined = undefined;

      if (authUser && rawData.workspaceId && rawData.workspaceId !== 'unassigned' && rawData.workspaceId !== 'unauthenticated') {
        try {
          // Check workspace membership or admin role
          if (authUser.admin) {
            validatedWorkspaceId = rawData.workspaceId;
          } else {
            // Throws when the user is not a member (caught below).
            await assertWorkspaceAccess(db, rawData.workspaceId, authUser);
            validatedWorkspaceId = rawData.workspaceId;
          }
          validatedUserId = authUser.uid;
          validatedUserEmail = authUser.email;
        } catch (_wsErr) {
          validatedWorkspaceId = 'unauthenticated';
        }
      }

      const record: Record<string, any> = {
        id: errorId,
        workspaceId: validatedWorkspaceId,
        message: sanitizedMessage,
        createdAt: rawData.createdAt || new Date().toISOString()
      };

      if (validatedUserId) record.userId = validatedUserId;
      if (validatedUserEmail) record.userEmail = validatedUserEmail;
      if (sanitizedStack) record.stack = sanitizedStack;
      if (sanitizedComponentStack) record.componentStack = sanitizedComponentStack;
      if (rawData.url) record.url = rawData.url;
      if (rawData.userAgent) record.userAgent = rawData.userAgent;
      if (rawData.appVersion) record.appVersion = rawData.appVersion;
      if (rawData.release) record.release = rawData.release;
      record.source = validatedWorkspaceId === 'unauthenticated' ? 'anonymous_frontend' : (rawData.source || 'frontend');
      if (rawData.severity) record.severity = rawData.severity;
      if (rawData.metadata) record.metadata = rawData.metadata;
      if (rawData.ticketId) record.ticketId = rawData.ticketId;

      try {
        await db.collection("errorLogs").doc(errorId).set(record);
      } catch (dbErr) {
        console.warn("[Telemetry] Error doc persistence bypassed due to sandbox constraint:", errorMessage(dbErr));
      }
      res.json({ status: "success", errorId });
    } catch (err) {
      console.warn("[Telemetry] Failed to record error log:", err);
      res.status(200).json({ status: "success", message: "Telemetry received" });
    }
  });

  app.use("/api", statusRouter);

  app.get("/api/v1/public/registration-status", async (req, res) => {
    try {
      const db = getDb();
      let isAuthenticated = false;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        try {
          await verifyIdToken(idToken);
          isAuthenticated = true;
        } catch (_e) {
          // Token invalid or expired
        }
      }

      let totalUsers: number | undefined = undefined;
      const limit = globalAdminConfig.maxRegistrationLimit !== undefined ? globalAdminConfig.maxRegistrationLimit : 100;
      let registrationAllowed = true;

      try {
        const usersSnap = await db.collection("users").count().get();
        const userCount = usersSnap.data().count;
        if (isAuthenticated) {
          totalUsers = userCount;
        }
        registrationAllowed = userCount < limit;
      } catch (_err) {
        // DB fallback
      }

      const payload: Record<string, any> = {
        status: "success",
        maxRegistrationLimit: limit,
        registrationAllowed,
        freeWorkspaceTxCap: globalAdminConfig.freeWorkspaceTxCap !== undefined ? globalAdminConfig.freeWorkspaceTxCap : 100
      };

      if (isAuthenticated && totalUsers !== undefined) {
        payload.totalUsers = totalUsers;
      }

      res.json(payload);
    } catch (_err) {
      res.json({
        status: "success",
        maxRegistrationLimit: globalAdminConfig.maxRegistrationLimit || 100,
        registrationAllowed: true,
        freeWorkspaceTxCap: globalAdminConfig.freeWorkspaceTxCap || 100
      });
    }
  });

  // --- Developer Hub: Deep API Platform & Webhooks & Logging ---
  const apiLogs: ApiLog[] = [];


  // Interceptor middleware for Developer API Logging
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 100, // Limit each IP to 100 requests per `window` (here, per minute)
    message: { status: "error", message: "Too many requests from this IP, please try again after a minute." },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });
  // what the route files registered below need from here
  const routeContext: ServerContext = { apiLogs, apiLimiter, matchLimiter, limiter };

  app.use("/api/v1/", apiLimiter, (req, res, next) => {
    const start = Date.now();
    const originalEnd = res.end;

    res.end = function(chunk?: any, encoding?: any, callback?: any) {
      const latency = Date.now() - start;
      const authHeader = req.headers.authorization || (req.headers['x-api-key'] as string) || '';
      
      let apiPart = 'Bearer Token';
      const reqUser = requestUser(req);
      
      if (reqUser && reqUser.apiKeyName) {
        apiPart = `Key: ${reqUser.apiKeyName} (${(reqUser.usedApiKeyId || '').substring(0, 10)}...)`;
      } else if (authHeader.startsWith('Bearer lf_sec_') || authHeader.startsWith('lf_sec_')) {
        const parts = authHeader.replace('Bearer ', '').split('_');
        if (parts.length >= 4) {
          apiPart = `lf_sec_${parts[2].substring(0, 4)}..._***`;
        } else {
          apiPart = 'Invalid Key Format';
        }
      } else if (authHeader.startsWith('Bearer lf_id_') || authHeader.startsWith('lf_id_')) {
        const keyPart = authHeader.replace('Bearer ', '').split('.')[0];
        apiPart = `${keyPart.substring(0, 15)}...`;
      } else if (!authHeader) {
        apiPart = 'None';
      }

      apiLogs.unshift({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        latencyMs: latency,
        apiKeyUsed: apiPart,
        ip: (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || '127.0.0.1'
      });

      if (apiLogs.length > 100) apiLogs.pop();
      return originalEnd.call(this, chunk, encoding, callback);
    };

    next();
  });

  // Endpoints v1
  app.get("/api/v1/status", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.query.workspaceId as string) || requestUser(req).developerWorkspaceId;
      if (!workspaceId) return sendError(res, "Missing workspaceId parameters in query", 400);

      const authReq = req as AuthenticatedRequest;
      const wsData = await authorizeWorkspace(authReq, workspaceId);

      const wsName = wsData?.name || "Production Workspace";
      const wsCurrency = wsData?.currency || "USD";
      const wsLockDate: string | null = wsData?.lockDate || null;
      const wsBusinessType = wsData?.businessType || "enterprise";

      res.json({
        status: "active",
        service: "LedgerFlow Deep API Engine",
        workspaceId,
        metadata: {
          name: wsName,
          currency: wsCurrency,
          lockDate: wsLockDate,
          businessType: wsBusinessType
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      sendError(res, errorMessage(err), 500);
    }
  });

  // --- INTEGRITY ENGINE MATH API ---
  app.use("/api/v1/math", apiAuthenticate, mathRouter);

  registerWorkspaceApiRoutes(app, routeContext);

  registerDeveloperApiRoutes(app, routeContext);
  registerApiKeysRoutes(app, routeContext);

  registerMetricsAuditRoutes(app, routeContext);

  registerBrainRoutes(app, routeContext);

  registerAdminRoutes(app, routeContext);

  // --- Corporate Billing and Compute Metering Endpoints ---
  app.use("/api/v1/billing", apiAuthenticate, billingRouter);

  // stress-test route removed in favor of real client-side load testing

  registerLogsUploadRoutes(app, routeContext);

  // Currency rates and tax-rate lookups (apilayer.com, cached)
  app.use("/api/v1/currency", authenticate, currencyRouter);
  app.use("/api/v1/tax", authenticate, taxDataRouter);

  // --- Plaid Integration ---
  app.use("/api/v1/plaid", authenticate, plaidRouter);

  app.use("/api/reports", authenticate, reportRouter);
  // /api/v1/reports is mounted once, with apiAuthenticate (signed-in users and API keys), below

  registerLabelingRoutes(app, routeContext);
  registerAuthRoutes(app, routeContext);

  // Mount kernel routes
  app.use("/api/v1/reports", apiAuthenticate, reportRouter);
  app.use("/api/v1/workspaces", apiAuthenticate, workspaceRouter);
  app.use("/api/v1/account", apiAuthenticate, accountRouter);
  app.use("/api/v1/transactions", apiAuthenticate, transactionRouter);
  app.use("/api/v1/revenue", apiAuthenticate, revenueRouter);
  app.use("/api/v1/consolidation", apiAuthenticate, consolidationRouter);
  app.use("/api/v1/lease", apiAuthenticate, leaseRouter);
  app.use("/api/v1/inventory", apiAuthenticate, inventoryRouter);
  app.use("/api/v1/fx", apiAuthenticate, fxRouter);
  app.use("/api/v1/support", authenticate, supportRouter);
  app.use("/api/v1/payments", apiAuthenticate, paymentRouter);
  app.use("/api/v1/documents", apiAuthenticate, documentRouter);
  app.use("/api/v1/invoices/public", publicInvoiceLimiter, publicInvoiceRouter);
  app.use("/api/v1/email-events", emailWebhookRouter); // provider bounce/complaint reports (secret token)
  app.use("/api/ai", aiRouter);
  app.use("/api/v1/ai", aiRouter);
  app.use("/api/v1/invites", invitePublicRouter);

  // Scheduled jobs (Vercel Cron calls them with CRON_SECRET)
  app.use("/api/cron", cronRouter);

  // API 404 handler for unmatched /api/* routes
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.originalUrl}` });
  });

  await syncGlobalAdminConfig();
  return { app, port: PORT };
}

/** The Express app with every API route; the Vercel function (api/index.mjs) serves it. */
export async function createApp(): Promise<express.Express> {
  return (await buildApp()).app;
}

/** Long-running server (npm run dev / npm start): the app plus the web pages and timers. */
async function startServer() {
  const { app, port: PORT } = await buildApp();
  const http = await import('http');
  const httpServer = http.createServer(app);

  // Daily maintenance (on Vercel the cron job runs it instead)
  setInterval(() => {
    runDailyMaintenance().catch(e => console.error("[Data Lifecycle] Cleanup job failed", e));
  }, 24 * 60 * 60 * 1000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server: httpServer }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Robust dist path resolution for standalone and container deployments
    const candidatePaths = [
      path.join(process.cwd(), 'dist'),
      path.join(__dirname, 'dist'),
      path.join(__dirname, '../dist'),
      process.cwd()
    ];
    const distPath = candidatePaths.find(p => fs.existsSync(path.join(p, 'index.html'))) || path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.debug(`💥 Port ${PORT} is in use, retrying...`);
      setTimeout(() => {
        httpServer.close();
        httpServer.listen(PORT, "0.0.0.0");
      }, 1000);
    }
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.debug(`🚀 [Server] Production Ready: http://localhost:${PORT}`);
    console.debug(`📂 [Server] Serving static assets from: ${process.env.NODE_ENV === "production" ? "dist" : "Vite Dev Server"}`);

    // Single boot check for due recurring items with idempotency protection.
    // Ongoing processing runs through the authenticated /api/v1/system/recurring/process endpoint.
    processAllRecurring().catch(err => console.error('[RecurringService] Initial boot run failed:', err));

    // Daily error telemetry digest schedule (24h cadence).
    // Can also be triggered on-demand via POST /api/v1/system/telemetry/errors/digest.
    const ERROR_DIGEST_INTERVAL_MS = 24 * 60 * 60 * 1000;
    setInterval(() => {
      processErrorDigest().catch(err => console.warn('[ErrorDigestService] Scheduled digest run failed:', err));
    }, ERROR_DIGEST_INTERVAL_MS);
  });

  const gracefulShutdown = (signal: string) => {
    console.debug(`🛑 [Server] Received ${signal}. Shutting down gracefully...`);
    httpServer.close(() => {
      console.debug('👋 [Server] Closed remaining connections. Exiting process.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('💥 [Server] Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Server] Unhandled Promise Rejection caught at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('💥 [Server] Uncaught Exception caught:', error);
});

// On Vercel the function in api/index.mjs imports createApp() instead of starting a server.
if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  console.debug("🌀 [Server] Booting LedgerFlow Backend...");
  startServer().catch(err => {
    console.error("💥 [Server] Critical Startup Failure:", err);
    process.exit(1);
  });
}
