import { Request, Response } from 'express';
import { executeIdempotent } from './idempotency';

export interface CommandContext {
  actor: string;
  workspaceId: string;
  operationType: string;
}

/**
 * Standardizes command execution with idempotency.
 * Expects 'Idempotency-Key' header for client-driven idempotency.
 * If no header is provided, it executes normally without deduplication.
 */
export async function executeCommand<T>(
  req: Request,
  res: Response,
  operationType: string,
  action: (ctx: CommandContext) => Promise<T>
) {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  const user = (req as any).user;
  
  const ctx: CommandContext = {
    actor: user?.uid || 'anonymous',
    workspaceId: (req.body?.workspaceId || req.params?.workspaceId || req.query?.workspaceId || 'system') as string,
    operationType
  };

  if (!idempotencyKey) {
    // No key provided, execute without idempotency tracking
    try {
      const result = await action(ctx);
      return res.json({ status: 'success', data: result });
    } catch (error: any) {
      console.error(`[CommandExecutor] Operation ${operationType} failed:`, error);
      return res.status(error.status || 500).json({ status: 'error', message: error.message });
    }
  }

  // Namespace the key to avoid global collisions
  const scopedKey = `${ctx.workspaceId}:${operationType}:${idempotencyKey}`;

  try {
    const result = await executeIdempotent(scopedKey, ctx, () => action(ctx));
    return res.json({ status: 'success', data: result });
  } catch (error: any) {
    if (error.message?.includes('already in progress')) {
      return res.status(409).json({ status: 'error', message: error.message });
    }
    console.error(`[CommandExecutor] Idempotent operation ${scopedKey} failed:`, error);
    return res.status(error.status || 500).json({ status: 'error', message: error.message });
  }
}
