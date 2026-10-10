import express from 'express';
import { getDb } from '../db/firestore';
import { AllocationRuleError, setAllocationRules } from '../services/allocationRuleService';
import { PriceListError, setPriceLists } from '../services/priceListService';
import { SalesRepError, setSalesReps } from '../services/salesRepService';

/**
 * A workspace's saved lists that only the server writes, each replaced whole with PUT: the split
 * rules (Q-05, mounted at /api/v1/workspaces/:workspaceId/allocation-rules) and the price lists
 * (M-11, at .../price-lists) and the sales reps (P-13, at .../sales-reps). All mounted by workspaceRoutes.ts for owners and accountants.
 */
type AuthedRequest = express.Request & { user: { uid: string; email?: string } };

const fail = (res: express.Response, err: unknown, known: (e: unknown) => e is { status: number; message: string }, what: string) => {
  if (known(err)) return res.status(err.status).json({ status: 'error', message: err.message });
  res.status(500).json({ status: 'error', message: `Could not save the ${what}`, details: err instanceof Error ? err.message : String(err) });
};

export const allocationRuleRouter = express.Router({ mergeParams: true });
allocationRuleRouter.put('/', async (req, res) => {
  const user = (req as AuthedRequest).user;
  try {
    res.json({ status: 'success', ...(await setAllocationRules(getDb(), { workspaceId: String((req.params as Record<string, string>).workspaceId), uid: user.uid, email: user.email, rules: req.body?.rules })) });
  } catch (err) { fail(res, err, (e): e is AllocationRuleError => e instanceof AllocationRuleError, 'split rules'); }
});

export const priceListRouter = express.Router({ mergeParams: true });
priceListRouter.put('/', async (req, res) => {
  const user = (req as AuthedRequest).user;
  try {
    res.json({ status: 'success', ...(await setPriceLists(getDb(), { workspaceId: String((req.params as Record<string, string>).workspaceId), uid: user.uid, email: user.email, lists: req.body?.lists })) });
  } catch (err) { fail(res, err, (e): e is PriceListError => e instanceof PriceListError, 'price lists'); }
});

export const salesRepRouter = express.Router({ mergeParams: true });
salesRepRouter.put('/', async (req, res) => {
  const user = (req as AuthedRequest).user;
  try {
    res.json({ status: 'success', ...(await setSalesReps(getDb(), { workspaceId: String((req.params as Record<string, string>).workspaceId), uid: user.uid, email: user.email, reps: req.body?.reps })) });
  } catch (err) { fail(res, err, (e): e is SalesRepError => e instanceof SalesRepError, 'sales reps'); }
});
