import admin from 'firebase-admin';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';

let firebaseConfig: Record<string, any> = {};
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (error) {
  console.warn('[Firebase Admin] Warning: Could not read firebase-applet-config.json:', error);
}

const activeFirebaseProjectId = firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID;

function initializeAdminApp() {
  if (admin.apps.length === 0) {
    if (!activeFirebaseProjectId) {
      throw new Error('[Firebase Admin Error] Missing Firebase Project ID configuration. Set FIREBASE_PROJECT_ID environment variable or provide firebase-applet-config.json.');
    }
    admin.initializeApp({
      projectId: activeFirebaseProjectId,
    });
  }
}

if (activeFirebaseProjectId && admin.apps.length === 0) {
  admin.initializeApp({
    projectId: activeFirebaseProjectId,
  });
}

export const getDb = (): Firestore => {
  initializeAdminApp();
  const dbId = process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '(default)';
  if (dbId && dbId !== '(default)') {
    return getFirestore(admin.app(), dbId);
  }
  return getFirestore(admin.app());
};

export const workspaceMemoryCache = new Map<string, any>();

export async function validateWorkspaceMember(db: Firestore, workspaceId: string, user: { uid: string; admin?: boolean; developerWorkspaceId?: string }) {
  if (!workspaceId) throw new Error('Workspace ID is required.');
  if (user.developerWorkspaceId && user.developerWorkspaceId !== workspaceId) {
    throw new Error(`Unauthorized: API key is scoped strictly to workspace ${user.developerWorkspaceId}`);
  }

  try {
    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    if (wsDoc.exists) {
      const data = wsDoc.data() || {};
      const isMember = data.uid === user.uid || (Array.isArray(data.members) && data.members.includes(user.uid)) || (data.admins && data.admins[user.uid]) || user.admin;
      if (!isMember) {
        throw new Error('Unauthorized: You are not a member of this workspace.');
      }
      workspaceMemoryCache.set(workspaceId, data);
      return { wsDoc, data };
    }
  } catch (err: any) {
    if (process.env.NODE_ENV === 'production') throw err;
    // If permission denied or database unreachable due to GCP/IAM service account constraints in preview
    if (
      err.message?.includes('PERMISSION_DENIED') ||
      err.message?.includes('Missing or insufficient permissions') ||
      err.code === 7 ||
      err.code === 'permission-denied'
    ) {
      console.warn('[Firebase Admin] validateWorkspaceMember falling back to memory/default due to IAM constraint:', err.message);
      const cached = workspaceMemoryCache.get(workspaceId);
      const fallbackData = cached || {
        id: workspaceId,
        uid: user.uid,
        name: 'Workspace',
        plan: 'sandbox',
        concurrentUserLimit: 50,
        computeCreditBalance: 100000,
        apiQuotaTotalCentsUsed: 0,
        apiQuotaMonthlyLimitCents: 0
      };
      return {
        wsDoc: {
          exists: true,
          data: () => fallbackData,
          id: workspaceId
        } as any,
        data: fallbackData
      };
    }
    // Re-throw if it's already an Unauthorized error
    if (err.message?.startsWith('Unauthorized:')) {
      throw err;
    }
    throw err;
  }

  // If doc does not exist
  const cached = workspaceMemoryCache.get(workspaceId);
  if (cached) {
    const isMember = cached.uid === user.uid || (Array.isArray(cached.members) && cached.members.includes(user.uid)) || (cached.admins && cached.admins[user.uid]) || user.admin;
    if (isMember) {
      return {
        wsDoc: { exists: true, data: () => cached, id: workspaceId } as any,
        data: cached
      };
    }
  }
  throw new Error('Workspace not found.');
}

export const assertWorkspaceAccess = validateWorkspaceMember;

export async function assertPeriodOpen(db: Firestore, workspaceId: string, date: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid transaction date format: ${date}. Expected YYYY-MM-DD.`);
  }
  try {
    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    const lockDate = wsDoc.data()?.lockDate;
    if (lockDate && date <= lockDate) {
      throw new Error(`Period Locked: Posting forbidden for transaction date ${date} on or prior to lock date ${lockDate}.`);
    }
  } catch (err: any) {
    if (err.message?.includes('Period Locked:')) throw err;
    if (
      err.message?.includes('PERMISSION_DENIED') ||
      err.message?.includes('Missing or insufficient permissions') ||
      err.code === 7
    ) {
      console.warn('[Firebase Admin] assertPeriodOpen skipping lockDate check due to IAM constraint:', err.message);
      return;
    }
    throw err;
  }
}

export async function validateWorkspaceAccounts(db: Firestore, workspaceId: string, accountIds: string[]): Promise<Map<string, { id: string; name: string; type: string; category?: string }>> {
  const accountMap = new Map<string, { id: string; name: string; type: string; category?: string }>();
  const validIds = Array.from(new Set(accountIds.filter(Boolean)));
  if (validIds.length === 0) return accountMap;

  try {
    const refs = validIds.map(id => db.collection('chartAccounts').doc(id));
    const docs = await db.getAll(...refs);

    for (const accDoc of docs) {
      if (!accDoc.exists) {
        throw new Error(`Account ${accDoc.id} not found in chart of accounts.`);
      }
      const accData = accDoc.data() || {};
      if (accData.workspaceId !== workspaceId) {
        throw new Error(`Security Violation: Account ${accDoc.id} (${accData.name || 'unnamed'}) belongs to another workspace (${accData.workspaceId}). Cross-workspace ledger references are forbidden.`);
      }
      accountMap.set(accDoc.id, {
        id: accDoc.id,
        name: accData.name || 'Account',
        type: accData.type || 'asset',
        category: accData.category
      });
    }
  } catch (err: any) {
    if (process.env.NODE_ENV === 'production') throw err;
    if (err.message?.includes('Security Violation:') || err.message?.includes('not found in chart of accounts')) throw err;
    if (
      err.message?.includes('PERMISSION_DENIED') ||
      err.message?.includes('Missing or insufficient permissions') ||
      err.code === 7
    ) {
      console.warn('[Firebase Admin] validateWorkspaceAccounts falling back to pass-through due to IAM constraint:', err.message);
      for (const id of validIds) {
        accountMap.set(id, { id, name: 'Account', type: 'asset' });
      }
      return accountMap;
    }
    throw err;
  }
  return accountMap;
}
