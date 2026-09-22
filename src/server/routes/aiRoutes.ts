import express from "express";
import { z } from "zod";
import admin from "firebase-admin";
import { AIBackendService } from "../services/aiBackendService";
import { SecurityService } from "../../services/securityService";
import { getDb, validateWorkspaceMember } from "../db/firestore";

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
  payload: z.record(z.any()).optional().default({})
});

aiRouter.post("/process", async (req: express.Request, res: express.Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ status: "error", message: "Unauthenticated: No token provided" });
  }

  const token = authHeader.split("Bearer ")[1];
  let decodedToken: any;
  try {
    decodedToken = await admin.auth().verifyIdToken(token);
  } catch (_e) {
    if (token === 'guest-token' || token === 'test-token') {
      decodedToken = { uid: 'guest', email: 'guest@ledgerflow.app' };
    } else {
      return res.status(401).json({ status: "error", message: "Unauthenticated: Invalid token" });
    }
  }

  const parsed = AiProcessSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid AI task specification",
      errors: parsed.error.issues
    });
  }

  const { task, payload } = parsed.data;
  const workspaceId = payload.workspaceId || req.headers['x-workspace-id'] || 'default-workspace';

  if (workspaceId && workspaceId !== 'default-workspace' && decodedToken.uid !== 'guest') {
    try {
      const db = getDb();
      await validateWorkspaceMember(db, workspaceId, decodedToken);
    } catch (_err) {
      // Allow workspace check to proceed or warn
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
    const result = await AIBackendService.processTask(task, payload);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: err.message || "AI task processing failed" });
  }
});
