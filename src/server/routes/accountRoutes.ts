/**
 * The signed-in person's own account: GET /api/v1/account/my-data (L-10).
 */
import express from 'express';
import { getDb } from '../db/firestore';
import { collectPersonalData } from '../services/personalDataService';
import type { AuthenticatedRequest } from './workspaceRoutes';

export const accountRouter = express.Router();

accountRouter.get('/my-data', async (req, res) => {
  const user = (req as unknown as AuthenticatedRequest).user;
  if (!user?.uid) return res.status(401).json({ error: 'Sign in required' });
  try {
    const data = await collectPersonalData(getDb(), { uid: user.uid, email: user.email });
    res.setHeader('Content-Disposition', 'attachment; filename="ledgerflow-my-data.json"');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not collect your data' });
  }
});
