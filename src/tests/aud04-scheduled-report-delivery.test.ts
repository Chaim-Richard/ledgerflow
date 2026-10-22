/**
 * AUD-04: a scheduled report's period is claimed before it is sent, and each address is recorded as delivered or
 * failed (scheduledReportService.ts, jobRuns/report_<workspace>_<schedule>_<period>). On the local test database,
 * a monthly profit and loss for January 2031 to owner@ and acct@:
 *  - two daily runs at the same moment → each address gets January once (2 emails, not 4);
 *  - acct@'s provider refuses → owner@ delivered, acct@ failed, the period not finished; a run 30 minutes later
 *    sends nothing; a run 1 hour later sends to acct@ only, and the period is finished;
 *  - a run that claimed the period and stopped (a crash) → within the 15-minute lease nobody sends; after it, the
 *    next run sends to both, once;
 *  - an address refused at every attempt → tried 4 times (after 1, 4 and 24 hours), then given up, the period
 *    marked so it is not tried for ever;
 *  - each email carries the provider idempotency key of its period and address.
 */
import test, { after, before, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { Firestore } from '../server/db/pgFirestore';

const url = process.env.LF_TEST_DATABASE_URL;

describe('AUD-04 scheduled report delivery', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const run = crypto.randomBytes(4).toString('hex');
  let db: Firestore;
  let svc: typeof import('../server/services/scheduledReportService');
  let setTransport: (t: unknown) => void;
  const sent: Array<{ to: string; subject: string; idempotencyKey?: string }> = [];
  /** addresses the provider refuses */
  const refuse = new Set<string>();
  const schedule = { id: 'pl', report: 'profit-and-loss', frequency: 'monthly', recipients: ['owner@example.com', 'acct@example.com'] };
  const workspaces: string[] = [];
  let ws = '';
  const at = (iso: string) => new Date(iso);
  const mine = () => sent.filter(m => m.subject.endsWith(`· AUD04 ${ws}`));
  const record = async () => (await db.collection('jobRuns').doc(`report_${ws}_pl_M:2031-01`).get()).data() as Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** this workspace's part of the daily run (other test files' workspaces are left alone) */
  const runOwn = async (now: Date) => svc.runWorkspaceSchedules(db, ws, (await db.collection('workspaces').doc(ws).get()).data() as never, now);
  const marker = async () => (await db.collection('workspaces').doc(ws).get()).data()?.scheduledReportsSent?.pl;

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    svc = await import('../server/services/scheduledReportService');
    const mailer = await import('../server/services/mailer');
    setTransport = mailer.setMailTransportForTests as never;
    setTransport(async (m: { to: string; subject: string; idempotencyKey?: string }) => {
      if (refuse.has(m.to)) throw new Error(`mailbox ${m.to} refused`);
      sent.push(m);
      return { delivered: true, provider: 'test' };
    });
  });

  // a fresh workspace (and so a fresh September) for each case
  beforeEach(async () => {
    refuse.clear();
    ws = `ws_aud04_${run}_${workspaces.length}`;
    workspaces.push(ws);
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: `AUD04 ${ws}`, currency: 'USD', timezone: 'UTC', members: ['owner-1'], scheduledReports: [schedule] });
  });

  after(async () => {
    setTransport(null);
    for (const w of workspaces) {
      await db.pool.query('delete from public."jobRuns" where id like $1', [`report_${w}_%`]);
      await db.pool.query('delete from public."workspaces" where id = $1', [w]);
    }
    await db.terminate();
  });

  test('two daily runs at the same moment: each address gets January once', async () => {
    await Promise.all([runOwn(at('2031-02-04T08:00:00Z')), runOwn(at('2031-02-04T08:00:00Z'))]);
    assert.deepEqual(mine().map(m => m.to).sort(), ['acct@example.com', 'owner@example.com']);
    assert.equal((await record())?.status, 'sent');
    assert.equal(await marker(), 'M:2031-01');
  });

  test('one address refused: the other delivered; only the refused one is tried again, after an hour', async () => {
    refuse.add('acct@example.com');
    await runOwn(at('2031-02-04T08:00:00Z'));
    assert.deepEqual(mine().map(m => m.to), ['owner@example.com']);
    const first = await record();
    assert.deepEqual([first?.status, first?.recipients['owner@example.com'].status, first?.recipients['acct@example.com'].status], ['failed', 'delivered', 'failed']);
    assert.match(first?.recipients['acct@example.com'].error, /mailbox acct@example.com refused/);
    assert.equal(first?.nextAttemptAt, '2031-02-04T09:00:00.000Z');
    assert.equal(await marker(), undefined, 'the period is not finished');
    refuse.clear();
    await runOwn(at('2031-02-04T08:30:00Z'));
    assert.equal(mine().length, 1, 'not due again yet');
    await runOwn(at('2031-02-04T09:00:00Z'));
    assert.deepEqual(mine().map(m => m.to), ['owner@example.com', 'acct@example.com'], 'acct@ only, owner@ not again');
    assert.equal((await record())?.status, 'sent');
    assert.equal(await marker(), 'M:2031-01');
  });

  test('a run that claimed the period and stopped: nobody sends within the lease; after it, both once', async () => {
    const claim = await svc.claimDelivery(db, ws, 'pl', 'M:2031-01', at('2031-02-04T08:00:00Z'));
    assert.ok(claim, 'claimed, then the run "crashed" before sending');
    await runOwn(at('2031-02-04T08:10:00Z'));
    assert.equal(mine().length, 0, 'still leased to the stopped run');
    await runOwn(at('2031-02-04T08:16:00Z'));
    assert.deepEqual(mine().map(m => m.to).sort(), ['acct@example.com', 'owner@example.com']);
    assert.equal((await record())?.attempts, 2);
    // the stopped run comes back and tries to record: the sending was taken over, nothing changes
    assert.deepEqual(await svc.finishDelivery(db, { workspaceId: ws, scheduleId: 'pl', periodKey: 'M:2031-01', claimId: claim!.claimId, attempt: 1, recipients: schedule.recipients, result: { delivered: [], errors: {} }, now: at('2031-02-04T08:20:00Z') }), { status: 'taken-over' });
    assert.equal((await record())?.status, 'sent');
  });

  test('refused at every attempt: tried 4 times (after 1, 4, 24 hours), then given up and marked', async () => {
    refuse.add('acct@example.com');
    for (const time of ['2031-02-04T08:00:00Z', '2031-02-04T09:00:00Z', '2031-02-04T13:00:00Z', '2031-02-05T13:00:00Z']) {
      await runOwn(at(time));
    }
    const last = await record();
    assert.deepEqual([last?.status, last?.attempts], ['gave-up', 4]);
    assert.equal(await marker(), 'M:2031-01', 'not tried for ever');
    await runOwn(at('2031-02-07T13:00:00Z'));
    assert.deepEqual(mine().map(m => m.to), ['owner@example.com'], 'owner@ once, in the first run');
  });

  test('each email carries the idempotency key of its period and address', async () => {
    await runOwn(at('2031-02-04T08:00:00Z'));
    assert.deepEqual(mine().map(m => m.idempotencyKey).sort(), [`report_${ws}_pl_M:2031-01_acct@example.com`, `report_${ws}_pl_M:2031-01_owner@example.com`]);
  });
});
