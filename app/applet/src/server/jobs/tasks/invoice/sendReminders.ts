import { getDb } from '../../../db/firestore';
import { JobResult } from '../../types';
import { sendEmailWithSuppression } from '../../../services/emailService';

export async function sendInvoiceRemindersJob(): Promise<JobResult> {
  const db = getDb();
  let itemsProcessed = 0;

  try {
    const snap = await db.collection('invoices')
      .where('status', '==', 'overdue')
      .get();

    for (const doc of snap.docs) {
      const inv = doc.data();
      const recipient = inv.customerEmail;
      if (!recipient) continue;

      // Send dunning reminder email with bounce suppression check
      const sendResult = await sendEmailWithSuppression({
        workspaceId: inv.workspaceId || 'default',
        to: recipient,
        subject: `Payment Reminder: Invoice ${inv.number || doc.id}`,
        html: `<p>Dear ${inv.customerName || 'Customer'},</p><p>This is a payment reminder for Invoice <strong>${inv.number || doc.id}</strong> due on ${inv.dueDate}. Please remit payment at your earliest convenience.</p>`,
        invoiceId: doc.id
      });

      if (sendResult.sent) {
        itemsProcessed++;
        await doc.ref.update({
          lastReminderSentAt: new Date().toISOString()
        });
      }
    }

    return {
      jobName: 'invoice/send-reminders',
      status: 'success',
      itemsProcessed
    };
  } catch (err: any) {
    return {
      jobName: 'invoice/send-reminders',
      status: 'failed',
      itemsProcessed,
      error: err.message
    };
  }
}
