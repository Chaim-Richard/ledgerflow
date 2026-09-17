import { Invoice, Bill } from '../types';

export interface ApprovalRule {
  id: string;
  workspaceId: string;
  entityType: 'invoice' | 'bill';
  thresholdCents: number;
  approverRoles: Array<'owner' | 'accountant' | 'manager'>;
  autoApproveBelowThreshold: boolean;
}

export interface ApprovalRequest {
  id: string;
  workspaceId: string;
  entityId: string;
  entityType: 'invoice' | 'bill';
  amountCents: number;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  approverEmail?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export function evaluateApprovalRequirement(
  entity: Invoice | Bill,
  entityType: 'invoice' | 'bill',
  rule: ApprovalRule
): { requiresApproval: boolean; autoApproved: boolean } {
  const amount = entity.amountCents || 0;

  if (amount < rule.thresholdCents && rule.autoApproveBelowThreshold) {
    return { requiresApproval: false, autoApproved: true };
  }

  return { requiresApproval: true, autoApproved: false };
}

export function approveRequest(
  request: ApprovalRequest,
  approverEmail: string
): ApprovalRequest {
  return {
    ...request,
    status: 'approved',
    approverEmail,
    approvedAt: new Date().toISOString()
  };
}

export function rejectRequest(
  request: ApprovalRequest,
  approverEmail: string,
  rejectionReason: string
): ApprovalRequest {
  return {
    ...request,
    status: 'rejected',
    approverEmail,
    rejectionReason,
    approvedAt: new Date().toISOString()
  };
}
