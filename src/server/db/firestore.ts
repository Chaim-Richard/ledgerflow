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

const activeFirebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || firebaseConfig.projectId;

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

export async function validateWorkspaceMember(db: Firestore, workspaceId: string, user: { uid: string; admin?: boolean; developerWorkspaceId?: string }) {
  if (!workspaceId) throw new Error('Workspace ID is required.');
  if (user.developerWorkspaceId && user.developerWorkspaceId !== workspaceId) {
    throw new Error(`Unauthorized: API key is scoped strictly to workspace ${user.developerWorkspaceId}`);
  }
  const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
  if (!wsDoc.exists) throw new Error('Workspace not found.');
  const data = wsDoc.data() || {};
  const isMember = data.uid === user.uid || (Array.isArray(data.members) && data.members.includes(user.uid)) || (data.admins && data.admins[user.uid]) || user.admin;
  if (!isMember) {
    throw new Error('Unauthorized: You are not a member of this workspace.');
  }
  return { wsDoc, data };
}

export const assertWorkspaceAccess = validateWorkspaceMember;

export async function assertPeriodOpen(db: Firestore, workspaceId: string, date: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid transaction date format: ${date}. Expected YYYY-MM-DD.`);
  }
  const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
  const lockDate = wsDoc.data()?.lockDate;
  if (lockDate && date <= lockDate) {
    throw new Error(`Period Locked: Posting forbidden for transaction date ${date} on or prior to lock date ${lockDate}.`);
  }
}

export async function validateWorkspaceAccounts(db: Firestore, workspaceId: string, accountIds: string[]): Promise<Map<string, { id: string; name: string; type: string; category?: string }>> {
  const accountMap = new Map<string, { id: string; name: string; type: string; category?: string }>();
  const validIds = Array.from(new Set(accountIds.filter(Boolean)));
  if (validIds.length === 0) return accountMap;

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
  return accountMap;
}
