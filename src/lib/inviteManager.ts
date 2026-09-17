import { createHmac } from 'node:crypto';

export interface WorkspaceInvite {
  inviteId: string;
  workspaceId: string;
  email: string;
  role: 'admin' | 'accountant' | 'viewer';
  expiresAt: string;
  token: string;
}

export function generateInviteToken(workspaceId: string, email: string, secretKey = 'ledgerflow-secret'): WorkspaceInvite {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const inviteId = `inv_${Math.random().toString(36).substr(2, 9)}`;

  const token = createHmac('sha256', secretKey)
    .update(`${workspaceId}:${email}:${expiresAt}:${inviteId}`)
    .digest('hex');

  return {
    inviteId,
    workspaceId,
    email: email.toLowerCase().trim(),
    role: 'accountant',
    expiresAt,
    token
  };
}
