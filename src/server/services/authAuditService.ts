import { getDb } from '../db/firestore';

export type AuthAuditEventType = 'login' | 'logout' | 'failed_login' | 'password_reset' | 'token_refresh';

export interface AuthAuditEvent {
  uid: string;
  event: AuthAuditEventType;
  ip?: string;
  userAgent?: string;
  email?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

/**
 * Records an authentication audit trail event into the top-level loginAudits collection.
 */
export async function recordAuthEvent(
  eventData: AuthAuditEvent,
  dbOverride?: any
): Promise<string> {
  const db = dbOverride || getDb();
  const docRef = db.collection('loginAudits').doc();
  const timestamp = eventData.timestamp || new Date().toISOString();

  const auditRecord = {
    id: docRef.id,
    uid: eventData.uid,
    event: eventData.event,
    ip: eventData.ip || 'unknown',
    userAgent: eventData.userAgent || 'unknown',
    email: eventData.email || '',
    metadata: eventData.metadata || {},
    timestamp,
    createdAt: timestamp
  };

  try {
    await docRef.set(auditRecord);
    return docRef.id;
  } catch (err) {
    console.error('[authAuditService] Failed to record auth event:', err);
    return '';
  }
}
