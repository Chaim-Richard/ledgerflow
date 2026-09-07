import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readFileSync } from 'node:fs';

const rulesText = readFileSync('firestore.rules', 'utf8');

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

describe('Schema Drift Structural Automated Guard', () => {
  test('workspaces rule allowlist includes all Workspace interface fields', () => {
    const keys = extractAffectedKeys(rulesText, 'workspaces');
    assert.ok(keys.length > 0, 'Should find affectedKeys for workspaces in firestore.rules');

    const expectedWorkspaceKeys = [
      'id', 'uid', 'name', 'businessType', 'type', 'description', 'createdAt', 'updatedAt',
      'lockDate', 'lockedUntilDate', 'strategicAdvice', 'analyticalTopology', 'currency',
      'defaultAccountMappings', 'isDemoLoaded', 'dateFormat', 'aiModel', 'matchingThreshold',
      'notifications', 'plan', 'billingCycle', 'concurrentUserLimit', 'activeUserCount',
      'maxSeats', 'seatCount', 'totalQueriesThisMonth', 'computeHardnessScore',
      'billingLedgerChain', 'apiQuotaTotalCentsUsed', 'apiQuotaMonthlyLimitCents',
      'computeCreditBalance', 'dimensions', 'dimensionNodes', 'allowedWorldPaths',
      'bypassBilling', 'stripeCustomerId', 'stripeSubscriptionId', 'status', 'adminCount', 'admins', 'members'
    ];

    for (const key of expectedWorkspaceKeys) {
      assert.ok(
        keys.includes(key),
        `firestore.rules workspaces allowlist missing key '${key}'`
      );
    }
  });

  test('transactions rule allowlist includes all Transaction interface fields', () => {
    const keys = extractAffectedKeys(rulesText, 'transactions');
    assert.ok(keys.length > 0, 'Should find affectedKeys for transactions in firestore.rules');

    const expectedTransactionKeys = [
      'id', 'uid', 'workspaceId', 'date', 'dueDate', 'description', 'payee', 'lines',
      'totalAmountCents', 'taxAmountCents', 'currency', 'originalCurrency', 'exchangeRate',
      'schemaVersion', 'fileUrls', 'isCleared', 'clearedAt', 'bankTransactionId', 'units',
      'unitType', 'status', 'type', 'total_impact', 'projectId', 'classId', 'locationId',
      'employeeId', 'tags', 'metadata', 'verification', 'notes', 'attachments', 'referenceNumber',
      'category', 'recurringRuleId', 'bankFeedLineId', 'paymentToken', 'certifiedAt',
      'certifiedBy', 'voidedAt', 'voidedBy', 'deletedAt', 'entityId', 'customerId',
      'vendorId', 'reconciliationId', 'createdAt', 'updatedAt', 'parentEventId',
      'eventId', 'reversalEventId', 'project', 'dimensions', 'isIntercompany',
      'isFlagged', 'isLocked', 'lockedAt'
    ];

    for (const key of expectedTransactionKeys) {
      assert.ok(
        keys.includes(key),
        `firestore.rules transactions allowlist missing key '${key}'`
      );
    }
  });
});
