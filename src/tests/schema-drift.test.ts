import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readFileSync } from 'node:fs';

const rulesText = readFileSync('firestore.rules', 'utf8');
const indexesJson = JSON.parse(readFileSync('firestore.indexes.json', 'utf8'));

function extractAffectedKeys(rulesContent: string, matchBlockName: string): string[] {
  const blockRegex = new RegExp(`match\\s+/${matchBlockName}/{[a-zA-Z0-9]+}\\s*{([\\s\\S]*?)(?=match\\s+|}$)`, 'g');
  const match = blockRegex.exec(rulesContent);
  if (!match) return [];

  const blockContent = match[1];
  const keysRegex = /affectedKeys\(\[([\s\S]*?)\]\)/g;
  const keysMatch = keysRegex.exec(blockContent);
  if (!keysMatch) return [];

  return keysMatch[1]
    .split(',')
    .map(k => k.trim().replace(/['"]/g, ''))
    .filter(Boolean);
}

describe('Schema Drift & Index Consistency Structural Automated Guard', () => {
  test('workspaces rule allowlist strictly matches Workspace interface fields with no unexpected extras', () => {
    const keys = extractAffectedKeys(rulesText, 'workspaces');
    assert.ok(keys.length > 0, 'Should find affectedKeys for workspaces in firestore.rules');

    const expectedWorkspaceKeys = [
      'id', 'uid', 'name', 'businessType', 'type', 'description', 'createdAt', 'updatedAt',
      'lockDate', 'lockedUntilDate', 'strategicAdvice', 'analyticalTopology', 'currency',
      'defaultAccountMappings', 'isDemoLoaded', 'dateFormat', 'aiModel', 'matchingThreshold',
      'notifications', 'plan', 'billingCycle', 'concurrentUserLimit', 'activeUserCount',
      'maxSeats', 'seatCount', 'totalQueriesThisMonth', 'computeHardnessScore',
      'billingLedgerChain', 'apiQuotaTotalCentsUsed', 'apiQuotaMonthlyLimitCents',
      'computeCreditBalance', 'dimensions', 'allowedWorldPaths',
      'bypassBilling', 'stripeCustomerId', 'stripeSubscriptionId', 'status', 'adminCount', 'admins', 'roles', 'members'
    ];

    for (const key of expectedWorkspaceKeys) {
      assert.ok(
        keys.includes(key),
        `firestore.rules workspaces allowlist missing key '${key}'`
      );
    }

    const extra = keys.filter(k => !expectedWorkspaceKeys.includes(k));
    assert.equal(extra.length, 0, `workspaces rules permit fields absent from expected model: ${extra.join(', ')}`);
  });

  test('transactions collection is locked down from direct client-side writes in firestore.rules', () => {
    // Transactions are managed exclusively by server APIs / Admin SDK to enforce double-entry integrity
    const blockRegex = /match\s+\/transactions\/\{transactionId\}\s*\{([\s\S]*?)(?=match\s+|$)/;
    const match = blockRegex.exec(rulesText);
    assert.ok(match, 'Should find transactions block in firestore.rules');
    const blockContent = match[1];
    assert.ok(
      blockContent.includes('allow create, update, delete: if false;') || 
      blockContent.includes('allow write: if false;') ||
      blockContent.includes('canWrite('),
      'Transactions collection must disallow direct client-side writes or require canWrite role permissions'
    );
  });

  test('supportTickets rule allowlist strictly matches SupportTicket interface fields', () => {
    const keys = extractAffectedKeys(rulesText, 'supportTickets');
    assert.ok(keys.length > 0, 'Should find affectedKeys for supportTickets in firestore.rules');

    const expectedSupportTicketKeys = [
      'id', 'workspaceId', 'uid', 'subject', 'status', 'priority', 'createdAt', 'updatedAt',
      'lastMessageAt', 'lastMessageBy', 'unreadForUser', 'unreadForAdmin'
    ];

    for (const key of expectedSupportTicketKeys) {
      assert.ok(keys.includes(key), `firestore.rules supportTickets missing key '${key}'`);
    }
  });

  test('supportMessages rule allowlist strictly matches SupportMessage interface fields', () => {
    const keys = extractAffectedKeys(rulesText, 'supportMessages');
    assert.ok(keys.length > 0, 'Should find affectedKeys for supportMessages in firestore.rules');

    const expectedSupportMessageKeys = [
      'id', 'ticketId', 'workspaceId', 'authorUid', 'authorRole', 'body', 'createdAt'
    ];

    for (const key of expectedSupportMessageKeys) {
      assert.ok(keys.includes(key), `firestore.rules supportMessages missing key '${key}'`);
    }
  });

  test('chartAccounts rule allowlist includes isActive field', () => {
    const keys = extractAffectedKeys(rulesText, 'chartAccounts');
    assert.ok(keys.length > 0, 'Should find affectedKeys for chartAccounts in firestore.rules');
    assert.ok(keys.includes('isActive'), 'firestore.rules chartAccounts allowlist missing key "isActive"');
  });

  test('firestore.indexes.json includes composite indexes for workspaceId + order field queries', () => {
    const requiredIndexes = [
      { collectionGroup: 'transactions', field: 'date' },
      { collectionGroup: 'invoices', field: 'date' },
      { collectionGroup: 'bills', field: 'date' },
      { collectionGroup: 'bankLines', field: 'date' },
      { collectionGroup: 'auditLogs', field: 'timestamp' },
      { collectionGroup: 'supportTickets', field: 'lastMessageAt' }
    ];

    for (const req of requiredIndexes) {
      const matchFound = indexesJson.indexes.some((idx: any) => {
        return (
          idx.collectionGroup === req.collectionGroup &&
          idx.fields.length === 2 &&
          (idx.fields[0].fieldPath === 'workspaceId' || idx.fields[0].fieldPath === 'status') &&
          idx.fields[0].order === 'ASCENDING' &&
          idx.fields[1].fieldPath === req.field &&
          idx.fields[1].order === 'DESCENDING'
        );
      });

      assert.ok(
        matchFound,
        `firestore.indexes.json missing composite index for ${req.collectionGroup} (workspaceId ASC, ${req.field} DESC)`
      );
    }
  });
});
