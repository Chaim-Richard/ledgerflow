import express from 'express';
import { requireLedgerWriter } from '../middleware/requireLedgerWriter';
import { registerTransactionCrudRoutes } from './transactions/crudRoutes';
import { registerTransactionBulkRoutes } from './transactions/bulkRoutes';
import { registerReconcileRoutes } from './transactions/reconcileRoutes';
import { registerPeriodRoutes } from './transactions/periodRoutes';
import { registerReverseRoutes } from './transactions/reverseRoutes';

export { formatTzDate, enforceDoubleEntrySafety } from './transactions/helpers';
export { handleReconcile } from './transactions/reconcileRoutes';

/**
 * /api/v1/transactions (F-06: the routes live in ./transactions/, one file per area).
 * The writer-role check runs before every route; the areas are registered in the original order.
 */
export const transactionRouter = express.Router();
transactionRouter.use(requireLedgerWriter);

registerTransactionCrudRoutes(transactionRouter);
registerTransactionBulkRoutes(transactionRouter);
registerReconcileRoutes(transactionRouter);
registerPeriodRoutes(transactionRouter);
registerReverseRoutes(transactionRouter);
