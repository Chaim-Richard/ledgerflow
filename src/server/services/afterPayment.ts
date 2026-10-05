import type { DocumentData, Firestore } from '../db/firestore';
import { notifyPaymentReceived } from './notificationService';
import { thankForPayment } from './documentEmailService';
import { logger } from '../utils/logger';

/**
 * What happens after a payment is saved (all three ways one is recorded: the payment dialog, a
 * bank line, an online payment): the in-app notification, and the customer's thank-you email when
 * the workspace turned it on (BE-02). Neither can undo or hold up the payment.
 */
export async function afterPaymentRecorded(db: Firestore, payment: DocumentData, actorUid?: string): Promise<void> {
  await notifyPaymentReceived(db, payment, actorUid);
  if (payment.direction !== 'received' || !payment.workspaceId) return;
  try {
    await thankForPayment(db, { workspaceId: String(payment.workspaceId), allocations: Array.isArray(payment.allocations) ? payment.allocations : [] });
  } catch (err) {
    logger.warn('thank-you email not sent', { workspaceId: payment.workspaceId, paymentId: payment.id, error: err instanceof Error ? err.message : String(err) });
  }
}
