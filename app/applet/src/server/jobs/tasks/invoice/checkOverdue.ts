import { getDb } from '../../../db/firestore';
import { JobResult } from '../../types';

export async function checkOverdueInvoicesJob(): Promise<JobResult> {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  let itemsProcessed = 0;

  try {
    const snap = await db.collection('invoices')
      .where('status', 'in', ['sent', 'viewed'])
      .get();

    for (const doc of snap.docs) {
      const inv = doc.data();
      if (inv.dueDate && inv.dueDate < today) {
        await doc.ref.update({
          status: 'overdue',
          updatedAt: new Date().toISOString()
        });

        // Add notification
        const notifRef = db.collection('notifications').doc();
        await notifRef.set({
          id: notifRef.id,
          workspaceId: inv.workspaceId || 'system',
          type: 'invoice_overdue',
          title: `Invoice ${inv.number || doc.id} Overdue`,
          message: `Invoice for ${inv.customerName || 'Customer'} due on ${inv.dueDate} is now overdue.`,
          entityId: doc.id,
          entityType: 'invoice',
          createdAt: new Date().toISOString(),
          read: false
        });

        itemsProcessed++;
      }
    }

    return {
      jobName: 'invoice/check-overdue',
      status: 'success',
      itemsProcessed
    };
  } catch (err: any) {
    return {
      jobName: 'invoice/check-overdue',
      status: 'failed',
      itemsProcessed,
      error: err.message
    };
  }
}
