import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { setRequireTwoStep, TwoStepPolicyError } from '../services/twoStepPolicyService';

/**
 * Two-step login for everyone in a workspace (Y-30), mounted at
 * /api/v1/workspaces/:workspaceId/security (workspaceRoutes.ts, owners): PUT /two-step {required}.
 */
export const twoStepPolicyRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string; aal?: string } };

twoStepPolicyRouter.put('/two-step', async (req, res) => {
  try {
    const { required } = z.object({ required: z.boolean() }).strict().parse(req.body);
    const { user } = req as unknown as AuthedRequest;
    const workspaceId = String((req.params as Record<string, string>).workspaceId);
    res.json({ status: 'success', ...(await setRequireTwoStep(getDb(), { workspaceId, uid: user.uid, email: user.email, aal: user.aal, required })) });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'Say whether two-step login is required' });
    if (err instanceof TwoStepPolicyError) return res.status(err.status).json({ status: 'error', message: err.message });
    res.status(500).json({ status: 'error', message: 'The setting could not be saved', details: err instanceof Error ? err.message : String(err) });
  }
});
