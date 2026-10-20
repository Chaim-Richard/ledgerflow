import express from 'express';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { importPayroll, PayrollImportError } from '../services/payrollImportService';

/**
 * PAY-1: a payroll provider's CSV, mounted at /api/v1/workspaces/:workspaceId/payroll-imports (workspaceRoutes.ts,
 * owners and accountants). POST reads the file on the server and posts one entry per pay date
 * (payrollImportService.ts); a refusal lists every problem found, and nothing is posted.
 */
export const payrollImportRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string } };
const account = z.string().min(1).max(200).optional();
const schema = z.object({
  provider: z.enum(['adp', 'gusto', 'paychex']),
  csv: z.string().min(1).max(5_000_000),
  fileName: z.string().max(300).optional(),
  accounts: z.object({
    wages: account, employerTaxExpense: account, employerBenefitExpense: account, withholdings: account,
    deductions: account, employerTaxLiability: account, employerBenefitLiability: account, clearing: account,
  }).strict(),
  labelDimensionId: z.string().min(1).max(100).optional(),
}).strict();

payrollImportRouter.post('/', async (req, res) => {
  const { user } = req as unknown as AuthedRequest;
  try {
    const body = schema.parse(req.body);
    const result = await importPayroll(getDb(), { ...body, workspaceId: String((req.params as Record<string, string>).workspaceId), uid: user.uid, email: user.email });
    res.json({ status: 'success', ...result });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'Choose the provider, the file and the accounts', problems: [] });
    if (err instanceof PayrollImportError) return res.status(err.status).json({ status: 'error', message: err.message, problems: err.problems });
    res.status(500).json({ status: 'error', message: 'The payroll could not be imported', details: err instanceof Error ? err.message : String(err) });
  }
});
