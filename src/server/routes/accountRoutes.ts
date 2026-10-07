/**
 * The signed-in person's own account: GET /api/v1/account/my-data (L-10), and recovery codes for
 * two-step login (L-85): GET /recovery-codes (how many are left), POST /recovery-codes (ten new ones,
 * shown once), POST /recovery-codes/use (a password-only session may call it: apiAuthenticate).
 */
import express from 'express';
import { getDb } from '../db/firestore';
import { collectPersonalData } from '../services/personalDataService';
import type { AuthenticatedRequest } from './workspaceRoutes';
import { makeRecoveryCodes, recoveryStatus, RecoveryError, useRecoveryCode } from '../services/recoveryCodeService';

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

const recoveryFail = (res: express.Response, err: unknown) => {
  if (err instanceof RecoveryError) return res.status(err.status).json({ status: 'error', message: err.message });
  res.status(500).json({ status: 'error', message: 'Recovery codes are not available right now', details: err instanceof Error ? err.message : String(err) });
};

accountRouter.get('/recovery-codes', async (req, res) => {
  const user = (req as unknown as AuthenticatedRequest).user;
  try { res.json({ status: 'success', ...(await recoveryStatus(getDb(), user.uid)) }); } catch (err) { recoveryFail(res, err); }
});

accountRouter.post('/recovery-codes', async (req, res) => {
  const user = (req as unknown as AuthenticatedRequest).user;
  try {
    const codes = await makeRecoveryCodes(getDb(), user.uid);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'success', codes });
  } catch (err) { recoveryFail(res, err); }
});

accountRouter.post('/recovery-codes/use', async (req, res) => {
  const user = (req as unknown as AuthenticatedRequest).user;
  const code = typeof req.body?.code === 'string' ? req.body.code.slice(0, 40) : '';
  if (!code) return res.status(400).json({ status: 'error', message: 'Enter a recovery code' });
  try { res.json({ status: 'success', ...(await useRecoveryCode(getDb(), user.uid, code)) }); } catch (err) { recoveryFail(res, err); }
});
