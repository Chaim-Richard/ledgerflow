import express from 'express';
import { getDb } from '../db/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { SupportMessage, SupportTicket, AuditLog } from '../../types';
import { sendSupportNotification } from '../services/emailService';

export const supportRouter = express.Router();

/**
 * POST /api/v1/support/tickets/:id/messages
 * Adds a message to a support ticket and updates the ticket status/unread flags.
 */
supportRouter.post('/tickets/:id/messages', async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const { body, authorRole } = req.body;
    const user = (req as any).user;

    if (!body || !authorRole || !['user', 'admin'].includes(authorRole)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const db = getDb();
    const ticketRef = db.collection('supportTickets').doc(ticketId);
    
    const result = await db.runTransaction(async (t) => {
      const ticketDoc = await t.get(ticketRef);
      if (!ticketDoc.exists) {
        throw new Error('Ticket not found');
      }

      const ticketData = ticketDoc.data() as SupportTicket;

      // Authorization Check
      if (authorRole === 'admin') {
        if (!user.admin) {
          throw new Error('Forbidden: Admin role required');
        }
      } else {
        // User must be a member of the workspace
        const wsDoc = await t.get(db.collection('workspaces').doc(ticketData.workspaceId));
        if (!wsDoc.exists || (wsDoc.data()?.uid !== user.uid && !wsDoc.data()?.members?.includes(user.uid))) {
          throw new Error('Forbidden: Access denied to this workspace');
        }
      }

      const messageId = db.collection('supportMessages').doc().id;
      const createdAt = new Date().toISOString();

      const newMessage: SupportMessage = {
        id: messageId,
        ticketId,
        workspaceId: ticketData.workspaceId,
        authorUid: user.uid,
        authorRole: authorRole as 'user' | 'admin',
        body,
        createdAt
      };

      const messageRef = db.collection('supportMessages').doc(messageId);
      t.set(messageRef, newMessage);

      // Update ticket
      const ticketUpdates: Partial<SupportTicket> = {
        lastMessageAt: createdAt,
        lastMessageBy: user.uid,
        updatedAt: createdAt,
        unreadForUser: authorRole === 'admin',
        unreadForAdmin: authorRole === 'user',
      };

      if (authorRole === 'admin') {
        ticketUpdates.status = 'pending_user';
      } else {
        ticketUpdates.status = 'pending_support';
      }

      t.update(ticketRef, ticketUpdates);

      // Audit Log for admin actions
      if (authorRole === 'admin') {
        const auditRef = db.collection('auditLogs').doc();
        const auditEntry = {
          id: auditRef.id,
          uid: user.uid,
          actorUid: user.uid,
          actorEmail: user.email,
          action: 'SUPPORT_ADMIN_REPLY',
          entityType: 'supportTicket',
          entityId: ticketId,
          details: { body: body.substring(0, 100) },
          timestamp: FieldValue.serverTimestamp()
        };
        t.set(auditRef, auditEntry);
      }

      return { newMessage, ticketData };
    });

    // If admin reply, send email notification
    if (authorRole === 'admin') {
      try {
        const openerDoc = await db.collection('users').doc(result.ticketData.uid).get();
        const openerData = openerDoc.data();
        if (openerData?.email) {
          await sendSupportNotification({
            toEmail: openerData.email,
            subject: `Support Update: ${result.ticketData.subject}`,
            ticketSubject: result.ticketData.subject,
            messageBody: body
          });
        }
      } catch (emailErr) {
        console.error('Failed to send support notification email:', emailErr);
        // Don't fail the request if email fails
      }
    }

    res.status(200).json({ status: 'ok', data: result.newMessage });
  } catch (e: any) {
    console.error('Support message error:', e);
    res.status(e.message.includes('Forbidden') ? 403 : 400).json({ error: e.message });
  }
});

/**
 * PATCH /api/v1/support/tickets/:id/status
 * Admin-only status update for tickets.
 */
supportRouter.patch('/tickets/:id/status', async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const { status } = req.body;
    const user = (req as any).user;

    if (!user.admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!status || !['open', 'pending_user', 'pending_support', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const db = getDb();
    const ticketRef = db.collection('supportTickets').doc(ticketId);

    await db.runTransaction(async (t) => {
      const ticketDoc = await t.get(ticketRef);
      if (!ticketDoc.exists) {
        throw new Error('Ticket not found');
      }

      t.update(ticketRef, { 
        status, 
        updatedAt: new Date().toISOString() 
      });

      const auditRef = db.collection('auditLogs').doc();
      t.set(auditRef, {
        id: auditRef.id,
        uid: user.uid,
        actorUid: user.uid,
        actorEmail: user.email,
        action: 'SUPPORT_TICKET_STATUS_CHANGE',
        entityType: 'supportTicket',
        entityId: ticketId,
        details: { newStatus: status },
        timestamp: FieldValue.serverTimestamp()
      });
    });

    res.status(200).json({ status: 'ok' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
