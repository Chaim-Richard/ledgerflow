import express from "express";
import { z } from "zod";
import admin from "firebase-admin";
import { AIBackendService } from "../services/aiBackendService";
import { SecurityService } from "../../services/securityService";
import { getDb, validateWorkspaceMember } from "../db/firestore";
import { incrementShardedCounter, getShardedCounterValue } from "../services/shardedCounterService";

export const aiRouter = express.Router();

const AiTaskEnum = z.enum([
  'strategic-analysis',
  'generate-forecast',
  'map-transactions',
  'analyze-trends',
  'parse-query',
  'parse-magic-entry',
  'parse-receipt',
  'parse-statement',
  'parse-personal-tax-profile',
  'build-auto-rule'
]);

const AiProcessSchema = z.object({
  task: AiTaskEnum,
  payload: z.record(z.string(), z.any()).optional().default({})
});

const TASK_WEIGHTS: Record<string, number> = {
  'strategic-analysis': 500,
  'generate-forecast': 300,
  'map-transactions': 200,
  'analyze-trends': 300,
  'parse-query': 50,
  'parse-magic-entry': 100,
  'parse-receipt': 150,
  'parse-statement': 250,
  'parse-personal-tax-profile': 200,
  'build-auto-rule': 300
};

aiRouter.post("/process", async (req: express.Request, res: express.Response) => {
  // 1. Ensure GEMINI_API_KEY is configured
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      status: "error",
      message: "AI service is currently unavailable. Gemini API key is missing."
    });
  }

  // 2. Standard token validation (No guest/test bypass allowed)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ status: "error", message: "Unauthenticated: No token provided" });
  }

  const token = authHeader.split("Bearer ")[1];
  let decodedToken: any;
  try {
    decodedToken = await admin.auth().verifyIdToken(token);
  } catch (_e) {
    return res.status(401).json({ status: "error", message: "Unauthenticated: Invalid token" });
  }

  // 3. Parse and validate req body
  const parsed = AiProcessSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid AI task specification",
      errors: parsed.error.issues
    });
  }

  const { task, payload } = parsed.data;
  const workspaceId =
    typeof payload.workspaceId === 'string'
      ? payload.workspaceId
      : typeof req.headers['x-workspace-id'] === 'string'
      ? (req.headers['x-workspace-id'] as string)
      : 'default-workspace';

  // 4. Workspace membership authorization
  if (workspaceId && workspaceId !== 'default-workspace') {
    try {
      const db = getDb();
      const { data: wsData } = await validateWorkspaceMember(db, workspaceId, decodedToken);

      // 5. Compute Credit Checking
      if (wsData && wsData.bypassBilling !== true) {
        const baseline = wsData.computeCreditBalance !== undefined ? Number(wsData.computeCreditBalance) : 100000;
        const currentBalance = await getShardedCounterValue(db, workspaceId, 'computeCreditBalance', baseline);
        
        if (currentBalance <= 0) {
          return res.status(402).json({
            status: "error",
            message: "PAYMENT_REQUIRED: This workspace has exhausted its compute credit balance (0 left). Please upgrade your plan or top up in settings."
          });
        }
      }
    } catch (err: any) {
      return res.status(403).json({
        status: "error",
        message: err.message || "Forbidden: You are not authorized to access this workspace."
      });
    }
  }

  // Scrub PII on chat or textual inputs
  if (payload.query && typeof payload.query === 'string') {
    payload.query = SecurityService.scrubPII(payload.query);
  }
  if (payload.input && typeof payload.input === 'string') {
    payload.input = SecurityService.scrubPII(payload.input);
  }
  if (payload.message && typeof payload.message === 'string') {
    payload.message = SecurityService.scrubPII(payload.message);
  }

  try {
    // 6. Charge compute credits (before execution to prevent credit exhaustion abuse)
    if (workspaceId && workspaceId !== 'default-workspace') {
      const weight = TASK_WEIGHTS[task] || 100;
      const db = getDb();
      await incrementShardedCounter(db, workspaceId, 'computeCreditBalance', -weight);
    }

    // 7. Process task
    const result = await AIBackendService.processTask(task, payload);
    return res.json(result);
  } catch (err: any) {
    return res.status(503).json({
      status: "error",
      message: err.message || "AI task processing failed. Service Unavailable."
    });
  }
});
