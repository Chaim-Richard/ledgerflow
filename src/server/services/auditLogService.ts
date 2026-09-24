import { getDb } from '../db/firestore';

export interface AuditLogEntryInput {
  workspaceId: string;
  uid: string;
  email?: string;
  action: string;
  entityType: string;
  entityId: string;
  details: {
    description: string;
    [key: string]: unknown;
  };
  severity?: string;
  timestamp?: string;
}

export function buildAuditLogRecord(input: AuditLogEntryInput, id: string) {
  const timestamp = input.timestamp || new Date().toISOString();
  const email = input.email || '';
  return {
    id,
    uid: input.uid,
    userId: input.uid,
    actorUid: input.uid,
    email,
    userEmail: email,
    actorEmail: email,
    workspaceId: input.workspaceId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    details: input.details,
    severity: input.severity || 'info',
    timestamp
  };
}

export async function writeServerAuditLog(
  input: AuditLogEntryInput,
  options?: { db?: any; tx?: any }
): Promise<string> {
  const db = options?.db || getDb();
  const auditRef = db.collection('auditLogs').doc();
  const record = buildAuditLogRecord(input, auditRef.id);

  if (options?.tx) {
    options.tx.set(auditRef, record);
  } else {
    await auditRef.set(record);
  }

  return auditRef.id;
}
