import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approvalRows, approvalRuleRows, auditEntriesInPeriod, auditLogRows, buildAuditEvidencePack, evidenceDay,
  evidencePackFileName, inEvidencePeriod, periodLockRows, type AuditEvidenceInput,
} from './auditEvidencePack';
import { accessReviewCsvRows, accessReviewRows } from './accessReview';

const local = (month: number, day: number, hour = 12) => new Date(2026, month - 1, day, hour, 0, 0).toISOString();
const period = { from: '2026-10-01', to: '2026-10-31' };

const accessRows = accessReviewRows({
  ownerUid: 'u-owner', members: ['u-acct'], roles: { 'u-acct': 'accountant' }, requireTwoStep: false,
  auditLogs: [{ action: 'USER_LOGIN', uid: 'u-owner', userEmail: 'owner@example.test', timestamp: local(10, 2) }],
  selfUid: 'u-owner', selfTwoStep: true,
});

function pack(overrides: Partial<AuditEvidenceInput> = {}) {
  const input: AuditEvidenceInput = {
    workspace: {
      id: 'ws-1', name: 'Acme Books', lockDate: '2026-09-30', softLockDate: '2026-10-15',
      lockException: { from: '2026-09-01', to: '2026-09-07', reason: 'Late bills', by: 'owner@example.test' },
      requireTwoStep: false, twoPersonRule: true, payrollApproval: true,
      invoiceApproval: { enabled: true, thresholdCents: 150000 },
    },
    period,
    generatedAt: '2026-11-01T09:00:00.000Z',
    auditLogs: [
      { action: 'USER_LOGIN', uid: 'u-owner', userEmail: 'owner@example.test', timestamp: local(10, 2, 9) },
      { action: 'ROLE_CHANGE', uid: 'u-owner', userEmail: 'owner@example.test', entityType: 'workspace', entityId: 'ws-1', timestamp: local(10, 3), details: { targetUid: 'u-acct', beforeRole: 'viewer', afterRole: 'accountant', description: 'User u-acct role updated' } },
      { action: 'PERIOD_CLOSED', uid: 'u-owner', userEmail: 'owner@example.test', entityType: 'periods', entityId: '2026-09', timestamp: local(10, 4), details: { month: '2026-09', description: 'Hard-closed 2026-09 (through 2026-09-30)' } },
      { action: 'USER_LOGIN', uid: 'u-acct', userEmail: 'acct@example.test', timestamp: local(9, 30, 9) }, // before the period
    ],
    invoices: [
      { id: 'inv-1', number: 'INV-1001', date: '2026-10-06', amountCents: 200000, status: 'sent', approval: { state: 'approved', thresholdCents: 150000, requestedAt: local(10, 6), requestedBy: 'book@example.test', decidedAt: local(10, 7), decidedBy: 'owner@example.test' } },
      { id: 'inv-2', number: 'INV-1002', date: '2026-11-02', amountCents: 160000, status: 'sent', approval: { state: 'awaiting', thresholdCents: 150000, requestedAt: local(11, 2) } },
      { id: 'inv-3', number: 'INV-1003', date: '2026-10-08', amountCents: 1000, status: 'sent' },
    ],
    payRuns: [
      { id: 'run-1', date: '2026-10-25', totalAmountCents: 500000, status: 'processed', submittedByEmail: 'book@example.test', approvedByEmail: 'owner@example.test', approvedAt: local(10, 25, 10), createdAt: local(10, 24) },
      { id: 'run-2', date: '2026-11-25', totalAmountCents: 510000, status: 'awaiting_approval', createdAt: local(11, 24) },
    ],
    accessRows,
    ...overrides,
  };
  return { input, files: buildAuditEvidencePack(input) };
}

test('the pack is one README and one CSV per evidence set, in a fixed order', () => {
  const { files } = pack();
  assert.deepEqual(files.map(file => file.name), ['README.txt', 'audit-log.csv', 'period-locks.csv', 'approvals.csv', 'approval-rules.csv', 'access-review.csv']);
  for (const file of files.filter(file => file.name !== 'README.txt')) {
    // the app's one CSV writer quotes every cell, so a name with a comma or a quote stays in its cell
    assert.equal(file.text.split('\r\n')[0], file.headers.map(header => `"${header}"`).join(','));
    assert.equal(file.text.split('\r\n').length, file.rows.length + 1);
  }
  assert.match(files[0].text, /Acme Books/);
  assert.match(files[0].text, /Period: 2026-10-01 to 2026-10-31/);
  assert.match(files[0].text, /newest 500 entries/);
  assert.match(files[0].text, /not an audit opinion/);
});

test('the audit file holds only entries inside the period, newest first, with their person and description', () => {
  const { input } = pack();
  const rows = auditLogRows(input.auditLogs, period);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(row => row[1]), ['PERIOD_CLOSED', 'ROLE_CHANGE', 'USER_LOGIN']);
  assert.equal(rows[2][3], 'owner@example.test');
  assert.equal(rows[0][6], 'Hard-closed 2026-09 (through 2026-09-30)');
  assert.equal(auditEntriesInPeriod(input.auditLogs, { from: '2026-09-01', to: '2026-09-30' }).length, 1);
  assert.equal(inEvidencePeriod(null, period), false);
  assert.equal(inEvidencePeriod(new Date(local(10, 31, 23)), period), true);
  assert.equal(inEvidencePeriod(new Date(local(11, 1, 0)), period), false);
});

test('the lock file states the rule in force and lists the period events inside the period', () => {
  const { input } = pack();
  const rows = periodLockRows(input.workspace, input.auditLogs, period);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], ['', 'Current lock date', '2026-09-30', 'Nothing on or before this date changes without an owner or accountant overriding the lock.', '']);
  assert.equal(rows[1][1], 'Current soft close');
  assert.deepEqual(rows[2].slice(1, 3), ['Open partial unlock', '2026-09-01 to 2026-09-07']);
  assert.equal(rows[2][4], 'owner@example.test');
  assert.deepEqual(rows[3].slice(1, 4), ['Period event', '2026-09', 'Hard-closed 2026-09 (through 2026-09-30)']);
  // no lock and no exception reads as "none", not as a blank that could mean anything
  const bare = periodLockRows({ id: 'ws-2' }, [], period);
  assert.deepEqual(bare.map(row => row[3]), ['No hard lock is set.', 'No soft close is set.', 'None.']);
});

test('the approvals file holds the invoice and pay-run decisions of the period and nothing outside it', () => {
  const { input } = pack();
  const rows = approvalRows(input.invoices, input.payRuns, period);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row[1]), ['Invoice approval', 'Pay run approval']);
  const invoice = rows.find(row => row[1] === 'Invoice approval')!;
  assert.deepEqual(invoice.slice(2, 4), ['INV-1001', 'inv-1']);
  assert.equal(invoice[4], '2000.00');
  assert.equal(invoice[5], 'approved');
  assert.equal(invoice[7], 'owner@example.test');
  const run = rows.find(row => row[1] === 'Pay run approval')!;
  assert.equal(run[4], '5000.00');
  assert.equal(run[6], 'book@example.test');
  assert.equal(run[7], 'owner@example.test');

  const rules = approvalRuleRows(input.workspace);
  assert.deepEqual(rules.map(row => [row[0], row[1], row[2]]), [['Invoice approval', 'On', '1500.00'], ['Two-person rule', 'On', ''], ['Pay run approval', 'On', '']]);
  assert.match(rules[0][3], /waits for an owner or an accountant/);
  const relaxed = approvalRuleRows({ id: 'ws-3', invoiceApproval: { enabled: false, thresholdCents: 150000 } });
  assert.deepEqual(relaxed.map(row => [row[1], row[2]]), [['Off', ''], ['Off', ''], ['Off', '']]);
});

test('the access review file is the panel’s own CSV, row for row', () => {
  const { files } = pack();
  const file = files.find(file => file.name === 'access-review.csv')!;
  assert.deepEqual(file.rows, accessReviewCsvRows(accessRows));
  assert.deepEqual(file.rows.map(row => row[0]), ['u-owner', 'u-acct']);
  assert.equal(file.rows[0][2], 'Owner');
});

test('a capped audit trail and an unreadable two-step status are said in the README, not hidden', () => {
  const { files } = pack({ auditCapped: true });
  assert.match(files[0].text, /more entries than that, so older entries are not in this pack/);
  const required = pack({ workspace: { id: 'ws-4', requireTwoStep: true } });
  assert.match(required.files[0].text, /refuses a password-only session/);
});

test('the download name is a safe file name and the period is validated', () => {
  assert.equal(evidencePackFileName({ name: 'Acme Books & Co.', id: 'ws-1' }, period), 'Acme-Books-Co-audit-evidence-2026-10-01-to-2026-10-31.zip');
  assert.equal(evidencePackFileName({ name: 'דוח ביקורת', id: 'ws-1' }, period), 'דוח-ביקורת-audit-evidence-2026-10-01-to-2026-10-31.zip');
  assert.equal(evidencePackFileName({ name: '   ', id: 'ws-9' }, period), 'ws-9-audit-evidence-2026-10-01-to-2026-10-31.zip');
  assert.equal(evidenceDay('2026-10-01'), '2026-10-01');
  assert.equal(evidenceDay('2026-13-01'), null); // shaped like a day but not one
  assert.equal(evidenceDay('2026-10-1'), null);
  assert.equal(evidenceDay(''), null);
  assert.equal(evidenceDay(undefined), null);
});
