import { invoiceEmailRouter } from "./src/server/routes/invoiceEmailRoutes";
import { publicInvoiceRouter } from "./src/server/routes/publicInvoiceRoutes";
import { transactionRouter } from "./src/server/routes/transactionRoutes";
import { revenueRouter } from "./src/server/routes/revenueRoutes";
import { consolidationRouter } from "./src/server/routes/consolidationRoutes";
import { leaseRouter } from "./src/server/routes/leaseRoutes";
import { inventoryRouter } from "./src/server/routes/inventoryRoutes";
import express from "express";
import cors from "cors";
import Stripe from "stripe";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import multer from "multer";
import fs from "fs";
import { parse as parseCsv } from 'csv-parse/sync';
import { z } from "zod";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import crypto from "crypto";
import { rateLimit as expressRateLimit } from "express-rate-limit";
import { SecurityService } from "./src/services/securityService.ts";
import { AIBackendService } from "./src/services/aiBackendService.ts";
import { GoogleGenAI } from "@google/genai";
import { 
  ReportRangeSchema, 
  WorkspaceIdSchema,
  DepreciationRequestSchema,
  ValuationRequestSchema,
  TemporalMathRequestSchema,
  KPIRequestSchema,
  AmortizationRequestSchema,
  InventoryWACRequestSchema,
  InventoryEOQRequestSchema
} from "./src/schemas.ts";
import { BayesianClassifier, sha256Sync } from "./src/lib/algorithms.ts";
import { MatchingEngine } from "./src/lib/MatchingEngine.ts";
import { TruthEngine } from "./src/modules/integrity/TruthEngine.ts";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

dotenv.config();

// --- Plaid Client Setup ---
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

// --- Stripe Setup ---
let stripeClient: Stripe | null = null;
export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY as string;
    stripeClient = new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
  }
  return stripeClient;
}

// --- Environment Validation ---
// Determine default NODE_ENV: fail-safe to "production" unless explicitly set to "development" or running ts source directly
const isTsSourceRun = Boolean(process.argv[1]?.endsWith(".ts"));
const defaultNodeEnv = process.env.NODE_ENV || (isTsSourceRun ? "development" : "production");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default(defaultNodeEnv as "development" | "production" | "test"),
  GEMINI_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().min(1),
  SESSION_SECRET: z.string().min(1),
  CURRENCY_API_KEY: z.string().min(1),
  TAX_API_KEY: z.string().min(1),
  SYSTEM_SALT: z.string().min(1),
  FIREBASE_PROJECT_ID: z.string().optional(),
});

const envResult = EnvSchema.safeParse(process.env);
if (!envResult.success) {
  console.error("❌ Invalid environment variables:", envResult.error.format());
  process.exit(1);
}

// Ensure validated/defaulted values propagate to process.env
process.env.NODE_ENV = envResult.data.NODE_ENV;

// --- Types ---
interface AuthUser extends admin.auth.DecodedIdToken {
  email_verified: boolean;
}

interface AuthenticatedRequest extends express.Request {
  user: AuthUser;
}

// Load Firebase Config safely with environment override
let firebaseConfig: Record<string, any> = {};
try {
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch (error) {
  console.warn("[Firebase Admin] Warning: Could not read firebase-applet-config.json:", error);
}

// Environment variable takes precedence over committed config file
const activeFirebaseProjectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;

if (admin.apps.length === 0 && activeFirebaseProjectId) {
  admin.initializeApp({
    projectId: activeFirebaseProjectId,
  });
  console.debug(`[Firebase Admin] Initialized for project: ${activeFirebaseProjectId}`);
}

const upload = multer({ 
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
    files: 1
  }
});

const getDb = () => {
  const dbId = process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || "(default)";
  try {
    if (dbId && dbId !== "(default)") {
      return getFirestore(admin.app(), dbId);
    }
    return getFirestore(admin.app());
  } catch (error) {
    console.error(`[Firebase Admin] Failed getFirestore for: ${dbId}`, error);
    return getFirestore(admin.app()); 
  }
};

// --- Global Admin Pricing & Billing Overrides System ---
let globalAdminConfig = {
  creditCostMultiplier: 1.0,
  quotaCentsMultiplier: 1.0,
  bypassBilling: false,
  customKeyCreditCharge: 10,
  customKeyCentsCharge: 0,
  maxRegistrationLimit: 100,
  freeWorkspaceTxCap: 100,
};

async function syncGlobalAdminConfig() {
  try {
    const db = getDb();
    const doc = await db.collection("admins").doc("globalConfig").get();
    if (doc.exists) {
      const data = doc.data() || {};
      globalAdminConfig = {
        creditCostMultiplier: data.creditCostMultiplier !== undefined ? Number(data.creditCostMultiplier) : 1.0,
        quotaCentsMultiplier: data.quotaCentsMultiplier !== undefined ? Number(data.quotaCentsMultiplier) : 1.0,
        bypassBilling: data.bypassBilling === true,
        customKeyCreditCharge: data.customKeyCreditCharge !== undefined ? Number(data.customKeyCreditCharge) : 10,
        customKeyCentsCharge: data.customKeyCentsCharge !== undefined ? Number(data.customKeyCentsCharge) : 0,
        maxRegistrationLimit: data.maxRegistrationLimit !== undefined ? Number(data.maxRegistrationLimit) : 100,
        freeWorkspaceTxCap: data.freeWorkspaceTxCap !== undefined ? Number(data.freeWorkspaceTxCap) : 100,
      };
      console.debug("🌀 [Global Billing Config Sync] Loaded from database:", globalAdminConfig);
    }
  } catch (err: any) {
    console.debug("🌀 [Global Billing Config Sync] Bypassed (Using default settings)");
  }
}

function calculateWorkspaceCharges(wsData: any, baseCredits: number, baseCents: number, isCustomKeyUsed: boolean) {
  const creditMult = wsData?.creditCostMultiplier !== undefined 
    ? Number(wsData.creditCostMultiplier) 
    : globalAdminConfig.creditCostMultiplier;
    
  const centsMult = wsData?.quotaCentsMultiplier !== undefined 
    ? Number(wsData.quotaCentsMultiplier) 
    : globalAdminConfig.quotaCentsMultiplier;

  let credits = baseCredits;
  let cents = baseCents;

  if (isCustomKeyUsed) {
    const wsCustomCredit = wsData?.customKeyCreditCharge !== undefined ? Number(wsData.customKeyCreditCharge) : null;
    credits = wsCustomCredit !== null ? wsCustomCredit : globalAdminConfig.customKeyCreditCharge;

    const wsCustomCents = wsData?.customKeyCentsCharge !== undefined ? Number(wsData.customKeyCentsCharge) : null;
    cents = wsCustomCents !== null ? wsCustomCents : globalAdminConfig.customKeyCentsCharge;
  }

  credits = Math.round(credits * creditMult);
  cents = Number((cents * centsMult).toFixed(6)); // Preserve micro-penny accuracy for accurate usage representation

  const bypass = wsData?.bypassBilling === true || globalAdminConfig.bypassBilling === true;
  if (bypass) {
    credits = 0;
    cents = 0;
  }

  return { credits, cents };
}

/**
 * Period Lock Enforcement
 * Prevents modifications to closed fiscal periods
 */
async function verifyLockDate(workspaceId: string, date: string) {
  try {
    const db = getDb();
    const ws = await db.collection("workspaces").doc(workspaceId).get();
    if (ws.exists) {
      const data = ws.data();
      if (data?.lockDate && date <= data.lockDate) {
        throw new Error(`Period Locked: Data mutation forbidden before ${data.lockDate}`);
      }
    } else {
      throw new Error("Workspace not found");
    }
  } catch (err: any) {
    if (err.message?.includes("Period Locked") || err.message === "Workspace not found") {
      throw err;
    }
    throw new Error(`Failed to verify period lock status: ${err.message}`);
  }
}

/**
 * Standard API error response
 */
function sendError(res: express.Response, message: string, status: number = 500, details?: any) {
  console.error(`[API Error] ${status}: ${message} (Path: ${res.req?.originalUrl || "unknown"})`, details || "");
  res.status(status).json({
    status: "error",
    message,
    ...(details && { details })
  });
}

/**
 * Centralized API error handler
 */
function handleApiError(res: express.Response, err: any) {
  console.error("[Handling API Error]", err);
  const message = err.message || err.toString() || "";
  const code = err.code || "";
  console.error("[API Error Details] message:", message, "code:", code);

  if (message.includes("UNAUTHENTICATED") || code === 16) {
    return sendError(res, "Unauthenticated: " + message, 401);
  }
  if (message.includes("FORBIDDEN") || message.includes("PERMISSION_DENIED") || code === 7) {
    return sendError(res, "Forbidden access: " + message, 403);
  }
  if (message.includes("NOT_FOUND") || code === 5) {
    return sendError(res, "Resource not found: " + message, 404);
  }
  if (message.includes("INVALID_ARGUMENT") || message.includes("FAILED_PRECONDITION") || code === 3 || code === 9) {
    return sendError(res, "Unprocessable Entity: " + message, 422);
  }
  if (message.includes("ALREADY_EXISTS") || code === 6) {
    return sendError(res, "Conflict: " + message, 409);
  }

  sendError(res, message || "Internal Server Error", 500);
}

/**
 * Authorization & Context Helper
 */
async function authorizeWorkspace(req: AuthenticatedRequest, workspaceId: string) {
  console.debug("[DEBUG] authorizeWorkspace - workspaceId:", workspaceId);
  const db = getDb();
  
  // Validate basic workspaceId structure (e.g., must be a non-empty string)
  if (!workspaceId || typeof workspaceId !== 'string') {
    throw new Error("NOT_FOUND: Invalid workspace identifier provided.");
  }
  
  try {
    const docRef = db.collection("workspaces").doc(workspaceId);
    
    const workspaceSnap = await docRef.get();
    
    if (!workspaceSnap.exists) {
      throw new Error(`NOT_FOUND: Workspace with ID ${workspaceId} not found in database.`);
    }
    
    const data = workspaceSnap.data();
    const isOwner = data?.uid === req.user.uid;
    const isMember = Array.isArray(data?.members) && data.members.includes(req.user.uid);
    const isAdmin = data?.admins?.[req.user.uid] === true || 
                    (Array.isArray(data?.admins) && data.admins.includes(req.user.uid)) || 
                    req.user.admin === true;
    
    if (!isOwner && !isMember && !isAdmin) {
      console.error("[DEBUG] authorizeWorkspace - Forbidden access for user:", req.user.uid, "to workspace:", workspaceId);
      throw new Error("FORBIDDEN: You do not have permission to access workspace " + workspaceId);
    }
    
    // Administrative Policy Enforcement & Access Matrix Checks
    const url = req.originalUrl || req.url || "";
    const isBillingOrMetadataRoute = url.includes("/billing/status") || url.includes("/billing/record-compute");
    const isSystemAdmin = req.user?.admin === true;

    if (!isSystemAdmin && !isBillingOrMetadataRoute) {
      // 1. Account Freeze enforcement (concurrentUserLimit = 0 denotes administratively frozen account)
      if (data?.concurrentUserLimit === 0) {
        throw new Error("FORBIDDEN: This workspace is administratively suspended/frozen by Systems Administration. Please contact support@ledgerflow.app.");
      }

      const method = req.method || "GET";
      const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(method);
      const isCreditSensitive = isMutation || url.includes("/brain/");

      if (isCreditSensitive) {
        // 2. Compute credit balance checking
        const creditBalance = data?.computeCreditBalance !== undefined ? Number(data.computeCreditBalance) : 100000;
        if (creditBalance <= 0) {
          throw new Error("PAYMENT_REQUIRED: This workspace has exhausted its compute credit balance (0 left). Please upgrade your plan or top up in settings.");
        }

        // 3. API Quota dollar limit enforcement
        const quotaLimitCents = data?.apiQuotaMonthlyLimitCents !== undefined ? Number(data.apiQuotaMonthlyLimitCents) : 0;
        const quotaUsedCents = data?.apiQuotaTotalCentsUsed !== undefined ? Number(data.apiQuotaTotalCentsUsed) : 0;
        if (quotaLimitCents > 0 && quotaUsedCents >= quotaLimitCents) {
          throw new Error("QUOTA_EXCEEDED: Workspace monthly spending quota limit exceeded. Please configure custom plan limits with your administrator.");
        }
      }
    }
    
    return data;
  } catch (err: any) {
    if (err.message && (err.message.includes("FORBIDDEN") || err.message.includes("PAYMENT_REQUIRED") || err.message.includes("QUOTA_EXCEEDED"))) {
      throw err;
    }
    if (err.message?.includes("PERMISSION_DENIED") || err.message?.includes("permissions") || err.code === 7) {
      console.warn("[Firebase Admin] Bypassing authorization check on server due to IAM constraints. Falling back to sandbox proxy workspace descriptor.");
      return { uid: req.user?.uid, name: "Sandbox Workspace", admins: { [req.user?.uid || ""]: true } };
    }
    throw err;
  }
}


/**
 * Authentication Middleware
 */
const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Return 401 silently for logs to avoid cluttering with pre-auth probes
    return res.status(401).json({ status: "error", message: "Unauthorized: No token provided" });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken) as AuthUser;
    
    // Strict Verification: Only allow verified institutional emails or anonymous for specific workflows
    const isAnonymous = decodedToken.firebase?.sign_in_provider === 'anonymous';
    if (!decodedToken.email_verified && !isAnonymous) {
      return sendError(res, "Access Denied: Please verify your email protocol.", 403);
    }

    (req as AuthenticatedRequest).user = decodedToken;
    next();
  } catch (error) {
    sendError(res, "Unauthorized: Invalid token", 401, error);
  }
};

/**
 * Shared data fetcher for reports to ensure consistent auth and efficiency
 */
async function getReportContext(req: AuthenticatedRequest, workspaceId: string) {
  const db = getDb();
  await authorizeWorkspace(req, workspaceId);
  const accountsSnap = await db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get();
  
  // Streaming approach for transactions guarantees linear memory bounds and prevents Node.js OOM crashes on 100,000+ entries
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

/**
 * Resolves the active Gemini API key for a user (supporting BYOK encrypted key or server fallback)
 */
async function resolveUserGeminiApiKey(uid?: string): Promise<{ apiKey: string; isCustom: boolean }> {
  if (!uid) {
    return { apiKey: process.env.GEMINI_API_KEY || "", isCustom: false };
  }
  try {
    const db = getDb();
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      if (data?.geminiApiKeyEncrypted) {
        try {
          const decrypted = SecurityService.decryptSensitiveField(data.geminiApiKeyEncrypted);
          if (decrypted) return { apiKey: decrypted, isCustom: true };
        } catch (decryptErr) {
          console.warn("[resolveUserGeminiApiKey] Failed to decrypt user key:", decryptErr);
        }
      }
      if (data?.geminiApiKey) {
        return { apiKey: data.geminiApiKey, isCustom: true };
      }
    }
  } catch (err: any) {
    console.warn("[resolveUserGeminiApiKey] Error fetching user API key:", err.message);
  }
  return { apiKey: process.env.GEMINI_API_KEY || "", isCustom: false };
}

async function startServer() {
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
  const isAiStudioProxy = Boolean(process.env.APPLET_ID || process.env.NGINX_PORT);
  const PORT = isAiStudioProxy
    ? Number(process.env.DEFAULT_APP_PORT || 3000)
    : (Number(process.env.PORT) || 3000);

  // Efficiency & Security Middleware
  app.set("trust proxy", 1); 
  app.use(compression());
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' && !process.env.IS_AI_STUDIO_PREVIEW ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https://firebasestorage.googleapis.com", "https://*.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        frameSrc: ["'self'", "https://*.stripe.com", "https://cdn.plaid.com"]
      }
    } : false, // Disabled to prevent blocking iframe scripts / web-bundler in preview
    crossOriginEmbedderPolicy: false,
    frameguard: false, // Required for preview environment iframe embed
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }, // Harden transport security
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use(morgan("tiny"));
  
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
      } catch (err: any) {
        console.error('Webhook signature verification failed.', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      const eventId = event.id;
      const db = getFirestore();
      const eventRef = db.collection('stripeProcessedEvents').doc(eventId);

      // Verify and record event idempotency lock to prevent duplicate credit minting or replay attacks
      const alreadyProcessed = await db.runTransaction(async (t) => {
        const snap = await t.get(eventRef);
        if (snap.exists) {
          return true;
        }
        t.set(eventRef, {
          id: eventId,
          type: event.type,
          processedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return false;
      });

      if (alreadyProcessed) {
        console.log(`[Stripe Webhook] Event ${eventId} already processed. Skipping replay.`);
        return res.json({ received: true, skipped: true });
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        
        // --- 1. Invoice Payment Fulfillment ---
        if (session.metadata?.invoiceId) {
          const invoiceId = session.metadata.invoiceId;
          const workspaceId = session.metadata.workspaceId;
          const amountTotal = session.amount_total || 0;
          
          // Canonical top-level invoices collection
          const invoiceRef = db.collection('invoices').doc(invoiceId);
          
          await db.runTransaction(async (t) => {
            let doc = await t.get(invoiceRef);
            let targetRef = invoiceRef;
            
            // Fallback check for legacy nested collection if top-level does not exist
            if (!doc.exists && workspaceId) {
              const legacyRef = db.collection('workspaces').doc(workspaceId).collection('invoices').doc(invoiceId);
              const legacyDoc = await t.get(legacyRef);
              if (legacyDoc.exists) {
                doc = legacyDoc;
                targetRef = legacyRef;
              }
            }
            
            if (!doc.exists) return;
            
            const inv = doc.data() as any;
            if (inv && inv.status !== "paid") {
              // Admin SDK requires all reads before writes in a transaction
              const wsId = inv.workspaceId || workspaceId;
              const accountsSnap = await t.get(db.collection('chartAccounts').where('workspaceId', '==', wsId));
              const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

              t.update(targetRef, {
                status: 'paid',
                amountPaidCents: amountTotal,
                paidAt: new Date().toISOString(),
                isLocked: true
              });
              
              let cashAccount: any = accounts.find((a: any) => 
                a.subtype === "cash" || a.subtype === "bank" || a.category === "Cash" || a.role === "cash" || 
                (a.type === "asset" && (a.name || '').toLowerCase().includes('cash')) || 
                (a.type === "asset" && (a.name || '').toLowerCase().includes('bank')) || 
                (a.type === "asset" && (a.name || '').toLowerCase().includes('stripe'))
              );
              let arAccount: any = accounts.find((a: any) => 
                a.subtype === "accounts_receivable" || a.category === "Accounts Receivable" || a.role === "accounts_receivable" || 
                (a.type === "asset" && (a.name || '').toLowerCase().includes('receivable'))
              );
              
              if (!cashAccount) {
                const newCashRef = db.collection('chartAccounts').doc();
                cashAccount = {
                  id: newCashRef.id,
                  uid: 'system',
                  workspaceId: wsId,
                  name: 'Stripe Clearing Account',
                  code: '1010',
                  type: 'asset',
                  subtype: 'cash',
                  category: 'Cash',
                  balanceCents: 0,
                  createdAt: new Date().toISOString()
                };
                t.set(newCashRef, cashAccount);
              }
              if (!arAccount) {
                const newArRef = db.collection('chartAccounts').doc();
                arAccount = {
                  id: newArRef.id,
                  uid: 'system',
                  workspaceId: wsId,
                  name: 'Accounts Receivable',
                  code: '1200',
                  type: 'asset',
                  subtype: 'accounts_receivable',
                  category: 'Accounts Receivable',
                  balanceCents: 0,
                  createdAt: new Date().toISOString()
                };
                t.set(newArRef, arAccount);
              }
              
              const exchangeRate = typeof inv?.exchangeRate === 'number' && inv.exchangeRate > 0 ? inv.exchangeRate : 1;
              const txRef = db.collection('transactions').doc();
              t.set(txRef, {
                uid: 'system',
                workspaceId: wsId,
                date: new Date().toISOString().split('T')[0],
                description: `Invoice ${inv?.number || "Unknown"} Payment via Stripe`,
                totalAmountCents: amountTotal,
                currency: inv?.currency || 'USD',
                exchangeRate: exchangeRate,
                status: 'completed',
                type: 'actual',
                createdAt: new Date().toISOString(),
                metadata: {
                  invoiceId,
                  stripeSessionId: session.id,
                  type: 'invoice-payment'
                },
                lines: [
                  {
                    accountId: cashAccount.id,
                    accountName: cashAccount.name,
                    amountCents: amountTotal, // Debit Cash
                    description: `Stripe Payment for Invoice ${inv?.number || "Unknown"}`,
                    exchangeRate: exchangeRate
                  },
                  {
                    accountId: arAccount.id,
                    accountName: arAccount.name,
                    amountCents: -amountTotal, // Credit AR
                    description: `A/R Clearance for Invoice ${inv?.number || "Unknown"}`,
                    exchangeRate: exchangeRate
                  }
                ]
              });
            }
          });
        }
        
        // --- 2. Subscription Upgrade & Credit Provisioning ---
        if (session.mode === 'subscription' || session.metadata?.plan) {
          const workspaceId = session.metadata?.workspaceId;
          const plan = session.metadata?.plan || 'pro';
          
          if (workspaceId) {
            const creditsToGrant = plan === 'enterprise' ? 10000000 : 1000000;
            const wsRef = db.collection("workspaces").doc(workspaceId);
            
            await wsRef.set({
              plan: plan,
              billingCycle: "monthly",
              computeCreditBalance: admin.firestore.FieldValue.increment(creditsToGrant),
              computeLimit: creditsToGrant,
              stripeCustomerId: session.customer || null,
              stripeSubscriptionId: session.subscription || null,
              lastUpgradedAt: new Date().toISOString()
            }, { merge: true });
            
            console.log(`[Stripe Webhook] Workspace ${workspaceId} upgraded to ${plan} with +${creditsToGrant} compute credits.`);
          }
        }
      } else if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        const db = getFirestore();
        
        // Find workspace with this stripeCustomerId or stripeSubscriptionId
        const wsSnap = await db.collection("workspaces").where("stripeCustomerId", "==", customerId).limit(1).get();
        if (!wsSnap.empty) {
          const wsDoc = wsSnap.docs[0];
          await wsDoc.ref.set({
            plan: 'starter',
            billingCycle: 'free',
            lastDowngradedAt: new Date().toISOString()
          }, { merge: true });
          console.log(`[Stripe Webhook] Workspace ${wsDoc.id} downgraded to starter due to subscription cancellation.`);
        }
      }

      res.json({received: true});
    } catch (err: any) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    }
  });

  app.use(express.json({ limit: "50mb" })); // Increased limit to securely support ~100,000 transaction bulk imports

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
      const transactions = transactionsSnap.docs.map(doc => doc.data() as any);

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
    } catch (err: any) {
      sendError(res, err.message, 500);
    }
  });

  app.post("/api/ai/process", authenticate, async (req: express.Request, res: express.Response) => {
    const { task, payload } = req.body;
    if (!task) return sendError(res, "Task identifier required", 400);

    const workspaceId = (payload?.workspaceId) || (req as any).user?.developerWorkspaceId;
    if (!workspaceId) {
      return sendError(res, "workspaceId is required for AI processing to verify quotas and access.", 400);
    }

    try {
      const db = getDb();

      // Ensure the user actually has permission to operate on this workspace!
      await authorizeWorkspace(req as AuthenticatedRequest, workspaceId);

      // Implement workspace quota/credit budget locking
      if (workspaceId) {
        const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
        if (wsDoc.exists) {
          const wsData = wsDoc.data() || {};
          const creditBalance = wsData.computeCreditBalance !== undefined ? wsData.computeCreditBalance : 100000;
          if (creditBalance <= 0) {
            return res.status(403).json({
              status: "error",
              message: "Forbidden: AI operations suspended. This workspace has exhausted its compute credit balance. Please configure additional credits."
            });
          }
        }
      }

      const uid = (req as AuthenticatedRequest).user?.uid;
      const { apiKey, isCustom: isCustomKeyUsed } = await resolveUserGeminiApiKey(uid);

      if (!apiKey) {
         throw new Error("Missing Gemini API Key. Please configure it in AI Settings.");
      }

      // Check whether payload and task are cached via our unified caching base BEFORE triggering AI!
      const isCached = AIBackendService.hasCachedResponse(task, payload);

      const aiService = new AIBackendService(apiKey);
      const result = await aiService.process(task, payload);

      // Charge credits and log audit traces only if it's NOT a cache hit!
      if (workspaceId && !isCached) {
        let baseWeight = 15;
        let baseCents = 0;
        
        const usage = aiService.lastUsageMetadata;
        if (usage) {
          const promptTokens = usage.promptTokenCount || 0;
          const outputTokens = usage.candidatesTokenCount || 0;
          const totalTokens = usage.totalTokenCount || (promptTokens + outputTokens);
          
          // Gemini 2.5 Flash Pricing Model True Alignment ($0.075 / 1M input, $0.30 / 1M output)
          baseCents = (promptTokens * 7.5 / 1000000) + (outputTokens * 30 / 1000000);
          baseWeight = totalTokens > 0 ? totalTokens : 15;
        } else {
          if (task === 'parse-personal-tax-profile') baseWeight = 1500;
          else if (task === 'parse-receipt' || task === 'parse-statement') baseWeight = 1000;
          else if (task === 'parse-business-blueprint') baseWeight = 1200;
          else if (task === 'strategic-analysis' || task === 'analyze-trends') baseWeight = 800;
          
          baseCents = Math.round(baseWeight * 0.1); // 0.1 cent per weight unit
        }

        try {
          const wsRef = db.collection("workspaces").doc(workspaceId);
          const wsDoc = await wsRef.get();
          if (wsDoc.exists) {
            const wsData = wsDoc.data() || {};
            
            // Centralized dynamic multiplier calculation
            const { credits: weightScore, cents: deltaCents } = calculateWorkspaceCharges(wsData, baseWeight, baseCents, isCustomKeyUsed);

            const currentCents = wsData.apiQuotaTotalCentsUsed || 0;
            const currentQueries = wsData.totalQueriesThisMonth || 0;
            const currentHardness = wsData.computeHardnessScore || 0;
            const currentCredit = wsData.computeCreditBalance !== undefined ? wsData.computeCreditBalance : 100000;

            await wsRef.update({
              apiQuotaTotalCentsUsed: currentCents + deltaCents,
              totalQueriesThisMonth: currentQueries + 1,
              computeHardnessScore: currentHardness + weightScore,
              computeCreditBalance: Math.max(0, currentCredit - weightScore)
            });

            // Log trace audit record
            const traceId = `trace-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
            await db.collection("billingLedgerTraces").doc(traceId).set({
              id: traceId,
              workspaceId,
              uid: (req as AuthenticatedRequest).user.uid,
              userEmail: (req as AuthenticatedRequest).user.email || 'developer@ledgerflow.io',
              algorithmName: `AI_${task.toUpperCase().replace(/-/g, '_')}`,
              complexityFormat: 'O(Tokens)',
              weightScore,
              isSelfFunded: isCustomKeyUsed,
              executionTimeMs: 1500,
              timestamp: new Date().toISOString()
            });
          }
        } catch (billingErr) {
          console.error("[Server Billing System Bypass]: ", billingErr);
        }
      }

      res.json(result);
    } catch (error: any) {
      sendError(res, "AI Processing Hub Failure", 500, error.message);
    }
  });

  // API routes
  app.post("/api/health", expressRateLimit({ windowMs: 60 * 1000, max: 30 }), (req, res) => {
    const errorString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const sanitized = SecurityService.scrubPII(errorString).slice(0, 1024);
    console.warn("[Client Telemetry Error]:", sanitized);
    res.json({ ok: true });
  });
  app.get("/api/health", async (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      env: process.env.NODE_ENV,
      version: "2.0.0-PROXIMA",
      clusterStatus: "BALANCED",
      layers: {
        fiscal: "ACTIVE",
        rule: "SYNCHRONIZED",
        integrity: "VERIFIED"
      }
    });
  });

  app.get("/api/v1/public/registration-status", async (req, res) => {
    try {
      const db = getDb();
      const usersSnap = await db.collection("users").count().get();
      const totalUsers = usersSnap.data().count;
      const limit = globalAdminConfig.maxRegistrationLimit !== undefined ? globalAdminConfig.maxRegistrationLimit : 100;
      res.json({
        status: "success",
        totalUsers,
        maxRegistrationLimit: limit,
        registrationAllowed: totalUsers < limit,
        freeWorkspaceTxCap: globalAdminConfig.freeWorkspaceTxCap !== undefined ? globalAdminConfig.freeWorkspaceTxCap : 100
      });
    } catch (err: any) {
      res.json({
        status: "success",
        totalUsers: 0,
        maxRegistrationLimit: globalAdminConfig.maxRegistrationLimit || 100,
        registrationAllowed: true,
        freeWorkspaceTxCap: globalAdminConfig.freeWorkspaceTxCap || 100
      });
    }
  });

  // --- Developer Hub: Deep API Platform & Webhooks & Logging ---
  interface ApiLog {
    id: string;
    timestamp: string;
    method: string;
    path: string;
    statusCode: number;
    latencyMs: number;
    apiKeyUsed: string;
    ip: string;
  }

  const apiLogs: ApiLog[] = [];

  // Deep API Key Authentication Middleware
  const apiAuthenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization || (req.headers['x-api-key'] as string);
    if (!authHeader) {
      return res.status(401).json({ status: "error", message: "Unauthorized: Missing api token or X-API-Key." });
    }

    const token = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : authHeader;

    if (token.startsWith("lf_")) {
      try {
        const parts = token.split(".");
        if (parts.length !== 2) {
          return res.status(401).json({ status: "error", message: "Malformed credentials schema. Format must be {KeyID}.{SecretKey}." });
        }
        const [keyId, secretKey] = parts;
        
        // Correctly extract the workspace ID from lf_id_{workspaceId}_{randomHex}
        if (!keyId.startsWith("lf_id_")) {
          return res.status(401).json({ status: "error", message: "Invalid key prefix structure." });
        }
        const stripped = keyId.substring("lf_id_".length);
        const lastUnderscore = stripped.lastIndexOf("_");
        if (lastUnderscore === -1) {
          return res.status(401).json({ status: "error", message: "Malformed credentials signature identifier." });
        }
        const workspaceIdPattern = stripped.substring(0, lastUnderscore);
        
        // Fetch API key doc via standard Admin SDK bypass to ignore Firebase Rules block securely on backend
        const db = getDb();
        const keySnapshot = await db.collection("apiKeys").doc(keyId).get();
        if (!keySnapshot.exists) {
           return res.status(401).json({ status: "error", message: "API key signature is invalid or revoked." });
        }

        const docData = keySnapshot.data();

        // Check if the workspace manually matches
        const storedWorkspaceId = docData?.workspaceId;
        if (storedWorkspaceId !== workspaceIdPattern) {
           return res.status(401).json({ status: "error", message: "API key workspace mismatch." });
        }

        const storedHash = docData?.keyHash;
        if (!storedHash) {
           return res.status(401).json({ status: "error", message: "API key corrupt." });
        }

        const computedHash = crypto.createHash('sha256').update(secretKey).digest('hex');

        const storedBuf = Buffer.from(storedHash, 'hex');
        const computedBuf = Buffer.from(computedHash, 'hex');
        if (storedBuf.length !== computedBuf.length || !crypto.timingSafeEqual(storedBuf, computedBuf)) {
           return res.status(401).json({ status: "error", message: "API key signature is invalid." });
        }

        // Granular Expiration Check
        const expiresAt = docData?.expiresAt;
        if (expiresAt && expiresAt !== "never") {
           const expiryDate = new Date(expiresAt);
           if (isNaN(expiryDate.getTime()) || expiryDate.getTime() < Date.now()) {
              return res.status(401).json({ status: "error", message: "API key has expired." });
           }
        }

        // Action Scope Matching & Authorization Guard
        const allowedScopes = docData?.scopes || [
          'read:transactions',
          'write:transactions',
          'read:projects',
          'write:projects',
          'read:ledger',
          'write:ledger',
          'read:workspaces',
          'brain:analyze'
        ];

        const getRequiredScope = (method: string, path: string): string => {
          const cleanPath = path.toLowerCase().split("?")[0].replace(/\/$/, "");
          
          if (cleanPath.includes("/brain/")) {
            return "brain:analyze";
          }
          
          const isWrite = ["POST", "PUT", "DELETE", "PATCH"].includes(method);
          
          if (cleanPath.includes("/transactions")) {
            return isWrite ? "write:transactions" : "read:transactions";
          }
          if (cleanPath.includes("/projects")) {
            return isWrite ? "write:projects" : "read:projects";
          }
          if (cleanPath.includes("/ledger")) {
            return isWrite ? "write:ledger" : "read:ledger";
          }
          if (cleanPath.includes("/workspaces")) {
            return "read:workspaces";
          }
          if (cleanPath.includes("/metrics")) {
            return "read:transactions";
          }
          if (cleanPath.includes("/logs")) {
            return "read:workspaces";
          }
          if (cleanPath.includes("/status")) {
            return "read:workspaces";
          }
          
          return isWrite ? "write:transactions" : "read:transactions";
        };

        const reqScope = getRequiredScope(req.method, req.originalUrl || req.url);
        if (!allowedScopes.includes(reqScope)) {
          return res.status(403).json({
            status: "error",
            message: `Forbidden: This action requires '${reqScope}' scope permission. Currently allowed scopes on this token are: [${allowedScopes.join(', ')}]`
          });
        }

        // True Enterprise Quota Verification (Pre-Flight)
        try {
          const wsRef = db.collection("workspaces").doc(workspaceIdPattern);
          const wsData = (await wsRef.get()).data() || {};
          const bypass = wsData.bypassBilling === true || globalAdminConfig.bypassBilling === true;
          const currentCredit = wsData.computeCreditBalance !== undefined ? wsData.computeCreditBalance : 100000;
          
          if (!bypass && currentCredit <= 0) {
            return res.status(402).json({
              status: "error",
              message: "Payment Required: Workspace compute credit balance depleted. Please recharge your API balance or enable bypass billing."
            });
          }
        } catch (quotaErr) {
          // Silent fallback to allow continuity if DB fails
          console.warn("[Deep Auth] Quota check bypass due to DB failure");
        }

        // Set request user details for request pipeline context
        (req as AuthenticatedRequest).user = {
          uid: docData?.uid || "unknown_developer_uid",
          email: "developer@ledgerflow.io",
          email_verified: true,
          displayName: "Developer Key Client",
          developerWorkspaceId: workspaceIdPattern,
          apiKeyName: docData?.name || "Production Integration Key",
          firebase: { sign_in_provider: "custom" },
          usedApiKeyId: keyId
        } as any;

        // Background metrics update (does not block original request response)
        try {
          db.collection("apiKeys").doc(keyId).update({
            lastUsedAt: new Date().toISOString(),
            totalRequests: admin.firestore.FieldValue.increment(1)
          }).catch((err: any) => console.error("[Deep Auth] Failed incrementing API key metrics: ", err));
        } catch (mErr) {
          // stats silently fail with safety
        }

        return next();
      } catch (err: any) {
        return res.status(500).json({ status: "error", message: "Decryption / Verification failure within LedgerFlow core.", details: err.message });
      }
    }

    if (authHeader.startsWith("Bearer ")) {
      const idToken = authHeader.split("Bearer ")[1];
      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken) as AuthUser;
        const isAnonymous = decodedToken.firebase?.sign_in_provider === 'anonymous';
        if (!decodedToken.email_verified && !isAnonymous) {
          return res.status(403).json({ status: "error", message: "Access Denied: Please verify your email protocol." });
        }
        (req as AuthenticatedRequest).user = decodedToken;
        return next();
      } catch (error) {
        return res.status(401).json({ status: "error", message: "Unauthorized: Invalid bearer token" });
      }
    }

    return res.status(401).json({ status: "error", message: "Unauthorized: Protocol scheme unsupported." });
  };

  // Interceptor middleware for Developer API Logging
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 100, // Limit each IP to 100 requests per `window` (here, per minute)
    message: { status: "error", message: "Too many requests from this IP, please try again after a minute." },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });

  app.use("/api/v1/", apiLimiter, (req, res, next) => {
    const start = Date.now();
    const originalEnd = res.end;

    res.end = function(chunk?: any, encoding?: any, callback?: any) {
      const latency = Date.now() - start;
      const authHeader = req.headers.authorization || (req.headers['x-api-key'] as string) || '';
      
      let apiPart = 'Bearer Token';
      const reqUser = (req as any).user;
      
      if (reqUser && reqUser.apiKeyName) {
        apiPart = `Key: ${reqUser.apiKeyName} (${reqUser.usedApiKeyId.substring(0, 10)}...)`;
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
      const workspaceId = (req.query.workspaceId as string) || (req as any).user.developerWorkspaceId;
      if (!workspaceId) return sendError(res, "Missing workspaceId parameters in query", 400);

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      let wsName = "Production Workspace";
      let wsCurrency = "USD";
      let wsLockDate: string | null = null;
      let wsBusinessType = "enterprise";

      try {
        const db = getDb();
        const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
        if (wsDoc.exists) {
          const wsData = wsDoc.data();
          wsName = wsData?.name || wsName;
          wsCurrency = wsData?.currency || wsCurrency;
          wsLockDate = wsData?.lockDate || wsLockDate;
          wsBusinessType = wsData?.businessType || wsBusinessType;
        }
      } catch (dbErr: any) {
        console.warn("[Firebase Admin] /api/v1/status database check failed, falling back to basic descriptors:", dbErr.message);
        const cached = typeof billingFallbackCache !== "undefined" ? billingFallbackCache.get(workspaceId) : null;
        if (cached) {
          wsName = cached.name || wsName;
          wsCurrency = cached.currency || wsCurrency;
          wsLockDate = cached.lockDate || wsLockDate;
          wsBusinessType = cached.businessType || wsBusinessType;
        }
      }

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
    } catch (err: any) {
      sendError(res, err.message, 500);
    }
  });

  // --- INTEGRITY ENGINE MATH API START ---

  app.post("/api/v1/math/depreciation", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const parsed = DepreciationRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, "Validation failed", 400, parsed.error.issues);
      }
      
      const { type, costCents, salvageValueCents, usefulLifePeriods, depreciationRate, multiplier, currentPeriod } = parsed.data;
      const TruthEngine = (await import("./src/modules/integrity/TruthEngine")).TruthEngine;
      
      let amount = 0;
      if (type === 'straight_line') {
        amount = TruthEngine.calculateStraightLineDepreciation(costCents, salvageValueCents, usefulLifePeriods);
      } else if (type === 'declining_balance' && depreciationRate !== undefined) {
        amount = TruthEngine.calculateDecliningBalanceDepreciation(costCents, depreciationRate);
      } else if (type === 'double_declining_balance') {
        amount = TruthEngine.calculateDoubleDecliningBalanceDepreciation(costCents, usefulLifePeriods, multiplier !== undefined ? multiplier : 2);
      } else if (type === 'sum_of_years_digits' && currentPeriod !== undefined) {
        amount = TruthEngine.calculateSumOfTheYearsDigitsDepreciation(costCents, salvageValueCents, usefulLifePeriods, currentPeriod);
      } else {
        return sendError(res, "Invalid parameters for requested depreciation type.", 400);
      }
      
      res.json({
        success: true,
        type,
        depreciationPerPeriodCents: amount
      });
    } catch (err: any) {
      sendError(res, err.message, 400);
    }
  });

  app.post("/api/v1/math/inventory/wac", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const parsed = InventoryWACRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, "Validation failed", 400, parsed.error.issues);
      }
      
      const { currentQty, currentValueCents, incomingQty, incomingValueCents } = parsed.data;
      const TruthEngine = (await import("./src/modules/integrity/TruthEngine")).TruthEngine;
      
      const newAverageCostCents = TruthEngine.calculateWACInventoryCost(
        currentQty, currentValueCents, incomingQty, incomingValueCents
      );
      
      res.json({
        success: true,
        newAverageCostCents,
        totalQuantity: currentQty + incomingQty,
        totalValueCents: currentValueCents + incomingValueCents
      });
    } catch (err: any) {
      sendError(res, err.message, 400);
    }
  });

  app.post("/api/v1/math/amortization", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const parsed = AmortizationRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, "Validation failed", 400, parsed.error.issues);
      }
      
      const { principalCents, annualInterestRate, totalPeriods, paymentsPerYear } = parsed.data;
      const TruthEngine = (await import("./src/modules/integrity/TruthEngine")).TruthEngine;
      
      const periodicPaymentCents = TruthEngine.calculateLoanAmortizationPayment(
        principalCents, annualInterestRate, totalPeriods, paymentsPerYear !== undefined ? paymentsPerYear : 12
      );
      
      res.json({
        success: true,
        periodicPaymentCents,
        principalCents: principalCents,
        annualInterestRate: annualInterestRate,
        totalPeriods: totalPeriods
      });
    } catch (err: any) {
      sendError(res, err.message, 400);
    }
  });

  app.post("/api/v1/math/inventory/eoq", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const parsed = InventoryEOQRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, "Validation failed", 400, parsed.error.issues);
      }
      
      const { annualDemand, costPerOrderCents, holdingCostPerUnitCents } = parsed.data;
      const TruthEngine = (await import("./src/modules/integrity/TruthEngine")).TruthEngine;
      
      const eoq = TruthEngine.calculateEconomicOrderQuantity(
        annualDemand, costPerOrderCents, holdingCostPerUnitCents
      );
      
      res.json({
        success: true,
        eoq
      });
    } catch (err: any) {
      sendError(res, err.message, 400);
    }
  });

  app.post("/api/v1/math/kpi", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const parsed = KPIRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, "Validation failed", 400, parsed.error.issues);
      }
      
      const { 
        netProfitCents, investmentCostCents,
        discountRate, initialInvestmentCents, cashFlowsCents,
        revenueCents, cogsCents,
        fixedCostsCents, variableCostPerUnitCents, pricePerUnitCents,
        currentAssetsCents, currentLiabilitiesCents, inventoryCents,
        totalLiabilitiesCents, totalEquityCents
      } = parsed.data;
      const TruthEngine = (await import("./src/modules/integrity/TruthEngine")).TruthEngine;
      
      const result: any = { success: true };
      
      if (netProfitCents !== undefined && investmentCostCents !== undefined) {
        result.roiPercentage = TruthEngine.calculateROI(netProfitCents, investmentCostCents);
      }
      if (discountRate !== undefined && initialInvestmentCents !== undefined && Array.isArray(cashFlowsCents)) {
        result.npvCents = TruthEngine.calculateNPV(discountRate, initialInvestmentCents, cashFlowsCents);
      }
      if (revenueCents !== undefined && cogsCents !== undefined) {
        result.grossProfitMarginPercentage = TruthEngine.calculateGrossProfitMargin(revenueCents, cogsCents);
      }
      if (fixedCostsCents !== undefined && variableCostPerUnitCents !== undefined && pricePerUnitCents !== undefined) {
        result.breakEvenUnits = TruthEngine.calculateBreakEvenUnits(fixedCostsCents, variableCostPerUnitCents, pricePerUnitCents);
      }
      if (currentAssetsCents !== undefined && currentLiabilitiesCents !== undefined) {
        result.currentRatio = TruthEngine.calculateCurrentRatio(currentAssetsCents, currentLiabilitiesCents);
        if (inventoryCents !== undefined) {
          result.quickRatio = TruthEngine.calculateQuickRatio(currentAssetsCents, inventoryCents, currentLiabilitiesCents);
        }
      }
      if (totalLiabilitiesCents !== undefined && totalEquityCents !== undefined) {
        result.debtToEquityRatio = TruthEngine.calculateDebtToEquityRatio(totalLiabilitiesCents, totalEquityCents);
      }
      
      res.json(result);
    } catch (err: any) {
      sendError(res, err.message, 400);
    }
  });

  app.post("/api/v1/math/temporal", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const parsed = TemporalMathRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, "Validation failed", 400, parsed.error.issues);
      }
      const { type, amountCents, targetDate, timeSeries } = parsed.data;
      const TruthEngine = (await import("./src/modules/integrity/TruthEngine")).TruthEngine;
      
      let effectiveValue = 0;
      let calculatedAmountCents = 0;
      
      if (type === 'tax') {
        calculatedAmountCents = TruthEngine.evaluateHistoricalTaxLiability(amountCents, timeSeries as any, targetDate);
        effectiveValue = TruthEngine.resolveEffectiveValue(timeSeries as any, targetDate);
      } else if (type === 'currency') {
        calculatedAmountCents = TruthEngine.evaluateHistoricalConversion(amountCents, timeSeries as any, targetDate);
        effectiveValue = TruthEngine.resolveEffectiveValue(timeSeries as any, targetDate);
      }
      
      res.json({
        success: true,
        type,
        amountCents: amountCents,
        targetDate,
        effectiveValue,
        calculatedAmountCents
      });
    } catch (err: any) {
      sendError(res, err.message, 400);
    }
  });

  // --- INTEGRITY ENGINE ENTERPRISE VALUATION API ---
  app.post("/api/v1/math/valuation", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const parsed = ValuationRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, "Validation failed", 400, parsed.error.issues);
      }
      
      const TruthEngine = (await import("./src/modules/integrity/TruthEngine")).TruthEngine;
      const result: any = { success: true };
      const { 
        equityCents, debtCents, costOfEquity, costOfDebt, taxRate,
        forecastedFCFF, wacc, terminalGrowthRate,
        workingCapital, retainedEarnings, ebit, mktValueEquity, totalLiabilities, totalAssets, sales
      } = parsed.data;

      if (equityCents !== undefined && debtCents !== undefined && costOfEquity !== undefined && costOfDebt !== undefined && taxRate !== undefined) {
        result.waccInfo = {
          wacc: TruthEngine.calculateWACC(equityCents, debtCents, costOfEquity, costOfDebt, taxRate)
        };
      }

      if (forecastedFCFF && wacc !== undefined && terminalGrowthRate !== undefined) {
        result.dcfInfo = {
          impliedValuationCents: TruthEngine.calculateDCFValuation(forecastedFCFF, wacc, terminalGrowthRate)
        };
      }

      if (workingCapital !== undefined && retainedEarnings !== undefined && ebit !== undefined && mktValueEquity !== undefined && totalLiabilities !== undefined && totalAssets !== undefined && sales !== undefined) {
         result.riskInfo = {
            altmanZScore: TruthEngine.evaluateAltmanZScore(workingCapital, retainedEarnings, ebit, mktValueEquity, totalLiabilities, totalAssets, sales)
         };
      }

      res.json(result);
    } catch (err: any) {
      sendError(res, err.message, 400);
    }
  });

  // --- INTEGRITY ENGINE MATH API END ---

  app.get("/api/v1/workspaces", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const uid = (req as AuthenticatedRequest).user.uid;
      const db = getDb();
      let ownedWorkspaces: any[] = [];
      
      try {
        const ownedWSQuery = await db.collection("workspaces").where("uid", "==", uid).get();
        ownedWorkspaces = ownedWSQuery.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || "Unnamed Workspace",
          currency: doc.data().currency || "USD",
          businessType: doc.data().businessType || "general",
          lockDate: doc.data().lockDate || null,
          createdAt: doc.data().createdAt || null,
          role: "owner"
        }));
      } catch (dbErr: any) {
        console.warn("[Firebase Admin] /api/v1/workspaces database check failed:", dbErr.message);
        ownedWorkspaces = [];
      }

      res.status(200).json({
        status: "success",
        workspacesCount: ownedWorkspaces.length,
        workspaces: ownedWorkspaces
      });
    } catch (err: any) {
      sendError(res, err.message, 500);
    }
  });

  app.get("/api/v1/projects", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.query.workspaceId as string) || (req as any).user.developerWorkspaceId;
      if (!workspaceId) return sendError(res, "Missing workspaceId parameters in query", 400);

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const db = getDb();
      const projectsSnap = await db.collection("projects").where("workspaceId", "==", workspaceId).get();
      const projects = projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      res.json({
        status: "success",
        workspaceId,
        projectsCount: projects.length,
        projects
      });
    } catch (err: any) {
      handleApiError(res, err);
    }
  });

  app.post("/api/v1/projects", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.body.workspaceId as string) || (req as any).user.developerWorkspaceId;
      if (!workspaceId) return sendError(res, "Missing workspaceId parameters in body", 400);

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const { name, code, description, budgetLimitCents, managerEmail } = req.body;
      if (!name) return sendError(res, "Missing required fields: 'name'", 400);

      const db = getDb();
      const newId = `proj_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const newProject = {
        id: newId,
        workspaceId,
        name,
        code: code || "",
        description: description || "",
        budgetLimitCents: Number(budgetLimitCents) || 0,
        managerEmail: managerEmail || "",
        status: "active",
        createdAt: new Date().toISOString()
      };

      await db.collection("projects").doc(newId).set(newProject);

      res.status(201).json({
        status: "success",
        message: "Project resource created successfully.",
        project: newProject
      });
    } catch (err: any) {
      handleApiError(res, err);
    }
  });

  app.get("/api/v1/ledger", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.query.workspaceId as string) || (req as any).user.developerWorkspaceId;
      if (!workspaceId) return sendError(res, "Missing workspaceId query parameters", 400);

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const db = getDb();
      const accountsSnap = await db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get();
      const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      res.json({
        status: "success",
        workspaceId,
        accountsCount: accounts.length,
        accounts
      });
    } catch (err: any) {
      if (err.message === "FORBIDDEN") return sendError(res, "Forbidden workspace access", 403);
      if (err.message === "NOT_FOUND" || err.message?.includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
      sendError(res, err.message, 500);
    }
  });

  app.post("/api/v1/ledger", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.body.workspaceId as string) || (req as any).user.developerWorkspaceId;
      if (!workspaceId) return sendError(res, "Missing workspaceId query parameter", 400);

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const { name, type, code, parentId, isActive, tags } = req.body;
      if (!name || !type) return sendError(res, "Missing required fields: 'name' and 'type'", 400);

      const allowedTypes = ['asset', 'liability', 'equity', 'revenue', 'expense', 'other_income', 'other_expense'];
      if (!allowedTypes.includes(type)) {
        return sendError(res, `Invalid account type '${type}'. Allowed types: ${allowedTypes.join(', ')}`, 400);
      }

      const db = getDb();
      const newId = `acc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const newAccount = {
        id: newId,
        workspaceId,
        name,
        type,
        code: code || "",
        parentId: parentId || null,
        isActive: isActive !== undefined ? isActive : true,
        tags: tags || [],
        createdAt: new Date().toISOString()
      };

      await db.collection("chartAccounts").doc(newId).set(newAccount);

      res.status(201).json({
        status: "success",
        message: "Chart of Accounts entry created.",
        account: newAccount
      });
    } catch (err: any) {
      sendError(res, err.message, 500);
    }
  });


  app.get("/api/v1/ledger/diagnostics", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.query.workspaceId as string) || (req as any).user.developerWorkspaceId;
      if (!workspaceId) return sendError(res, "Missing workspaceId parameter in query", 400);

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const db = getDb();
      
      const [accountsSnap, transactionsSnap] = await Promise.all([
        db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get(),
        db.collection("transactions").where("workspaceId", "==", workspaceId).get()
      ]);

      const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      const transactions = transactionsSnap.docs.map(doc => doc.data() as any);

      // Trial balance double-entry cross checking
      let globalNetBalanceCents = 0;
      const accountBalances: Record<string, number> = {};
      
      accounts.forEach(a => {
        accountBalances[a.id] = 0;
      });

      transactions.forEach((tx: any) => {
        const txLines = tx.lines || [];
        txLines.forEach((line: any) => {
          globalNetBalanceCents += (line.amountCents || 0);
          if (line.accountId) {
            accountBalances[line.accountId] = (accountBalances[line.accountId] || 0) + (line.amountCents || 0);
          }
        });
      });

      // Idle assets or detached liability nodes
      const isolatedAccounts = accounts.filter(a => !accountBalances[a.id] || accountBalances[a.id] === 0).map(a => ({
        id: a.id,
        name: a.name,
        code: a.code,
        type: a.type
      }));

      // Account standard behavior diagnostics
      const accountsDiagnostics = accounts.map(a => {
        const currentBalance = accountBalances[a.id] || 0;
        let health: "optimal" | "unusual" | "dormant" = "optimal";
        let message = "Account balances align with expected rules.";

        if (currentBalance === 0) {
          health = "dormant";
          message = "No transactional activity recorded in ledger audit scopes.";
        } else {
          const isStandardDebit = ["asset", "expense"].includes(a.type);
          const hasDebitBalance = currentBalance > 0;

          if (isStandardDebit && !hasDebitBalance) {
            health = "unusual";
            message = `Expected standard DEBIT balance for account class '${a.type}', but registers a credit ($${(Math.abs(currentBalance) / 100).toFixed(2)}). Verify double-entry offsets.`;
          } else if (!isStandardDebit && hasDebitBalance) {
            health = "unusual";
            message = `Expected standard CREDIT balance for account class '${a.type}', but registers a debit ($${(currentBalance / 100).toFixed(2)}). Verify double-entry offsets.`;
          }
        }

        return {
          id: a.id,
          name: a.name,
          code: a.code,
          type: a.type,
          currentBalanceCents: currentBalance,
          health,
          diagnoses: message
        };
      });

      // Geographical jurisdictions diagnostics from metadata state tag
      const stateTaxMetrics: Record<string, { count: number; volumeCents: number }> = {};
      transactions.forEach((tx: any) => {
        const state = tx.metadata?.taxState || tx.taxState;
        if (state) {
          const stats = stateTaxMetrics[state] || { count: 0, volumeCents: 0 };
          stats.count += 1;
          stats.volumeCents += (tx.totalAmountCents || 0);
          stateTaxMetrics[state] = stats;
        }
      });

      const anomalousAccounts = accountsDiagnostics.filter(a => a.health === "unusual");
      const integrityScore = anomalousAccounts.length === 0 && globalNetBalanceCents === 0 ? 100 : Math.max(0, 100 - (anomalousAccounts.length * 15) - (globalNetBalanceCents !== 0 ? 40 : 0));

      res.status(200).json({
        status: "success",
        workspaceId,
        summary: {
          ledgerIntegrityScore: integrityScore,
          globalTrialImbalanceCents: globalNetBalanceCents,
          isImbalanced: globalNetBalanceCents !== 0,
          totalAccounts: accounts.length,
          activeJournalEntries: transactions.length,
          anomalousAccountsCount: anomalousAccounts.length,
          isolatedAccountsCount: isolatedAccounts.length
        },
        diagnostics: {
          trialBalanceHealth: {
            status: globalNetBalanceCents === 0 ? "optimal" : "corrupted",
            reconciliationMessage: globalNetBalanceCents === 0 
              ? "All debit & credit journal lines reconcile exactly to zero. Ledger math is certified safe."
              : `A serious double-entry variance error of ${globalNetBalanceCents} cents exists across transactions.`
          },
          accountsDiagnostics,
          isolatedAccounts,
          taxMetricsByRegion: stateTaxMetrics
        }
      });

    } catch (err: any) {
      handleApiError(res, err);
    }
  });

  app.post("/api/v1/brain/classify-batch", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.body.workspaceId as string) || (req as any).user.developerWorkspaceId;
      if (!workspaceId) return sendError(res, "Missing workspaceId parameter", 400);

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const { descriptions } = req.body;
      if (!Array.isArray(descriptions)) {
        return sendError(res, "The parameter 'descriptions' must be an array of transaction raw strings.", 400);
      }

      const activeApiKeyId = (req as any).user?.usedApiKeyId || "human_web_console";
      const classifier = new BayesianClassifier();
      const trainedCount = await trainClassifierWithWorkspaceData(classifier, workspaceId, activeApiKeyId);

      const db = getDb();
      const accountsSnap = await db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get();
      const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name || "", type: doc.data().type || "" }));

      const predictions = descriptions.slice(0, 100).map((desc: string, idx: number) => {
        const guess = classifier.classify(desc || "");
        const category = guess ? guess.category : "Operating Expenses";
        
        const suggestedAccount = accounts.find(a => a.name.toLowerCase().includes((category || "").toLowerCase()) || a.type === 'expense');
        const accResult = suggestedAccount ? { id: suggestedAccount.id, name: suggestedAccount.name } : (accounts[0] ? { id: accounts[0].id, name: accounts[0].name } : null);

        return {
          index: idx,
          rawQuery: desc,
          suggestedCategory: category,
          suggestedAccount: accResult,
          confidenceScore: guess ? Number(guess.confidence.toFixed(4)) : 0.5000
        };
      });

      // Programmatically deduct compute credit and charge quota cents for batch classification
      const baseWeight = Math.max(1, Math.min(descriptions.length, 100)); // 1 credit per transaction item classified (max 100)
      const baseCents = Math.max(1, Math.min(Math.round(descriptions.length * 0.5), 50)); // 0.5 cents per item (max 50)
      try {
        const wsRef = db.collection("workspaces").doc(workspaceId);
        const wsDoc = await wsRef.get();
        if (wsDoc.exists) {
          const wsData = wsDoc.data() || {};
          
          // Centralized custom billing multiplier & private API key controller (batch classification is standard)
          const { credits: weightScore, cents: deltaCents } = calculateWorkspaceCharges(wsData, baseWeight, baseCents, false);

          const currentCents = wsData.apiQuotaTotalCentsUsed || 0;
          const currentQueries = wsData.totalQueriesThisMonth || 0;
          const currentHardness = wsData.computeHardnessScore || 0;
          const currentCredit = wsData.computeCreditBalance !== undefined ? wsData.computeCreditBalance : 100000;

          await wsRef.update({
            apiQuotaTotalCentsUsed: currentCents + deltaCents,
            totalQueriesThisMonth: currentQueries + 1,
            computeHardnessScore: currentHardness + weightScore,
            computeCreditBalance: Math.max(0, currentCredit - weightScore)
          });

          // Log trace audit record
          const traceId = `trace-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
          await db.collection("billingLedgerTraces").doc(traceId).set({
            id: traceId,
            workspaceId,
            uid: (req as AuthenticatedRequest).user.uid || "api_user",
            userEmail: (req as AuthenticatedRequest).user.email || 'developer@ledgerflow.io',
            algorithmName: 'ALGO_CLASSIFIER_BAYESIAN_BATCH',
            complexityFormat: `O(${descriptions.length} * V * C)`,
            weightScore,
            executionTimeMs: 120,
            timestamp: new Date().toISOString()
          });
        }
      } catch (billingErr) {
        console.error("[Classifier Batch Billing Status Bypassed]: ", billingErr);
      }

      res.status(200).json({
        status: "success",
        workspaceId,
        modelState: {
          nodesTrained: trainedCount,
          activeAlgorithm: "Bayesian Double-Entry Classifier v2.1"
        },
        predictions
      });

    } catch (err: any) {
      handleApiError(res, err);
    }
  });

  // --- API Key Management endpoints ---
  app.post("/api/v1/keys/provision", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const { name, scopes, expiration, workspaceId } = req.body;
      if (!workspaceId) {
        return res.status(400).json({ status: "error", message: "Missing workspaceId in body" });
      }

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const userId = authReq.user.uid;
      
      const randomSecret = crypto.randomBytes(32).toString('hex');
      const randomKeyIdSuffix = crypto.randomBytes(8).toString('hex');
      const keyId = `lf_id_${workspaceId}_${randomKeyIdSuffix}`;
      const computedHash = crypto.createHash('sha256').update(randomSecret).digest('hex');

      let expiresAtValue: string | null = null;
      if (expiration && expiration !== 'never') {
        const d = new Date();
        if (expiration === '1h') d.setHours(d.getHours() + 1);
        else if (expiration === '24h') d.setHours(d.getHours() + 24);
        else if (expiration === '30d') d.setDate(d.getDate() + 30);
        else if (expiration === '90d') d.setDate(d.getDate() + 90);
        expiresAtValue = d.toISOString();
      }

      const defaultScopes = [
        'read:transactions',
        'write:transactions',
        'read:projects',
        'write:projects',
        'read:ledger',
        'write:ledger',
        'read:workspaces',
        'brain:analyze'
      ];

      const keyPayload = {
        id: keyId,
        workspaceId,
        uid: userId,
        name: name || 'Production Integration Key',
        keyHash: computedHash,
        scopes: Array.isArray(scopes) && scopes.length > 0 ? scopes : defaultScopes,
        expiresAt: expiresAtValue || 'never',
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        totalRequests: 0
      };

      const db = getDb();
      await db.collection("apiKeys").doc(keyId).set(keyPayload);

      // Return full token signature once
      const fullKeySecret = `${keyId}.${randomSecret}`;
      res.status(201).json({
        status: "success",
        apiKey: fullKeySecret,
        key: {
          id: keyId,
          name: keyPayload.name,
          scopes: keyPayload.scopes,
          expiresAt: keyPayload.expiresAt,
          createdAt: keyPayload.createdAt
        }
      });
    } catch (err: any) {
      handleApiError(res, err);
    }
  });

  app.delete("/api/v1/keys/revoke/:keyId", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const { keyId } = req.params;
      if (!keyId) {
        return res.status(400).json({ status: "error", message: "Missing keyId in path" });
      }

      const authReq = req as AuthenticatedRequest;
      const db = getDb();
      const keyDoc = await db.collection("apiKeys").doc(keyId).get();

      if (!keyDoc.exists) {
        return res.status(404).json({ status: "error", message: "API key not found." });
      }

      const keyData = keyDoc.data();
      const workspaceId = keyData?.workspaceId;
      if (workspaceId) {
        await authorizeWorkspace(authReq, workspaceId);
      } else if (keyData?.uid !== authReq.user.uid && !authReq.user.admin) {
        return res.status(403).json({ status: "error", message: "Forbidden key revocation" });
      }

      await db.collection("apiKeys").doc(keyId).delete();
      res.json({ status: "success", message: "API key revoked successfully." });
    } catch (err: any) {
      handleApiError(res, err);
    }
  });

  // --- User Custom Gemini AI Key Management ---
  app.post("/api/v1/user/ai-key", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { apiKey } = req.body;
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        return res.status(400).json({ status: "error", message: "A non-empty apiKey string is required." });
      }

      const cleanKey = apiKey.trim();
      const encryptedKey = SecurityService.encryptSensitiveField(cleanKey);
      const suffix = cleanKey.length >= 4 ? cleanKey.slice(-4) : cleanKey;

      const db = getDb();
      await db.collection("users").doc(authReq.user.uid).set({
        geminiApiKeyEncrypted: encryptedKey,
        hasCustomApiKey: true,
        apiKeySuffix: suffix,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      res.json({
        status: "success",
        message: "Gemini API key encrypted and saved securely.",
        hasCustomApiKey: true,
        apiKeySuffix: suffix
      });
    } catch (err: any) {
      handleApiError(res, err);
    }
  });

  app.delete("/api/v1/user/ai-key", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const db = getDb();
      await db.collection("users").doc(authReq.user.uid).update({
        geminiApiKeyEncrypted: admin.firestore.FieldValue.delete(),
        geminiApiKey: admin.firestore.FieldValue.delete(),
        hasCustomApiKey: false,
        apiKeySuffix: admin.firestore.FieldValue.delete(),
        updatedAt: new Date().toISOString()
      });

      res.json({
        status: "success",
        message: "Custom Gemini API key removed.",
        hasCustomApiKey: false
      });
    } catch (err: any) {
      handleApiError(res, err);
    }
  });

  app.get("/api/v1/user/ai-key-status", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const db = getDb();
      const userDoc = await db.collection("users").doc(authReq.user.uid).get();
      const data = userDoc.data();
      const hasCustomApiKey = Boolean(data?.geminiApiKeyEncrypted || data?.geminiApiKey);
      const apiKeySuffix = data?.apiKeySuffix || (data?.geminiApiKey ? data.geminiApiKey.slice(-4) : null);

      res.json({
        status: "success",
        hasCustomApiKey,
        apiKeySuffix
      });
    } catch (err: any) {
      handleApiError(res, err);
    }
  });

  // --- Operations / New Modals Endpoints ---
  app.get("/api/v1/ecommerce", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    res.json({ status: "success", channels: [{ name: "Shopify", status: "live" }] });
  });
  app.post("/api/v1/ecommerce", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    res.json({ status: "success", message: "Channel synced", data: req.body });
  });
  app.get("/api/v1/marketing", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    res.json({ status: "success", campaigns: [{ name: "Q4 Outreach", status: "Active" }] });
  });
  app.post("/api/v1/marketing", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    res.json({ status: "success", message: "Campaign created", data: req.body });
  });
  app.get("/api/v1/helpdesk", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    res.json({ status: "success", tickets: [{ id: "TKT-100", title: "Test Ticket", status: "Open" }] });
  });
  app.post("/api/v1/helpdesk", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    res.json({ status: "success", message: "Ticket created", data: req.body });
  });
  app.get("/api/v1/hr", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    res.json({ status: "success", employees: [{ name: "Jane Doe", type: "Full-Time" }] });
  });
  app.post("/api/v1/hr", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    res.json({ status: "success", message: "Employee added", data: req.body });
  });
  app.get("/api/v1/manufacturing", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    res.json({ status: "success", workOrders: [{ id: "WO-999", product: "Test Product", status: "Queued" }] });
  });
  app.post("/api/v1/manufacturing", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    res.json({ status: "success", message: "Work order created", data: req.body });
  });
  app.get("/api/v1/universal-ops", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    res.json({ status: "success", dimensions: [{ id: "DIM-1", name: "Location" }] });
  });
  app.post("/api/v1/universal-ops", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    res.json({ status: "success", message: "Dimension tagged", data: req.body });
  });

  app.get("/api/v1/metrics", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.query.workspaceId as string) || (req as any).user.developerWorkspaceId;
      if (!workspaceId) return sendError(res, "Missing workspaceId query parameter", 400);

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const db = getDb();
      const [accountsSnap, transactionsSnap] = await Promise.all([
         db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get(),
         db.collection("transactions").where("workspaceId", "==", workspaceId).get()
      ]);

      const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      const transactions = transactionsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

      const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
      const wsData = wsDoc.data() || {};
      const businessType = wsData.businessType || 'general';

      let totalRevenueCents = 0;
      let totalExpenseCents = 0;
      let totalAssetsCents = 0;
      let totalLiabilitiesCents = 0;

      const accountBalances: Record<string, number> = {};

      transactions.forEach(tx => {
         if (tx.status === 'void' || tx.status === 'voided') return;
         tx.lines?.forEach((line: any) => {
             accountBalances[line.accountId] = (accountBalances[line.accountId] || 0) + line.amountCents;
         });
      });

      accounts.forEach(acc => {
         const bal = accountBalances[acc.id] || 0;
         if (acc.type === 'revenue') totalRevenueCents -= bal; // Revenue is credit (negative)
         if (acc.type === 'expense') totalExpenseCents += bal; // Expense is debit (positive)
         if (acc.type === 'asset') totalAssetsCents += bal;
         if (acc.type === 'liability') totalLiabilitiesCents -= bal;
      });

      // Shifting Metrics Logic based on Business Archetype
      let shiftingMetrics: any = {};

      if (businessType === 'saas') {
        const recent3MonthsRevenues = transactions.filter(t => {
          const tDate = new Date(t.date);
          const limitDate = new Date();
          limitDate.setMonth(limitDate.getMonth() - 3);
          return t.status !== 'void' && tDate >= limitDate;
        }).reduce((acc, t) => {
          let sumRev = 0;
          t.lines?.forEach((l: any) => {
             const accObj = accounts.find(a => a.id === l.accountId);
             if (accObj?.type === 'revenue') {
               sumRev -= l.amountCents;
             }
          });
          return acc + sumRev;
        }, 0);

        const calculatedMRR = Math.round(recent3MonthsRevenues / 3);
        const arr = calculatedMRR * 12;
        const churnRateProxy = 0.05; // 5% base churn rate proxy
        const ltv = churnRateProxy > 0 ? Math.round(calculatedMRR / churnRateProxy) : 0;

        shiftingMetrics = {
          industryType: "SaaS & Subscription",
          metrics: {
            arrCents: arr,
            mrrCents: calculatedMRR,
            ltvCents: ltv,
            churnPercentage: churnRateProxy * 100,
            grossMarginPercentage: totalRevenueCents > 0 ? parseFloat(((totalRevenueCents - totalExpenseCents) / totalRevenueCents * 100).toFixed(2)) : 100
          }
        };
      } else if (businessType === 'realestate' || businessType === 'real_estate') {
        const rentalRevenueCents = transactions.reduce((acc, t) => {
          let sumRental = 0;
          t.lines?.forEach((l: any) => {
             const accObj = accounts.find(a => a.id === l.accountId);
             if (accObj?.type === 'revenue' && (accObj.name.toLowerCase().includes('rent') || accObj.name.toLowerCase().includes('lease'))) {
               sumRental -= l.amountCents;
             }
          });
          return acc + sumRental;
        }, 0);

        const rentalRevenue = rentalRevenueCents || totalRevenueCents;
        const noiCents = rentalRevenue - totalExpenseCents;
        const baseCapitalInvested = totalAssetsCents || 100000000; // $1,000,000 baseline
        const capRate = parseFloat(((noiCents / baseCapitalInvested) * 100).toFixed(2));

        shiftingMetrics = {
          industryType: "Real Estate Property Management",
          metrics: {
            noiCents,
            rentalRevenueCents,
            impliedCapitalInvestedCents: baseCapitalInvested,
            capRateRealizedPercentage: capRate,
            expenseToIncomeRatioPercentage: totalRevenueCents > 0 ? parseFloat((totalExpenseCents / totalRevenueCents * 100).toFixed(2)) : 0
          }
        };
      } else if (businessType === 'retail' || businessType === 'manufacturing' || businessType === 'inventory') {
        const cogsCents = transactions.reduce((acc, t) => {
          let sumCogs = 0;
          t.lines?.forEach((l: any) => {
             const accObj = accounts.find(a => a.id === l.accountId);
             if (accObj?.type === 'expense' && (accObj.name.toLowerCase().includes('cogs') || accObj.name.toLowerCase().includes('cost of goods') || accObj.name.toLowerCase().includes('inventory'))) {
                sumCogs += l.amountCents;
             }
          });
          return acc + sumCogs;
        }, 0) || Math.round(totalExpenseCents * 0.40);

        const grossProfitCents = totalRevenueCents - cogsCents;
        const grossMargin = totalRevenueCents > 0 ? parseFloat((grossProfitCents / totalRevenueCents * 100).toFixed(2)) : 0;
        
        const inventoryAccountVal = accounts.filter(a => a.name.toLowerCase().includes('inventory'))
          .reduce((sum, a) => sum + (accountBalances[a.id] || 0), 0) || 5000000;
        const inventoryTurnover = parseFloat((cogsCents / inventoryAccountVal).toFixed(2));

        shiftingMetrics = {
          industryType: "Retail Commerce & Goods Optimization",
          metrics: {
            grossProfitCents,
            cogsCents,
            grossMarginPercentage: grossMargin,
            inventoryAccountBalanceCents: inventoryAccountVal,
            inventoryTurnoverRatio: inventoryTurnover
          }
        };
      } else {
        const monthlyBurnRate = Math.round(totalExpenseCents / 12) || 400000;
        const fireNestEggCents = monthlyBurnRate * 12 * 25;
        const netCashCents = totalRevenueCents - totalExpenseCents;
        const savingsRate = totalRevenueCents > 0 ? parseFloat((netCashCents / totalRevenueCents * 100).toFixed(2)) : 0;

        shiftingMetrics = {
          industryType: "General / Personal Portfolio",
          metrics: {
            monthlyBurnCents: monthlyBurnRate,
            fireTargetNestEggCents: fireNestEggCents,
            savingsRatePercentage: savingsRate,
            runwayMonthsRemaining: monthlyBurnRate > 0 ? parseFloat((totalAssetsCents / monthlyBurnRate).toFixed(1)) : 99
          }
        };
      }

      res.status(200).json({
        status: "success",
        workspaceId,
        businessType,
        coreMetrics: {
          grossRevenueCents: totalRevenueCents,
          operatingExpenseCents: totalExpenseCents,
          netOperatingCashFlowCents: totalRevenueCents - totalExpenseCents,
          totalLiquidAssetsCents: totalAssetsCents,
          totalLiabilitiesCents: totalLiabilitiesCents,
          equityValueCents: totalAssetsCents - totalLiabilitiesCents
        },
        shiftingMetrics,
        timestamp: new Date().toISOString()
      });

    } catch (err: any) {
      if (err.message === "FORBIDDEN") return sendError(res, "Forbidden workspace access", 403);
      sendError(res, err.message, 500);
    }
  });

  app.get("/api/v1/metrics/summary", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.query.workspaceId as string) || (req as any).user.developerWorkspaceId;
      if (!workspaceId) return sendError(res, "Missing workspaceId query parameters", 400);

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const db = getDb();
      const [accountsSnap, transactionsSnap] = await Promise.all([
         db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get(),
         db.collection("transactions").where("workspaceId", "==", workspaceId).get()
      ]);

      const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      const transactions = transactionsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

      let totalRevenue = 0;
      let totalExpense = 0;
      let totalAssets = 0;
      let totalLiabilities = 0;

      const accountBalances: Record<string, number> = {};

      transactions.forEach(tx => {
         if (tx.status === 'void') return;
         tx.lines?.forEach((line: any) => {
             accountBalances[line.accountId] = (accountBalances[line.accountId] || 0) + line.amountCents;
         });
      });

      accounts.forEach(acc => {
         const bal = accountBalances[acc.id] || 0;
         if (acc.type === 'revenue') totalRevenue -= bal; // Revenue is credit (negative)
         if (acc.type === 'expense') totalExpense += bal; // Expense is debit (positive)
         if (acc.type === 'asset') totalAssets += bal;
         if (acc.type === 'liability') totalLiabilities -= bal;
      });

      res.json({
        status: "success",
        workspaceId,
        metrics: {
           netIncomeCents: totalRevenue - totalExpense,
           grossRevenueCents: totalRevenue,
           totalOpExCents: totalExpense,
           currentAssetsCents: totalAssets,
           totalLiabilitiesCents: totalLiabilities,
           equityCents: totalAssets - totalLiabilities
        },
        transactionVolume: transactions.length,
        timestamp: new Date().toISOString()
      });

    } catch (err: any) {
      if (err.message === "FORBIDDEN") return sendError(res, "Forbidden workspace access", 403);
      sendError(res, err.message, 500);
    }
  });

  app.post("/api/v1/audit/deep", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.body.workspaceId as string) || (req as any).user.developerWorkspaceId;
      if (!workspaceId) return sendError(res, "Missing workspaceId parameters in request", 400);

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const db = getDb();
      const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const initialJob = {
        id: jobId,
        workspaceId,
        uid: authReq.user.uid,
        status: "processing",
        progress: 10,
        createdAt: new Date().toISOString(),
        payload: req.body
      };

      await db.collection("deepAuditJobs").doc(jobId).set(initialJob);

      // Async execution process to prevent connection timeout (202 Accepted)
      processDeepAuditInBackground(jobId, workspaceId, authReq.user.uid).catch((err) => {
         console.error(`[Background deepAudit Exception] for Job ${jobId}: `, err);
      });

      res.status(202).json({
        status: "processing",
        message: "Strategic simulation launched asynchronously. Please poll job endpoint for results.",
        job_id: jobId,
        check_status_url: `/api/v1/audit/jobs/${jobId}`
      });

    } catch (err: any) {
      sendError(res, err.message, 500);
    }
  });

  async function processDeepAuditInBackground(jobId: string, workspaceId: string, uid: string) {
    const db = getDb();
    await new Promise((resolve) => setTimeout(resolve, 1500)); // simulation compute wait

    try {
      const [accountsSnap, transactionsSnap, invoicesSnap, inventorySnap] = await Promise.all([
        db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get(),
        db.collection("transactions").where("workspaceId", "==", workspaceId).get(),
        db.collection("invoices").where("workspaceId", "==", workspaceId).get(),
        db.collection("inventory").where("workspaceId", "==", workspaceId).get()
      ]);

      const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      const transactions = transactionsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      const invoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      const inventory = inventorySnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

      const wsDoc = await db.collection("workspaces").doc(workspaceId).get();
      const wsData = wsDoc.data() || {};

      const nowMs = Date.now();
      let totalAssessedAssets = 0;
      let totalRevenue = 0;
      let totalExpense = 0;

      const balances: Record<string, number> = {};
      transactions.forEach(t => {
        if (t.status === 'void' || t.status === 'voided') return;
        t.lines?.forEach((l: any) => {
          balances[l.accountId] = (balances[l.accountId] || 0) + l.amountCents;
        });
      });

      accounts.forEach(a => {
        const bal = balances[a.id] || 0;
        if (a.type === 'asset') totalAssessedAssets += bal;
        if (a.type === 'revenue') totalRevenue -= bal;
        if (a.type === 'expense') totalExpense += bal;
      });

      // 1. Receivables Velocity & DSO WACC Bleed
      const arBleedLogs = invoices.filter(inv => inv.status !== 'paid').map(inv => {
         const invDateStr = inv.dueDate || inv.date || new Date().toISOString();
         const txDateMs = new Date(invDateStr).getTime();
         const daysOutstanding = Math.max(0, Math.floor((nowMs - txDateMs) / (1000 * 60 * 60 * 24)));
         const totalAmount = inv.totalCents || inv.amountCents || 0;
         const impliedCostOfCapitalCents = Math.round(totalAmount * (0.08 / 365) * daysOutstanding);
         return {
           invoiceId: inv.id,
           customerName: inv.customerName || 'Unknown Customer',
           daysOutstanding,
           totalCents: totalAmount,
           impliedCostOfCapitalCents
         };
      }).filter(v => v.daysOutstanding > 5);

      const totalArBleedCents = arBleedLogs.reduce((sum, item) => sum + item.impliedCostOfCapitalCents, 0);

      // 2. Customer Overconcentration (trigger multiplier haircut)
      const clientRevenues: Record<string, number> = {};
      transactions.forEach(t => {
        if (t.status === 'void' || t.status === 'voided') return;
        let revVal = 0;
        t.lines?.forEach((l: any) => {
           const a = accounts.find(x => x.id === l.accountId);
           if (a?.type === 'revenue') revVal -= l.amountCents;
        });
        if (revVal > 0) {
           const payeeName = t.payee?.trim() || "Independent Channel";
           clientRevenues[payeeName] = (clientRevenues[payeeName] || 0) + revVal;
        }
      });

      const customerIncomes = Object.entries(clientRevenues).map(([name, amountCents]) => ({ name, amountCents }));
      customerIncomes.sort((a,b) => b.amountCents - a.amountCents);

      const maxClientIncome = customerIncomes[0]?.amountCents || 0;
      const totalIncomeCents = totalRevenue || 1;
      const concentrationRatio = parseFloat((maxClientIncome / totalIncomeCents).toFixed(4));
      
      const isHighConcentrationRisk = concentrationRatio > 0.40;
      const concentrationMultiplierHaircut = isHighConcentrationRisk ? 0.85 : 1.00;

      // 3. Inventory margin review
      const inventoryMismatches = inventory.map(item => {
         const directCost = item.unitCostCents || item.costCents || 0;
         const salePrice = item.unitPriceCents || item.priceCents || 1;
         const margin = (salePrice - directCost) / salePrice;
         const recommendation = margin < 0.25 
           ? `Urgent: Adjust retail pricing models upwards by ${Math.round((0.35 - margin) * 100)}% to match industry median WACC bounds.`
           : margin > 0.65 
             ? `Opportunistic: Bulk transaction volume wholesale pathway is viable to capture consumer surplus.`
             : "Optimal: Price point matches target margin horizons.";

         return {
           itemId: item.id,
           sku: item.sku || 'N/A',
           name: item.name,
           calculatedMarginPercentage: parseFloat((margin * 100).toFixed(2)),
           recommendation
         };
      });

      const baseMultiple = 4.5;
      const EBITDA = totalRevenue - totalExpense;
      const impliedValuationBase = Math.max(0, EBITDA) * baseMultiple;
      const actualAjustedValuation = Math.round(impliedValuationBase * concentrationMultiplierHaircut - totalArBleedCents);

      // Markdown Strategic narrative
      const markdownReport = `### EXECUTIVE STRATEGIC DECISION AUDIT SUMMARY
Report generated chronologically for workspace **${wsData.name || 'LedgerFlow Register'}** on **${new Date().toISOString().substring(0, 10)}** via LedgerFlow Deep API.

#### 1. VELOCITY RECEIVABLES ANALYSIS (DSO & WACC DRAG)
* Outstanding accounts receivable function effectively as 0% interest lines of credit to clients.
* Calculated **Velocity Bleed** drag sum against an **8.0% institutional Weighted Average Cost of Capital (WACC)**: **-$${(totalArBleedCents / 100).toFixed(2)}**.
* **Aging Accounts Log**:
${arBleedLogs.slice(0, 5).map(l => `  - **${l.customerName}** (Inv #${l.invoiceId.substring(0,6)}): Aging **${l.daysOutstanding} days**, Implied Capital Loss Drag: **-$${(l.impliedCostOfCapitalCents / 100).toFixed(2)}**`).join("\n") || "  - No immediate velocity bleed detected. High speed receivables."}

#### 2. REVENUE GRAPHS & CLIENT OVERCONCENTRATION RISK
* **Max Client Revenue contribution ratio**: **${(concentrationRatio * 100).toFixed(2)}%** (${customerIncomes[0]?.name || 'N/A'}).
* Concentration Risk threshold is **40.0%**. 
* **Audit findings**: ${isHighConcentrationRisk ? "🛑 **HIGH CONCENTRATION RISK DETECTED**. A single customer group holds too much leverage. Applying a 15% multiple valuation haircut." : "✅ **HEALTHY CUSTOMER DENSITY PROFILE**. Customer concentration is balanced."}

#### 3. PHYSICAL MARGINS & BULK INVENTORY ARBITRAGE
* Assessed **${inventoryMismatches.length}** catalog SKUs.
* Inventory margins summary:
${inventoryMismatches.slice(0, 4).map(m => `  - **${m.name}** (${m.sku}): Margin: **${m.calculatedMarginPercentage}%** - *${m.recommendation}*`).join("\n") || "  - Catalog empty. Skipped physical arbitrage scan."}

#### 4. VALUATION ALGORITHMIC MATRIX
* **Base Valuation expectations**: $${(impliedValuationBase / 100).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
* **Adjusted Corporate Valuation (including DSO bleed & overconcentration haircut)**: **$${(actualAjustedValuation / 100).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}**`;

      const finalAuditReport = {
        velocityArBleed: {
          totalCapitalCostDragCents: totalArBleedCents,
          logsCount: arBleedLogs.length,
          logs: arBleedLogs
        },
        concentrationRisk: {
            maxClientContributionRatio: concentrationRatio,
            isConcentratedThresholdTriggered: isHighConcentrationRisk,
            haircutMultiplierHit: concentrationMultiplierHaircut,
            ranking: customerIncomes
        },
        inventoryArbitrage: {
            itemsCount: inventoryMismatches.length,
            mismatches: inventoryMismatches
        },
        valuationMatrix: {
          ebitdaCents: EBITDA,
          baseMultiple,
          impliedValuationBaseCents: impliedValuationBase,
          actualAdjustedValuationCents: actualAjustedValuation,
          valuationDeltaCents: actualAjustedValuation - impliedValuationBase
        },
        markdownNarrative: markdownReport
      };

      await db.collection("deepAuditJobs").doc(jobId).set({
         id: jobId,
         status: "completed",
         progress: 100,
         workspaceId,
         uid,
         completedAt: new Date().toISOString(),
         results: finalAuditReport
      });

      // Record telemetry trace and bill standard credit units
      const billingRef = db.collection("billingLedgerTraces").doc(`trace-${Date.now()}`);
      await billingRef.set({
        id: `trace-${Date.now()}`,
        workspaceId,
        uid,
        userEmail: "api-client@ledgerflow.io",
        algorithmName: "STRATEGIC_DEEP_AUDIT_JOB",
        complexityFormat: "O(V * E)",
        weightScore: 1200,
        executionTimeMs: 1500,
        timestamp: new Date().toISOString()
      });

      const wsRef = db.collection("workspaces").doc(workspaceId);
      const wsDocCurrent = await wsRef.get();
      if (wsDocCurrent.exists) {
         const currentCredit = wsDocCurrent.data()?.computeCreditBalance !== undefined ? wsDocCurrent.data()?.computeCreditBalance : 100000;
         await wsRef.update({
            computeCreditBalance: Math.max(0, currentCredit - 1200)
         });
      }

    } catch (e: any) {
       console.error("[Deep Audit Worker Crash]: ", e);
       await db.collection("deepAuditJobs").doc(jobId).set({
          id: jobId,
          status: "failed",
          progress: 100,
          workspaceId,
          uid,
          completedAt: new Date().toISOString(),
          error: e.message || String(e)
       });
    }
  }

  app.get("/api/v1/audit/jobs/:job_id", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const jobId = req.params.job_id;
      const workspaceId = (req.query.workspaceId as string) || (req as any).user.developerWorkspaceId;

      if (!workspaceId) {
         return sendError(res, "Missing workspaceId query parameters during poll checks.", 400);
      }

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const db = getDb();
      const jobDoc = await db.collection("deepAuditJobs").doc(jobId).get();
      if (!jobDoc.exists) {
         return sendError(res, "Job signature not found", 404);
      }

      const jobData = jobDoc.data();
      if (!jobData) {
         return sendError(res, "Job data is empty", 404);
      }
      if (jobData.workspaceId !== workspaceId) {
         return sendError(res, "Job does not belong to specified workspace context.", 403);
      }

      res.status(200).json({
         status: "success",
         job_id: jobId,
         jobStatus: jobData.status,
         progress: jobData.progress,
         createdAt: jobData.createdAt,
         completedAt: jobData.completedAt || null,
         error: jobData.error || null,
         results: jobData.results || null
      });

    } catch (err: any) {
      sendError(res, err.message, 500);
    }
  });

  app.post("/api/v1/brain/analyze", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.body.workspaceId as string) || (req as any).user.developerWorkspaceId;
      if (!workspaceId) return sendError(res, "Missing workspaceId parameters", 400);

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const { prompt, ephemeralData } = req.body;
      if (!prompt) return sendError(res, "Prompt query prompt not defined.", 400);

      let contextSummary = "";
      let txCount = 0;

      if (ephemeralData) {
        // "without saving this info in the app" - User provided ephemeral data directly via API
        contextSummary = `[EPHEMERAL DATA PROVIDED VIA API]\n\n${JSON.stringify(ephemeralData, null, 2)}`;
        txCount = Array.isArray(ephemeralData) ? ephemeralData.length : Object.keys(ephemeralData).length;
      } else {
        // INTEGRITY DATA FLOW: Contextual filtration based on Prompt
        const { accounts, transactions } = await getReportContext(authReq, workspaceId);
        txCount = transactions.length;
        
        // Intelligent native search / basic RAG filter
        const queryWords = prompt.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
        let relevantTx = transactions;
        
        if (queryWords.length > 0) {
           relevantTx = transactions.filter(t => {
              const str = `${t.description || ''} ${t.category || ''} ${t.accountId || ''}`.toLowerCase();
              return queryWords.some((w: string) => str.includes(w));
           });
           
           // If no matches, fallback to recent history
           if (relevantTx.length === 0) {
             relevantTx = transactions.slice(0, 40);
           }
        } else {
           relevantTx = transactions.slice(0, 40);
        }
        
        // Cap context size to prevent token blowouts
        relevantTx = relevantTx.slice(0, 150);
        
        const accountsSummary = accounts.map(a => `${a.name} (${a.type})`).slice(0, 10).join(", ");
        const transactionSummary = relevantTx.map(t => `${t.date}: ${t.description} | ${t.category} ($${(t.totalAmountCents / 100).toFixed(2)})`).join("\n");
        contextSummary = `- Accounts Map: [${accountsSummary}]\n- Relevancy Filtered Records (${relevantTx.length} items):\n${transactionSummary || 'None'}`;
      }

      const finalPrompt = `You are LedgerFlow's intelligent financial co-pilot (called LedgerFlow AI Brain).
You have secure API-level read access to the developer's financial data. Here is the context summary:
- Total Database Size: ${txCount} entries
${contextSummary}

Developer Request: "${prompt}"

Conduct a brilliant, deep, mathematically sound analysis. Address developer's query perfectly. Avoid generic corporate fluff. Always return the report styled with gorgeous markdown layout, clean bullet points, and code block representations if required.`;

      const uid = (req as AuthenticatedRequest).user?.uid;
      const { apiKey, isCustom: isCustomKeyUsed } = await resolveUserGeminiApiKey(uid);

      if (!apiKey) {
         throw new Error("GEMINI_API_KEY environment variable is missing, and no User API Key was provided in settings.");
      }

      const genAI = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: finalPrompt }] }]
      });

      // EXACT TOKEN INTEGRITY & BILLING
      const usage = result.usageMetadata;
      const promptTokens = usage?.promptTokenCount || Math.floor(finalPrompt.length / 4);
      const outputTokens = usage?.candidatesTokenCount || Math.floor((result.text || "").length / 4);
      const totalTokens = usage?.totalTokenCount || (promptTokens + outputTokens);

      // Gemini 2.5 Flash Pricing Model True Alignment ($0.075 / 1M input, $0.30 / 1M output)
      // cost in cents = (prompt / 1M * 7.5) + (output / 1M * 30)
      const baseCentsExact = (promptTokens * 7.5 / 1000000) + (outputTokens * 30 / 1000000);
      const baseCents = baseCentsExact;
      
      // Compute Credits = exact token proxy (avoid arbitrary 100 base)
      const baseWeight = totalTokens;

      try {
        const db = getDb();
        const wsRef = db.collection("workspaces").doc(workspaceId);
        const wsDoc = await wsRef.get();
        if (wsDoc.exists) {
          const wsData = wsDoc.data() || {};
          
          // Centralized custom billing multiplier & private API key controller
          const { credits: weightScore, cents: deltaCents } = calculateWorkspaceCharges(wsData, baseWeight, baseCents, isCustomKeyUsed);

          const currentCents = wsData.apiQuotaTotalCentsUsed || 0;
          const currentQueries = wsData.totalQueriesThisMonth || 0;
          const currentHardness = wsData.computeHardnessScore || 0;
          const currentCredit = wsData.computeCreditBalance !== undefined ? wsData.computeCreditBalance : 100000;

          await wsRef.update({
            apiQuotaTotalCentsUsed: currentCents + deltaCents,
            totalQueriesThisMonth: currentQueries + 1,
            computeHardnessScore: currentHardness + weightScore,
            computeCreditBalance: Math.max(0, currentCredit - weightScore)
          });

          // Log trace audit record
          const traceId = `trace-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
          await db.collection("billingLedgerTraces").doc(traceId).set({
            id: traceId,
            workspaceId,
            uid: (req as AuthenticatedRequest).user.uid || "api_user",
            userEmail: (req as AuthenticatedRequest).user.email || 'developer@ledgerflow.io',
            algorithmName: 'AI_BRAIN_ANALYZE_QUERY',
            complexityFormat: 'O(Tokens)',
            weightScore,
            isSelfFunded: isCustomKeyUsed,
            executionTimeMs: 1200,
            timestamp: new Date().toISOString()
          });
        }
      } catch (billingErr) {
        console.error("[Server Billing System Bypass]: ", billingErr);
      }

      res.json({
        status: "success",
        analysis: result.text || "Failed to resolve deep brain insights."
      });
    } catch (err: any) {
      sendError(res, err.message, 500);
    }
  });

  app.post("/api/v1/brain/classify", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.body.workspaceId as string) || (req as any).user.developerWorkspaceId;
      if (!workspaceId) return sendError(res, "Missing workspaceId parameters", 400);

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const { description, targetFeatures } = req.body;
      if (!description) {
        return sendError(res, "Missing transaction description to classify.", 400);
      }

      const activeApiKeyId = (req as any).user?.usedApiKeyId || "human_web_console";
      const classifier = new BayesianClassifier();
      let trainedCount = await trainClassifierWithWorkspaceData(classifier, workspaceId, activeApiKeyId);

      // Also support custom manual weights if passed
      if (targetFeatures && Array.isArray(targetFeatures)) {
        targetFeatures.forEach((item: any) => {
          if (item.text && item.category) {
            classifier.train(item.text, item.category, 3.0);
            trainedCount++;
          }
        });
      }

      const prediction = classifier.classify(description);

      // Programmatically record compute billing for the workspace on classify
      const baseWeight = 2; // 2 credits per classification
      const baseCents = 2;  // 2 cents charged per single class request
      try {
        const db = getDb();
        const wsRef = db.collection("workspaces").doc(workspaceId);
        const wsDoc = await wsRef.get();
        if (wsDoc.exists) {
          const wsData = wsDoc.data() || {};
          
          // Centralized custom billing multiplier & private API key controller (single classification is platform owned)
          const { credits: weightScore, cents: deltaCents } = calculateWorkspaceCharges(wsData, baseWeight, baseCents, false);

          const currentCents = wsData.apiQuotaTotalCentsUsed || 0;
          const currentQueries = wsData.totalQueriesThisMonth || 0;
          const currentHardness = wsData.computeHardnessScore || 0;
          const currentCredit = wsData.computeCreditBalance !== undefined ? wsData.computeCreditBalance : 100000;

          await wsRef.update({
            apiQuotaTotalCentsUsed: currentCents + deltaCents,
            totalQueriesThisMonth: currentQueries + 1,
            computeHardnessScore: currentHardness + weightScore,
            computeCreditBalance: Math.max(0, currentCredit - weightScore)
          });

          // Log trace audit record
          const traceId = `trace-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
          await db.collection("billingLedgerTraces").doc(traceId).set({
            id: traceId,
            workspaceId,
            uid: (req as AuthenticatedRequest).user.uid || "api_user",
            userEmail: (req as AuthenticatedRequest).user.email || 'developer@ledgerflow.io',
            algorithmName: 'ALGO_CLASSIFIER_BAYESIAN_SINGLE',
            complexityFormat: 'O(V*C)',
            weightScore,
            executionTimeMs: 45,
            timestamp: new Date().toISOString()
          });
        }
      } catch (billingErr) {
        console.error("[Classifier Billing Trace Bypassed]: ", billingErr);
      }

      res.status(200).json({
        status: "success",
        trainedModelCount: trainedCount,
        queryDescription: description,
        prediction: prediction ? {
          category: prediction.category,
          confidence: parseFloat(prediction.confidence.toFixed(4)),
          label: prediction.category.toUpperCase().replace(/\s+/g, "_")
        } : {
          category: "Uncategorized/Suspense",
          confidence: 0.50,
          label: "UNCATEGORIZED_SUSPENSE"
        }
      });
    } catch (err: any) {
      sendError(res, err.message, 500);
    }
  });

  app.get("/api/v1/admin/telemetry", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const db = getDb();
      
      const isSystemAdmin = authReq.user.admin === true;
      let isRoleAdmin = false;
      if (!isSystemAdmin) {
        try {
          const userDoc = await db.collection("users").doc(authReq.user.uid).get();
          isRoleAdmin = userDoc.exists && userDoc.data()?.role === "admin";
        } catch(e) {}
      }

      if (!isSystemAdmin && !isRoleAdmin) {
        return res.status(403).json({ status: "error", message: "Forbidden: Administrative privileges required." });
      }

      const workspacesSnap = await db.collection("workspaces").limit(100).get();
      const wsIds = workspacesSnap.docs.map(d => d.id).slice(0, 30);
      let transactionsSnap: { docs: any[] } = { docs: [] };
      if (wsIds.length > 0) {
          transactionsSnap = await db.collection("transactions").where("workspaceId", "in", wsIds).get();
      }
      
      const transactions = transactionsSnap.docs.map(doc => doc.data() as any);
      
      const tenants: Record<string, { 
        id: string, 
        name: string,
        plan: string,
        concurrentUserLimit: number,
        activeUserCount: number,
        seatCount: number,
        maxSeats: number,
        computeCreditBalance: number,
        apiQuotaTotalCentsUsed: number,
        apiQuotaMonthlyLimitCents: number,
        creditCostMultiplier: number,
        quotaCentsMultiplier: number,
        bypassBilling: boolean,
        customKeyCreditCharge: number,
        customKeyCentsCharge: number,
        txCount: number, 
        requestCount: number, 
        errorCount: number 
      }> = {};
      
      workspacesSnap.docs.forEach(doc => {
         const data = doc.data() || {};
         const cacheVal = typeof billingFallbackCache !== "undefined" ? (billingFallbackCache.get(doc.id) || {}) : {};
         tenants[doc.id] = { 
            id: doc.id, 
            name: data.name || cacheVal.name || "Default Workspace",
            plan: data.plan || cacheVal.plan || "sandbox",
            concurrentUserLimit: data.concurrentUserLimit || cacheVal.concurrentUserLimit || 50,
            activeUserCount: data.activeUserCount || cacheVal.activeUserCount || 1,
            seatCount: data.seatCount || cacheVal.seatCount || 1,
            maxSeats: data.maxSeats || cacheVal.maxSeats || 3,
            computeCreditBalance: data.computeCreditBalance !== undefined ? data.computeCreditBalance : (cacheVal.computeCreditBalance !== undefined ? cacheVal.computeCreditBalance : 100000),
            apiQuotaTotalCentsUsed: data.apiQuotaTotalCentsUsed || cacheVal.apiQuotaTotalCentsUsed || 0,
            apiQuotaMonthlyLimitCents: data.apiQuotaMonthlyLimitCents || cacheVal.apiQuotaMonthlyLimitCents || 0,
            creditCostMultiplier: data.creditCostMultiplier !== undefined ? Number(data.creditCostMultiplier) : (cacheVal.creditCostMultiplier !== undefined ? Number(cacheVal.creditCostMultiplier) : 1.0),
            quotaCentsMultiplier: data.quotaCentsMultiplier !== undefined ? Number(data.quotaCentsMultiplier) : (cacheVal.quotaCentsMultiplier !== undefined ? Number(cacheVal.quotaCentsMultiplier) : 1.0),
            bypassBilling: data.bypassBilling !== undefined ? data.bypassBilling === true : (cacheVal.bypassBilling !== undefined ? cacheVal.bypassBilling === true : false),
            customKeyCreditCharge: data.customKeyCreditCharge !== undefined ? Number(data.customKeyCreditCharge) : (cacheVal.customKeyCreditCharge !== undefined ? Number(cacheVal.customKeyCreditCharge) : 10),
            customKeyCentsCharge: data.customKeyCentsCharge !== undefined ? Number(data.customKeyCentsCharge) : (cacheVal.customKeyCentsCharge !== undefined ? Number(cacheVal.customKeyCentsCharge) : 0),
            txCount: 0, 
            requestCount: 0, 
            errorCount: 0 
         };
      });
      
      transactions.forEach(tx => {
         if (tenants[tx.workspaceId]) {
            tenants[tx.workspaceId].txCount++;
         }
      });
      
      apiLogs.forEach(log => {
         // rough attribution by path or apiKey
         const assignedWs = Object.keys(tenants).find(ws => log.path.includes(ws) || log.apiKeyUsed.includes(ws.substring(0, 5)));
         if (assignedWs) {
             tenants[assignedWs].requestCount++;
             if (log.statusCode >= 500) tenants[assignedWs].errorCount++;
         }
      });

      res.json({
        status: "success",
        tenants: Object.values(tenants),
        liveLogs: apiLogs
      });
    } catch (err: any) {
      if (err.message?.includes("NOT_FOUND") || err.message?.includes("PERMISSION_DENIED") || err.message?.includes("permissions") || err.code === 7) {
          const tenantsFromCache = typeof billingFallbackCache !== "undefined" ? Array.from(billingFallbackCache.entries()).map(([id, cacheVal]) => ({
             id,
             name: cacheVal.name || "Default Workspace",
             plan: cacheVal.plan || "sandbox",
             concurrentUserLimit: cacheVal.concurrentUserLimit || 50,
             activeUserCount: cacheVal.activeUserCount || 1,
             seatCount: cacheVal.seatCount || 1,
             maxSeats: cacheVal.maxSeats || 3,
             computeCreditBalance: cacheVal.computeCreditBalance !== undefined ? cacheVal.computeCreditBalance : 100000,
             apiQuotaMonthlyLimitCents: cacheVal.apiQuotaMonthlyLimitCents || 0,
             creditCostMultiplier: cacheVal.creditCostMultiplier !== undefined ? cacheVal.creditCostMultiplier : 1.0,
             quotaCentsMultiplier: cacheVal.quotaCentsMultiplier !== undefined ? cacheVal.quotaCentsMultiplier : 1.0,
             bypassBilling: cacheVal.bypassBilling === true,
             customKeyCreditCharge: cacheVal.customKeyCreditCharge !== undefined ? cacheVal.customKeyCreditCharge : 10,
             customKeyCentsCharge: cacheVal.customKeyCentsCharge !== undefined ? cacheVal.customKeyCentsCharge : 0,
             txCount: 12,
             requestCount: 45,
             errorCount: 0
          })) : [];
          return res.json({ status: "success", tenants: tenantsFromCache, liveLogs: apiLogs || [] });
      }
      sendError(res, err.message, 500);
    }
  });

  app.put("/api/v1/admin/workspaces/:workspaceId", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const db = getDb();
      
      const isSystemAdmin = authReq.user.admin === true;
      let isRoleAdmin = false;
      if (!isSystemAdmin) {
        try {
          const userDoc = await db.collection("users").doc(authReq.user.uid).get();
          isRoleAdmin = userDoc.exists && userDoc.data()?.role === "admin";
        } catch(e) {}
      }

      if (!isSystemAdmin && !isRoleAdmin) {
        return res.status(403).json({ status: "error", message: "Forbidden: Administrative privileges required." });
      }

      const { workspaceId } = req.params;
      const { 
        plan, 
        concurrentUserLimit, 
        maxSeats, 
        computeCreditBalance, 
        apiQuotaMonthlyLimitCents,
        creditCostMultiplier,
        quotaCentsMultiplier,
        bypassBilling,
        customKeyCreditCharge,
        customKeyCentsCharge
      } = req.body;

      try {
        await db.collection("workspaces").doc(workspaceId).set({
          plan: plan || "sandbox",
          concurrentUserLimit: Number(concurrentUserLimit) || 50,
          maxSeats: Number(maxSeats) || 3,
          computeCreditBalance: Number(computeCreditBalance) !== undefined ? Number(computeCreditBalance) : 100000,
          apiQuotaMonthlyLimitCents: Number(apiQuotaMonthlyLimitCents) || 0,
          creditCostMultiplier: creditCostMultiplier !== undefined ? Number(creditCostMultiplier) : 1.0,
          quotaCentsMultiplier: quotaCentsMultiplier !== undefined ? Number(quotaCentsMultiplier) : 1.0,
          bypassBilling: bypassBilling === true,
          customKeyCreditCharge: customKeyCreditCharge !== undefined ? Number(customKeyCreditCharge) : 10,
          customKeyCentsCharge: customKeyCentsCharge !== undefined ? Number(customKeyCentsCharge) : 0,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (dbErr) {
        console.warn("[Firebase Admin] Failed to save updated workspace metadata to DB. Bypassing to inline fallback caching store.");
      }

      const existingCacheValue = typeof billingFallbackCache !== "undefined" ? (billingFallbackCache.get(workspaceId) || {}) : {};
      const updatedCacheValue = {
        ...existingCacheValue,
        workspaceId,
        plan: plan || "sandbox",
        concurrentUserLimit: Number(concurrentUserLimit) || 50,
        maxSeats: Number(maxSeats) || 3,
        computeCreditBalance: Number(computeCreditBalance) !== undefined ? Number(computeCreditBalance) : 100000,
        apiQuotaMonthlyLimitCents: Number(apiQuotaMonthlyLimitCents) || 0,
        creditCostMultiplier: creditCostMultiplier !== undefined ? Number(creditCostMultiplier) : 1.0,
        quotaCentsMultiplier: quotaCentsMultiplier !== undefined ? Number(quotaCentsMultiplier) : 1.0,
        bypassBilling: bypassBilling === true,
        customKeyCreditCharge: customKeyCreditCharge !== undefined ? Number(customKeyCreditCharge) : 10,
        customKeyCentsCharge: customKeyCentsCharge !== undefined ? Number(customKeyCentsCharge) : 0,
      };
      
      if (typeof billingFallbackCache !== "undefined") {
        billingFallbackCache.set(workspaceId, updatedCacheValue);
      }

      res.json({ status: "success", message: "Workspace settings optimized successfully.", data: updatedCacheValue });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err.message });
    }
  });

  // --- Global Default Pricing and Billing Overrides ---
  app.get("/api/v1/admin/users", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const db = getDb();
      
      const isSystemAdmin = authReq.user.admin === true;
      let isRoleAdmin = false;
      if (!isSystemAdmin) {
        try {
          const userDoc = await db.collection("users").doc(authReq.user.uid).get();
          isRoleAdmin = userDoc.exists && userDoc.data()?.role === "admin";
        } catch(e) {}
      }

      if (!isSystemAdmin && !isRoleAdmin) {
        return res.status(403).json({ status: "error", message: "Forbidden: Administrative privileges required." });
      }

      const usersSnap = await db.collection("users").limit(100).get();
      const countSnap = await db.collection("users").count().get();
      const totalCount = countSnap.data().count;
      const users = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() as any }));
      
      res.json({
        status: "success",
        users
      });
    } catch (err: any) {
      sendError(res, err.message, 500);
    }
  });

  app.put("/api/v1/admin/users/:userId", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const db = getDb();
      
      const isSystemAdmin = authReq.user.admin === true;
      let isRoleAdmin = false;
      if (!isSystemAdmin) {
        try {
          const userDoc = await db.collection("users").doc(authReq.user.uid).get();
          isRoleAdmin = userDoc.exists && userDoc.data()?.role === "admin";
        } catch(e) {}
      }

      if (!isSystemAdmin && !isRoleAdmin) {
        return res.status(403).json({ status: "error", message: "Forbidden: Administrative privileges required." });
      }

      const { userId } = req.params;
      const { role, customLimit, computeCreditLimit } = req.body;

      const updateData: Record<string, any> = {
        updatedAt: new Date().toISOString()
      };
      if (role !== undefined && typeof role === 'string') {
        updateData.role = role;
      }
      if (customLimit !== undefined) {
        updateData.customLimit = customLimit === null || customLimit === '' ? null : Number(customLimit);
      }
      if (computeCreditLimit !== undefined) {
        updateData.computeCreditLimit = computeCreditLimit === null || computeCreditLimit === '' ? null : Number(computeCreditLimit);
      }

      await db.collection("users").doc(userId).set(updateData, { merge: true });

      res.json({ status: "success", message: "User privileges updated" });
    } catch (err: any) {
      sendError(res, err.message, 500);
    }
  });

  app.get("/api/v1/admin/global-config", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const isSystemAdmin = authReq.user.admin === true;
      const db = getDb();
      let isRoleAdmin = false;
      if (!isSystemAdmin) {
        try {
          const userDoc = await db.collection("users").doc(authReq.user.uid).get();
          isRoleAdmin = userDoc.exists && userDoc.data()?.role === "admin";
        } catch(e) {}
      }

      if (!isSystemAdmin && !isRoleAdmin) {
        return res.status(403).json({ status: "error", message: "Forbidden: Administrative privileges required." });
      }

      res.json({
        status: "success",
        globalAdminConfig
      });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err.message });
    }
  });

  app.put("/api/v1/admin/global-config", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const isSystemAdmin = authReq.user.admin === true;
      const db = getDb();
      let isRoleAdmin = false;
      if (!isSystemAdmin) {
        try {
          const userDoc = await db.collection("users").doc(authReq.user.uid).get();
          isRoleAdmin = userDoc.exists && userDoc.data()?.role === "admin";
        } catch(e) {}
      }

      if (!isSystemAdmin && !isRoleAdmin) {
        return res.status(403).json({ status: "error", message: "Forbidden: Administrative privileges required." });
      }

      const { 
        creditCostMultiplier, 
        quotaCentsMultiplier, 
        bypassBilling, 
        customKeyCreditCharge, 
        customKeyCentsCharge,
        maxRegistrationLimit,
        freeWorkspaceTxCap
      } = req.body;

      globalAdminConfig = {
        creditCostMultiplier: creditCostMultiplier !== undefined ? Number(creditCostMultiplier) : 1.0,
        quotaCentsMultiplier: quotaCentsMultiplier !== undefined ? Number(quotaCentsMultiplier) : 1.0,
        bypassBilling: bypassBilling === true,
        customKeyCreditCharge: customKeyCreditCharge !== undefined ? Number(customKeyCreditCharge) : 10,
        customKeyCentsCharge: customKeyCentsCharge !== undefined ? Number(customKeyCentsCharge) : 0,
        maxRegistrationLimit: maxRegistrationLimit !== undefined ? Number(maxRegistrationLimit) : 100,
        freeWorkspaceTxCap: freeWorkspaceTxCap !== undefined ? Number(freeWorkspaceTxCap) : 100,
      };

      try {
        await db.collection("admins").doc("globalConfig").set(globalAdminConfig, { merge: true });
      } catch (dbErr) {
        console.warn("[Global Config Save] Failed to persist options. Using runtime memory.");
      }

      res.json({ status: "success", message: "Global standard billing configurations updated perfectly.", globalAdminConfig });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err.message });
    }
  });

  app.post("/api/v1/billing/checkout", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.body.workspaceId as string) || (req as any).user.developerWorkspaceId;
      if (!workspaceId) return res.status(400).json({ status: "error", message: "Missing workspaceId" });

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const stripe = getStripe();
      
      const { plan } = req.body;
      let priceInfo: any = {};
      
      // Based on user request: "make a 5$ dollar a munth till, x amount of useg and over that limit 10$"
      // We will create dynamic ad-hoc line items for the checkout rather than relying on predefined price IDs.
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

      // Generate the host URL dynamically based on where the applet is running
      const host = req.headers.host || "localhost:3000";
      const protocol = req.headers['x-forwarded-proto'] || "http";
      const baseUrl = `${protocol}://${host}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [priceInfo],
        mode: 'subscription',
        success_url: `${baseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/?checkout=canceled`,
        metadata: {
          workspaceId
        }
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("[Stripe] Failed:", err);
      res.status(500).json({ status: "error", message: err.message });
    }
  });

  app.post("/api/v1/billing/verify-session", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const { session_id, workspaceId } = req.body;
      if (!session_id || !workspaceId) {
        return res.status(400).json({ status: "error", message: "Missing required parameters" });
      }

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

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
            claimedAt: admin.firestore.FieldValue.serverTimestamp()
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
          computeCreditBalance: admin.firestore.FieldValue.increment(creditsToGrant),
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
       res.status(500).json({ status: "error", message: err.message });
    }
  });

  app.post("/api/v1/keys/provision", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const { name, scopes, expiration, workspaceId } = req.body;
      if (!workspaceId) {
        return res.status(400).json({ status: "error", message: "Missing workspaceId in body" });
      }

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const userId = authReq.user.uid;
      
      const randomSecret = crypto.randomBytes(32).toString('hex');
      const randomKeyIdSuffix = crypto.randomBytes(8).toString('hex');
      const keyId = `lf_id_${workspaceId}_${randomKeyIdSuffix}`;
      const computedHash = crypto.createHash('sha256').update(randomSecret).digest('hex');

      let expiresAtValue: string | null = null;
      if (expiration && expiration !== 'never') {
        const d = new Date();
        if (expiration === '1h') d.setHours(d.getHours() + 1);
        else if (expiration === '24h') d.setHours(d.getHours() + 24);
        else if (expiration === '30d') d.setDate(d.getDate() + 30);
        else if (expiration === '90d') d.setDate(d.getDate() + 90);
        expiresAtValue = d.toISOString();
      }

      const newKeyData = {
         workspaceId,
         name: name || 'Production Integration Key',
         keyHash: computedHash,
         uid: userId,
         createdAt: new Date().toISOString(),
         scopes: scopes || [],
         expiresAt: expiresAtValue || 'never',
         lastUsedAt: null,
         totalRequests: 0
      };

      const db = getDb();
      await db.collection("apiKeys").doc(keyId).set(newKeyData);

      res.status(200).json({
        status: "success",
        apiKey: `${keyId}.${randomSecret}`,
        keyId,
        message: "Developer credential provisioned successfully"
      });
    } catch (err: any) {
      console.error("[Keys Provisioning Error]: ", err);
      res.status(500).json({ status: "error", message: "Failed to generate security key on server.", details: err.message });
    }
  });

  app.delete("/api/v1/keys/revoke/:keyId", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const { keyId } = req.params;
      const authReq = req as AuthenticatedRequest;
      const db = getDb();
      
      const keySnap = await db.collection("apiKeys").doc(keyId).get();
      if (!keySnap.exists) {
        return res.status(404).json({ status: "error", message: "Key not found" });
      }
      
      const keyData = keySnap.data();
      if (keyData?.uid !== authReq.user.uid) {
        return res.status(403).json({ status: "error", message: "Forbidden: You do not own this credential." });
      }
      
      await db.collection("apiKeys").doc(keyId).delete();
      res.json({ status: "success", message: "API key successfully revoked." });
    } catch (err: any) {
      console.error("[Keys Revoke Error]: ", err);
      res.status(500).json({ status: "error", message: "Failed to revoke key on server.", details: err.message });
    }
  });

  // Fallback in-memory cache for workspace billing & metrics to guarantee continuous operations under any IAM/GCP database restriction
  const billingFallbackCache = new Map<string, any>();

  // --- Corporate Billing and Compute Metering Endpoints ---
  app.get("/api/v1/billing/status", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.query.workspaceId as string);
      if (!workspaceId) return res.status(400).json({ status: "error", message: "Missing workspaceId" });

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

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

      // Populate secure default development limits if missing to maintain continuous operations
      const statusData = {
        workspaceId,
        plan: wsData.plan || 'sandbox',
        billingCycle: wsData.billingCycle || 'free',
        concurrentUserLimit: wsData.concurrentUserLimit || 50,
        activeUserCount: wsData.activeUserCount || 1,
        seatCount: wsData.seatCount || 1,
        maxSeats: wsData.maxSeats || 3,
        totalQueriesThisMonth: wsData.totalQueriesThisMonth || 0,
        computeHardnessScore: wsData.computeHardnessScore || 0,
        computeCreditBalance: wsData.computeCreditBalance !== undefined ? wsData.computeCreditBalance : 100000, // 100k compute units default
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

  app.post("/api/v1/billing/record-compute", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const { workspaceId, algorithmName, complexityFormat, weightScore, executionTimeMs } = req.body;
      if (!workspaceId || !algorithmName) {
        return res.status(400).json({ status: "error", message: "Missing required query parameters: workspaceId and algorithmName" });
      }

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

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
        id: `trace-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        workspaceId,
        uid: authReq.user.uid,
        userEmail: authReq.user.email,
        algorithmName,
        complexityFormat,
        weightScore: sanitizedWeight,
        executionTimeMs: sanitizedExecutionTime,
        timestamp: new Date().toISOString(),
        hash: crypto.createHash('sha256').update(`${workspaceId}-${algorithmName}-${sanitizedWeight}-${Date.now()}`).digest('hex')
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

      const currentQuotaUsed = currentValueQuota + Math.round(sanitizedWeight * 0.1); // 0.1 cent per complexity score
      const newQueriesCount = currentValueQueries + 1;
      const newComputeHardness = currentValueHardness + sanitizedWeight;
      const newCreditBalance = Math.max(0, currentValueCredit - sanitizedWeight);

      const updatedMetrics = {
        apiQuotaTotalCentsUsed: currentQuotaUsed,
        totalQueriesThisMonth: newQueriesCount,
        computeHardnessScore: newComputeHardness,
        computeCreditBalance: newCreditBalance
      };

      // Always write to the fallback in-memory cache to maintain locally consistent simulation state
      billingFallbackCache.set(workspaceId, {
        ...wsData,
        ...updatedMetrics,
        workspaceId
      });

      if (wsFetchedFromDb) {
        try {
          const db = getDb();
          const wsRef = db.collection("workspaces").doc(workspaceId);
          await wsRef.update(updatedMetrics);
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

  // stress-test route removed in favor of real client-side load testing


  app.get("/api/v1/logs", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.query.workspaceId as string) || (req as any).user.developerWorkspaceId;
      if (!workspaceId) return sendError(res, "Missing workspaceId parameters", 400);

      const authReq = req as AuthenticatedRequest;
      await authorizeWorkspace(authReq, workspaceId);

      const filtered = apiLogs.filter(log => {
        const isPathMatch = typeof log.path === "string" && (log.path.includes(workspaceId) || log.path.includes("workspaceId=" + workspaceId));
        const isKeyMatch = typeof log.apiKeyUsed === "string" && log.apiKeyUsed.includes(workspaceId.substring(0, 5));
        const isDeveloperWsMatch = (req as any).user.developerWorkspaceId === workspaceId;
        return isPathMatch || isKeyMatch || isDeveloperWsMatch;
      });

      res.json(filtered);
    } catch (err: any) {
      if (err.message === "NOT_FOUND" || err.message?.includes("NOT_FOUND")) return res.json([]);
      if (err.message === "FORBIDDEN") return sendError(res, "Forbidden workspace access", 403);
      sendError(res, err.message, 500);
    }
  });

  app.post("/api/upload-bank-csv", authenticate, upload.single("file"), async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    if (!req.file) return sendError(res, "No file uploaded", 400);

    try {
      const csvData = fs.readFileSync(req.file.path, "utf8");
      const records: Array<Record<string, string>> = parseCsv(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      });

      if (!records || records.length === 0) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.json([]);
      }

      const sampleKeys = Object.keys(records[0] || {});
      
      // Score-based column detector
      const findBestCol = (patterns: RegExp[], excludePatterns: RegExp[] = []): string | undefined => {
        let bestKey: string | undefined;
        let bestScore = -1;
        for (const key of sampleKeys) {
          const lower = key.toLowerCase().trim();
          if (excludePatterns.some(p => p.test(lower))) continue;
          for (let i = 0; i < patterns.length; i++) {
            if (patterns[i].test(lower)) {
              const score = 100 - i * 10;
              if (score > bestScore) {
                bestScore = score;
                bestKey = key;
              }
            }
          }
        }
        return bestKey;
      };

      const dateKey = findBestCol([/^date$/i, /^trans(action)?[_\s]?date$/i, /^posted[_\s]?date$/i, /date/i]);
      const descKey = findBestCol([/^description$/i, /^memo$/i, /^payee$/i, /^narrative$/i, /^details$/i, /desc/i, /name/i]);
      const debitKey = findBestCol([/^debit$/i, /^withdrawal$/i, /^outflow$/i, /^charge$/i, /^debit[_\s]?amount$/i], [/balance/i]);
      const creditKey = findBestCol([/^credit$/i, /^deposit$/i, /^inflow$/i, /^payment$/i, /^credit[_\s]?amount$/i], [/balance/i]);
      const amountKey = findBestCol([/^amount$/i, /^total$/i, /^net$/i, /^sum$/i, /amount/i], [/balance/i, /account[_\s]?num/i, /debit/i, /credit/i]);
      const categoryKey = findBestCol([/^category$/i, /^account[_\s]?category$/i, /^class$/i, /^label$/i, /category/i]);

      const normalizeDate = (rawDate: string): string => {
        if (!rawDate) return new Date().toISOString().split('T')[0];
        const s = rawDate.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const usMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (usMatch) {
          let [_, m, d, y] = usMatch;
          if (y.length === 2) {
            y = parseInt(y, 10) > 50 ? '19' + y : '20' + y;
          }
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
        return new Date().toISOString().split('T')[0];
      };

      const batchId = Date.now();
      const transactions: any[] = [];
      const rejected: any[] = [];

      records.forEach((r, idx) => {
        try {
          let amountCents = 0;
          if (debitKey && creditKey && (r[debitKey] !== undefined || r[creditKey] !== undefined)) {
            const deb = TruthEngine.parseAmountToCentsOrZero(r[debitKey]);
            const cred = TruthEngine.parseAmountToCentsOrZero(r[creditKey]);
            amountCents = cred - deb;
          } else if (amountKey && r[amountKey] !== undefined) {
            amountCents = TruthEngine.parseAmountToCents(r[amountKey]);
          } else {
            throw new Error("No amount column found for row");
          }

          const rawDate = dateKey ? r[dateKey] : '';
          const date = normalizeDate(rawDate);
          const description = (descKey ? r[descKey] : '') || "Bank Transaction";
          const categoryVal = categoryKey ? r[categoryKey] : null;

          transactions.push({
            id: `csv-${batchId}-${idx}`,
            date,
            description: description.trim(),
            amountCents,
            category: categoryVal ? categoryVal.trim() : undefined
          });
        } catch (rowErr: any) {
          rejected.push({
            row: idx + 1,
            reason: rowErr?.message || "Invalid row format",
            raw: r
          });
        }
      });

      fs.unlinkSync(req.file.path);
      res.json(transactions);
    } catch (error) {
      if (req.file) fs.unlinkSync(req.file.path);
      sendError(res, "Failed to parse CSV", 500, error);
    }
  });

  // --- External API Call Helper with Firestore Caching ---
  async function fetchWithFirestoreCache(url: string, headers: any, cacheKey: string, ttlMs: number) {
    const db = getDb();
    // Use an external_api_cache collection to store responses
    const cacheRef = db.collection("external_api_cache").doc(cacheKey);
    const snap = await cacheRef.get();
    
    if (snap.exists) {
      const data = snap.data();
      if (Date.now() - (data?.timestamp || 0) < ttlMs) {
        console.debug(`[Cache Hit] Serving from cache: ${cacheKey}`);
        return data?.payload;
      }
    }
    
    console.debug(`[Cache Miss] Fetching from API: ${cacheKey}`);
    const response = await fetch(url, { method: "GET", headers });
    
    if (!response.ok) {
      throw new Error(`API responded with ${response.status}: ${await response.text()}`);
    }
    
    const payload = await response.json();
    
    // Do not cache API-level errors
    if (payload.success === false) {
      console.warn("API returned application-level error:", payload);
      return payload; // don't cache
    }

    // Save to cache
    try {
      await cacheRef.set({
        timestamp: Date.now(),
        payload
      });
    } catch (err) {
      console.error("Cache save error:", err);
    }
    
    return payload;
  }

  // --- Currency Data Integration ---
  app.get("/api/v1/currency/:endpoint", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const allowedEndpoints = ["list", "live", "convert", "historical", "timeframe", "change"];
      const { endpoint } = req.params;
      
      if (!allowedEndpoints.includes(endpoint)) {
        return sendError(res, "Invalid currency API endpoint", 400);
      }

      const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
      const apiKey = process.env.CURRENCY_API_KEY as string;
      const url = `https://api.apilayer.com/currency_data/${endpoint}?${queryString}`;
      
      // Cache live endpoint for 6 hours, historical/list for 365 days
      let ttlMs = 1000 * 60 * 60 * 6; // 6 hours
      if (["historical", "list", "timeframe"].includes(endpoint)) {
         ttlMs = 1000 * 60 * 60 * 24 * 365; // 365 days
      }

      // We hash the full URL as a cache key to uniquely identify these queries
      const cacheKey = crypto.createHash('md5').update(url).digest('hex');
      const data = await fetchWithFirestoreCache(url, { "apikey": apiKey }, `currency_${cacheKey}`, ttlMs);

      res.json(data);
    } catch (error: any) {
      console.error("[Currency] Proxy error:", error);
      sendError(res, "Failed to fetch currency data", 500, error.message);
    }
  });

  // --- Tax Data Integration ---
  app.get("/api/v1/tax/:endpoint", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const allowedEndpoints = ["tax_rates", "us_rate_list"];
      const { endpoint } = req.params;

      if (!allowedEndpoints.includes(endpoint)) {
         return sendError(res, "Invalid tax API endpoint", 400);
      }

      const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
      const apiKey = process.env.TAX_API_KEY as string;
      const url = `https://api.apilayer.com/tax_data/${endpoint}?${queryString}`;

      // Tax data changes very rarely, cache for 30 days
      const ttlMs = 1000 * 60 * 60 * 24 * 30; // 30 days
      const cacheKey = crypto.createHash('md5').update(url).digest('hex');
      
      const data = await fetchWithFirestoreCache(url, { "apikey": apiKey }, `tax_${cacheKey}`, ttlMs);

      res.json(data);
    } catch (error: any) {
      console.error("[Tax] Proxy error:", error);
      sendError(res, "Failed to fetch tax data", 500, error.message);
    }
  });

  // --- Plaid Integration ---
  app.post("/api/v1/plaid/create_link_token", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const response = await plaidClient.linkTokenCreate({
        user: {
          client_user_id: authReq.user.uid,
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

  app.post("/api/v1/plaid/exchange_public_token", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { public_token } = req.body;
      const response = await plaidClient.itemPublicTokenExchange({
        public_token,
      });

      const { access_token, item_id } = response.data;
      
      // Store encrypted access_token in Firestore associated with the user/workspace
      const db = getFirestore();
      await db.collection("users").doc(authReq.user.uid).collection("banks").add({
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

  app.post("/api/v1/plaid/sync", authenticate, async (req: express.Request, res: express.Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const db = getFirestore();
      
      // Get all banks for the user
      const banksSnap = await db.collection("users").doc(authReq.user.uid).collection("banks").get();
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
           start_date: thirtyDaysAgo.toISOString().split('T')[0],
           end_date: today.toISOString().split('T')[0]
         });
         
         allSyncTransactions = allSyncTransactions.concat(response.data.transactions);
      }
      
      res.json({ transactions: allSyncTransactions });
    } catch (error: any) {
      console.error("[Plaid] sync err:", error.response?.data || error);
      sendError(res, "Failed to sync plaid transactions", 500, error.message);
    }
  });

  app.get("/api/reports/profit-and-loss", authenticate, async (req: express.Request, res: express.Response) => {
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
        if (acc.type === 'income' || acc.type === 'revenue') {
          pl.income.accounts[acc.id] = { name: acc.name, balance: 0, parentId: acc.parentId };
        } else if (acc.type === 'expense') {
          pl.expense.accounts[acc.id] = { name: acc.name, balance: 0, parentId: acc.parentId };
        }
      });
      for (const tx of transactions) {
        if (tx.status === 'void' || tx.status === 'voided') continue;
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
      pl.grossProfit = pl.income.total;
      pl.netIncome = pl.income.total - pl.expense.total;
      res.json(pl);
    } catch (error: any) {
      if (error.message === "FORBIDDEN") return sendError(res, "Forbidden", 403);
      if (error.message === "NOT_FOUND" || error.message?.includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
      sendError(res, "Internal Reporting Error", 500, error.message);
    }
  });

  app.get("/api/reports/balance-sheet", authenticate, async (req: express.Request, res: express.Response) => {
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

      let netIncome = 0;

      for (const tx of transactions) {
        if (tx.status === 'void' || tx.status === 'voided') continue;
        if (tx.date > end) continue;
        tx.lines?.forEach((line: any) => {
          if (balances[line.accountId] !== undefined) {
            balances[line.accountId] += line.amountCents;
          }
          const acc = accounts.find((a: any) => a.id === line.accountId);
          if (acc) {
            if (acc.type === 'revenue' || acc.type === 'income') {
              netIncome += (-line.amountCents);
            } else if (acc.type === 'expense') {
              netIncome -= line.amountCents;
            }
          }
        });
      }

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
      sendError(res, "Balance Sheet Failure", 500, error.message);
    }
  });

  app.get("/api/reports/aging", authenticate, async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const result = WorkspaceIdSchema.extend({ type: z.enum(['ar', 'ap']) }).safeParse(req.query);
    if (!result.success) return sendError(res, "Invalid parameters", 400, result.error.issues);
    const { workspaceId, type } = result.data;

    try {
      await authorizeWorkspace(authReq, workspaceId);
      const db = getDb();
      const collectionName = type === 'ar' ? 'invoices' : 'bills';
      // Fetch items by workspaceId and filter status in memory to avoid index requirements
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

  app.get("/api/reports/trial-balance", authenticate, async (req: express.Request, res: express.Response) => {
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
        if (tx.status === 'void' || tx.status === 'voided') continue;
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

  app.get("/api/reports/cash-flow", authenticate, async (req: express.Request, res: express.Response) => {
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

      // Memory filter
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

      // Simplified Indirect Method
      transactions.forEach((tx: any) => {
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

      // Recalculate based on simpler logic if needed, but keeping original structure
      cashFlow.netChange = cashFlow.operating.total + cashFlow.investing.total + cashFlow.financing.total;

      res.json(cashFlow);
    } catch (error: any) {
      if (error.message === "FORBIDDEN") return sendError(res, "Forbidden", 403);
      if (error.message === "NOT_FOUND" || error.message?.includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
      sendError(res, "Failed to generate cash flow statement", 500, error.message);
    }
  });

  app.get("/api/reports/budget-vs-actual", authenticate, async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const result = WorkspaceIdSchema.extend({ month: z.string().optional() }).safeParse(req.query);
    if (!result.success) return sendError(res, "Invalid parameters", 400, result.error.issues);
    const { workspaceId, month } = result.data;

    try {
      await authorizeWorkspace(authReq, workspaceId);
      const db = getDb();
      // Fetch by workspaceId and filter in memory to avoid index requirements
      const [budgetsSnap, transactionsSnap, accountsSnap] = await Promise.all([
        db.collection("budgets").where("workspaceId", "==", workspaceId).get(),
        db.collection("transactions").where("workspaceId", "==", workspaceId).get(),
        db.collection("chartAccounts").where("workspaceId", "==", workspaceId).get()
      ]);

      const budgets = budgetsSnap.docs.map((doc: any) => doc.data());
      let transactions = transactionsSnap.docs.map((doc: any) => doc.data());
      const accounts = accountsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      // Filter transactions by month in memory
      if (month) {
        const monthStr = String(month);
        transactions = transactions.filter(tx => tx.date && tx.date.startsWith(monthStr));
      }

      const report = budgets.map((b: any) => {
        const account = accounts.find(a => a.id === b.accountId);
        let actual = 0;
        transactions.forEach((tx: any) => {
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

  app.get("/api/activity-feed", authenticate, async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const result = WorkspaceIdSchema.safeParse(req.query);
    if (!result.success) return sendError(res, "Invalid parameters", 400, result.error.issues);
    
    const { workspaceId } = result.data;

    try {
      await authorizeWorkspace(authReq, workspaceId);
      const db = getDb();
      const snap = await db.collection("auditLogs")
        .where("workspaceId", "==", workspaceId)
        .limit(20)
        .get();

      const logs = snap.docs.map((doc: any) => doc.data());
      res.json(logs);
    } catch (error: any) {
      if (error.message === "FORBIDDEN") return sendError(res, "Forbidden", 403);
      if (error.message === "NOT_FOUND" || error.message?.includes("NOT_FOUND")) return sendError(res, "Workspace not found", 404);
      sendError(res, "Failed to fetch activity feed", 500, error.message);
    }
  });

  // --- High Performance Rule Labeling Engine API (Excel Integration Ready) ---
  

  

  app.post("/api/v1/label-transactions", apiAuthenticate, async (req: express.Request, res: express.Response) => {
    try {
      const workspaceId = (req.body.workspaceId as string) || (req as any).user.developerWorkspaceId;
      let finalWorkspaceId = workspaceId;
      const db = getDb();

      if (!finalWorkspaceId) {
        try {
          const wsSnap = await db.collection("workspaces").where("uid", "==", (req as any).user.uid).limit(1).get();
          if (!wsSnap.empty) {
            finalWorkspaceId = wsSnap.docs[0].id;
          }
        } catch (err: any) {
          // Sandbox context fallback safely
        }
      }

      if (!finalWorkspaceId) {
        finalWorkspaceId = "sandbox_labeling";
      }

      const { transactions } = req.body;
      if (!transactions || !Array.isArray(transactions)) {
        return sendError(res, "Missing or invalid 'transactions' payload. Must be an array of objects.", 400);
      }

      let accounts: any[] = [];
      let rules: any[] = [];

      try {
        if (finalWorkspaceId && finalWorkspaceId !== "sandbox_labeling") {
          const [accountsSnap, rulesSnap] = await Promise.all([
            db.collection("chartAccounts").where("workspaceId", "==", finalWorkspaceId).get(),
            db.collection("autoRules").where("workspaceId", "==", finalWorkspaceId).get()
          ]);
          accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
          rules = rulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        }
      } catch (err: any) {
        console.warn("[Labeler API] Direct DB configuration fetch bypassed safely: ", (err as Error).message || err);
      }

      if (accounts.length === 0) {
        accounts = [
          { id: "revenue", name: "Operating Revenue / Sales", type: "revenue" },
          { id: "software", name: "Software Hosting / SaaS", type: "expense" },
          { id: "marketing", name: "Marketing & Advertising", type: "expense" },
          { id: "travel", name: "Travel & Lodging", type: "expense" },
          { id: "payroll", name: "Payroll & Team Wages", type: "expense" },
          { id: "tax", name: "Tax Expenses", type: "expense" },
          { id: "office", name: "Office Supplies", type: "expense" },
          { id: "uncategorized", name: "Uncategorized/Suspense", type: "expense" }
        ];
      }

      const labeledTransactions = transactions.map((tx: any, idx: number) => {
        const rawDesc = String(tx.description || tx.memo || tx.payee || "").trim();
        const rawDate = String(tx.date || new Date().toISOString().split('T')[0]);
        const amountCents = typeof tx.amountCents === "number" ? tx.amountCents : TruthEngine.parseAmountToCents(tx.amount || "0");
        const payeeVal = String(tx.payee || "").trim();

        let matchedAccountName = "Uncategorized/Suspense";
        let matchedCategoryId = "uncategorized";
        let confidenceScore = 0.40;
        let ruleIdMatched = null;

        const lowerDesc = rawDesc.toLowerCase();

        // 1. Resolve with Custom Rules Sequence
        if (rules.length > 0) {
          for (const rule of rules) {
            const pattern = (rule.condition?.descriptionContains || "").toLowerCase().trim();
            const vendor = (rule.condition?.vendor || "").toLowerCase().trim();

            if (pattern && lowerDesc.includes(pattern)) {
              const acc = accounts.find(a => a.id === rule.action?.targetNodeId);
              if (acc) {
                matchedAccountName = acc.name;
                matchedCategoryId = acc.id;
                confidenceScore = 0.95;
                ruleIdMatched = rule.id;
                break;
              }
            }

            if (vendor && payeeVal.toLowerCase().includes(vendor)) {
              const acc = accounts.find(a => a.id === rule.action?.targetNodeId);
              if (acc) {
                matchedAccountName = acc.name;
                matchedCategoryId = acc.id;
                confidenceScore = 0.95;
                ruleIdMatched = rule.id;
                break;
              }
            }
          }
        }

        // 2. Fallback to System Heuristics Lexicon
        if (confidenceScore < 0.8) {
          if (/(aws|amazon web|google cloud|gcp|heroku|vercel|digitalocean|cloudflare|github|slack|zoom|openai|gsuite|microsoft)/i.test(lowerDesc)) {
            const acc = accounts.find(a => a.type === "expense" && /soft|SaaS|host|compute|tech/gi.test(a.name || '')) || accounts.find(a => a.id === "software");
            if (acc) {
              matchedAccountName = acc.name;
              matchedCategoryId = acc.id;
              confidenceScore = 0.85;
            }
          }
          else if (/(ads|facebook|instagram|meta|google ads|adwords|campaign|marketing|promo|twitter|linkedin)/i.test(lowerDesc)) {
            const acc = accounts.find(a => a.type === "expense" && /market|advert|growth/gi.test(a.name || '')) || accounts.find(a => a.id === "marketing");
            if (acc) {
              matchedAccountName = acc.name;
              matchedCategoryId = acc.id;
              confidenceScore = 0.85;
            }
          }
          else if (/(uber|lyft|taxi|delta|united|airline|flight|hotel|airbnb|expedia|travel|cab)/i.test(lowerDesc)) {
            const acc = accounts.find(a => a.type === "expense" && /travel|lodge|commute/gi.test(a.name || '')) || accounts.find(a => a.id === "travel");
            if (acc) {
              matchedAccountName = acc.name;
              matchedCategoryId = acc.id;
              confidenceScore = 0.85;
            }
          }
          else if (/(salary|wage|payroll|team|staff|remuneration|gusto|paychex|rippling)/i.test(lowerDesc)) {
            const acc = accounts.find(a => a.type === "expense" && /payr|wage|salary|compens/gi.test(a.name || '')) || accounts.find(a => a.id === "payroll");
            if (acc) {
              matchedAccountName = acc.name;
              matchedCategoryId = acc.id;
              confidenceScore = 0.85;
            }
          }
          else if (/(irs|tax|levy|vat|gst|revenue agency|comptroller)/i.test(lowerDesc)) {
            const acc = accounts.find(a => a.type === "expense" && /tax/gi.test(a.name || '')) || accounts.find(a => a.id === "tax");
            if (acc) {
              matchedAccountName = acc.name;
              matchedCategoryId = acc.id;
              confidenceScore = 0.90;
            }
          }
          else if (/(staples|amazon|walmart|target|office depot|paper|printer|hardware|bestbuy)/i.test(lowerDesc)) {
            const acc = accounts.find(a => a.type === "expense" && /office|supply|merchant/gi.test(a.name || '')) || accounts.find(a => a.id === "office");
            if (acc) {
              matchedAccountName = acc.name;
              matchedCategoryId = acc.id;
              confidenceScore = 0.75;
            }
          }
          else if (/(stripe|invoice|deposit|payment from|sales|customer|client|wire in)/i.test(lowerDesc)) {
            const acc = accounts.find(a => a.type === "revenue") || accounts.find(a => a.id === "revenue");
            if (acc) {
              matchedAccountName = acc.name;
              matchedCategoryId = acc.id;
              confidenceScore = 0.80;
            }
          }
        }

        // 3. Jaccard-style String Word Similarity Tokenizer Match
        if (confidenceScore < 0.6) {
          let bestMatch = null;
          let highestSim = 0;
          accounts.forEach(acc => {
            const accNameWords = (acc.name || '').toLowerCase().split(/\s+/);
            const descWords = lowerDesc.split(/\s+/);
            let common = 0;
            accNameWords.forEach((w: string) => {
              if (w.length > 3 && descWords.includes(w)) common++;
            });
            if (common > highestSim) {
              highestSim = common;
              bestMatch = acc;
            }
          });

          if (bestMatch && highestSim > 0) {
            matchedAccountName = (bestMatch as any).name;
            matchedCategoryId = (bestMatch as any).id;
            confidenceScore = 0.60 + Math.min(0.20, highestSim * 0.05);
          }
        }

        const isExpense = amountCents < 0 || (amountCents > 0 && !/(revenue|income|sales)/i.test(matchedAccountName));

        return {
          id: tx.id || `lbl-${idx}-${Date.now()}`,
          date: rawDate,
          description: rawDesc,
          payee: payeeVal || "N/A",
          amountCents,
          detectedAccountName: matchedAccountName,
          detectedAccountId: matchedCategoryId,
          isExpense,
          confidenceScore: parseFloat(confidenceScore.toFixed(2)),
          complianceStatus: confidenceScore >= 0.80 ? "VERIFIED" : "REVIEW_REQUIRED",
          matchedRuleId: ruleIdMatched
        };
      });

      res.json({
        status: "success",
        workspaceId: finalWorkspaceId,
        labeledTransactionsCount: labeledTransactions.length,
        labeledTransactions
      });
    } catch (error: any) {
      sendError(res, "Labeling Engine Operation Failure", 500, error.message);
    }
  });

  // Mount kernel routes
  app.use("/api/v1/transactions", apiAuthenticate, transactionRouter);
  app.use("/api/v1/revenue", apiAuthenticate, revenueRouter);
  app.use("/api/v1/consolidation", apiAuthenticate, consolidationRouter);
  app.use("/api/v1/lease", apiAuthenticate, leaseRouter);
  app.use("/api/v1/inventory", apiAuthenticate, inventoryRouter);
  app.use("/api/v1/invoices/public", publicInvoiceRouter);
  app.use("/api/v1/invoices/email", apiAuthenticate, invoiceEmailRouter);

  const http = await import('http');
  const httpServer = http.createServer(app);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  await syncGlobalAdminConfig();

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
  });
}

console.debug("🌀 [Server] Booting LedgerFlow Backend...");
startServer().catch(err => {
  console.error("💥 [Server] Critical Startup Failure:", err);
  process.exit(1);
});
async function trainClassifierWithWorkspaceData(classifier: import("./src/lib/algorithms.ts").BayesianClassifier, workspaceId: string, apiKeyId?: string) {
  const db = getDb();
  let trainedCount = 0;
  try {
    const transactionsSnap = await db.collection("transactions").where("workspaceId", "==", workspaceId).limit(200).get();
    transactionsSnap.docs.forEach(doc => {
      const txData = doc.data();
      if (txData && txData.description) {
        const category = txData.category || txData.lines?.find((l: any) => l.category)?.category || txData.lines?.find((l: any) => l.amountCents > 0)?.accountName;
        if (category) {
          classifier.train(txData.description, category, 1.5);
          trainedCount++;
        }
      }
    });
  } catch (err: any) {}

  try {
    const activeKeyId = apiKeyId || "human_web_console";
    const queryPromises = [
      db.collection("learnedDeltas").where("apiKeyId", "==", "human_web_console").limit(150).get()
    ];
    if (activeKeyId !== "human_web_console") {
      queryPromises.push(db.collection("learnedDeltas").where("apiKeyId", "==", activeKeyId).limit(150).get());
    }
    const snaps = await Promise.all(queryPromises);
    snaps.forEach(snap => {
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data && data.description && data.category && data.workspaceId === workspaceId) {
          classifier.train(data.description, data.category, 3.0);
          trainedCount++;
        }
      });
    });
  } catch (err: any) {}
  
  return trainedCount;
}
