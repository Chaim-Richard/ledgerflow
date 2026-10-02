/**
 * A person's own data, on request (L-10, GDPR article 15/20): their profile, the workspaces they
 * belong to and their role, their notifications, sign-in log, templates and the audit entries of
 * what they did. The books themselves belong to each workspace: an owner downloads them with the
 * workspace backup (Settings → Backup).
 */
import type { Firestore } from '../db/firestore';

const AUDIT_LIMIT = 5000;

export async function collectPersonalData(db: Firestore, user: { uid: string; email?: string }): Promise<Record<string, unknown>> {
  const rows = async (table: string, field: string, limit = 5000) =>
    (await db.collection(table).where(field, '==', user.uid).limit(limit).get()).docs.map(d => ({ id: d.id, ...d.data() }));

  const profile = await db.collection('users').doc(user.uid).get();
  const workspaces = new Map<string, Record<string, unknown>>();
  for (const snap of [
    await db.collection('workspaces').where('uid', '==', user.uid).get(),
    await db.collection('workspaces').where('members', 'array-contains', user.uid).get(),
  ]) snap.docs.forEach(d => workspaces.set(d.id, d.data() || {}));

  const auditEntries = await rows('auditLogs', 'uid', AUDIT_LIMIT);
  return {
    exportedAt: new Date().toISOString(),
    person: { uid: user.uid, email: user.email || null, profile: profile.exists ? profile.data() : null },
    workspaces: [...workspaces.entries()].map(([id, data]) => ({
      id,
      name: data.name || id,
      role: data.uid === user.uid ? 'owner' : ((data.roles || {}) as Record<string, string>)[user.uid] || 'viewer',
    })),
    notifications: await rows('notifications', 'uid'),
    signIns: await rows('loginAudits', 'uid'),
    templates: await rows('customTemplates', 'uid'),
    activity: auditEntries,
    notes: {
      activity: auditEntries.length >= AUDIT_LIMIT ? `The ${AUDIT_LIMIT} most recent entries; ask support for the rest.` : 'Everything you did that the audit trail recorded.',
      books: 'Invoices, entries and other records belong to each workspace. An owner downloads them with the workspace backup (Settings → Backup & Export).',
    },
  };
}
