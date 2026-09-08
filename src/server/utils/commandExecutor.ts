import { Request, Response } from 'express';
import { getFirestore, Transaction as FirestoreTransaction } from 'firebase-admin/firestore';
import { 
  executeIdempotent, 
  extractCanonicalOperationId, 
  deriveScopedOperationKey 
} from './idempotency';

export interface CommandContext {
  actor: string;
  workspaceId: string;
  operationType: string;
  operationId?: string;
}

/**
 * Standardizes command execution with idempotency across all workspace operations.
 * Extracts canonical OperationId from headers ('x-operation-id', 'idempotency-key') or body.
 * Always guarantees ONE unified Firestore transaction context passed to the action.
 */
export async function executeCommand<T>(
  req: Request,
  res: Response,
  operationType: string,
  action: (ctx: CommandContext, t: FirestoreTransaction) => Promise<T>
) {
  const user = (req as any).user;
  const rawOperationId = extractCanonicalOperationId(req);
  
  const ctx: CommandContext = {
    actor: user?.uid || 'anonymous',
    workspaceId: (req.body?.workspaceId || req.params?.workspaceId || req.query?.workspaceId || 'system') as string,
    operationType,
    operationId: rawOperationId
  };

  const db = getFirestore();

  if (!rawOperationId) {
    // No operation ID provided: execute within a single Firestore transaction
    try {
      const result = await db.runTransaction(async (t) => {
        return await action(ctx, t);
      });
      return res.json({ status: 'success', data: result });
    } catch (error: any) {
      console.error(`[CommandExecutor] Operation ${operationType} failed:`, error);
      return res.status(error.status || 500).json({ 
        status: 'error', 
        message: error.message, 
        details: error.details 
      });
    }
  }

  // Canonical namespaced key: workspaceId:operationType:operationId
  const scopedKey = deriveScopedOperationKey(ctx.workspaceId, operationType, rawOperationId);

  try {
    const result = await executeIdempotent(scopedKey, ctx, async (t) => {
      return await action(ctx, t);
    });
    return res.json({ status: 'success', data: result });
  } catch (error: any) {
    if (error.status === 409 || error.message?.includes('already in progress')) {
      return res.status(409).json({ status: 'error', message: error.message });
    }
    console.error(`[CommandExecutor] Idempotent operation ${scopedKey} failed:`, error);
    return res.status(error.status || 500).json({ 
      status: 'error', 
      message: error.message, 
      details: error.details 
    });
  }
}
