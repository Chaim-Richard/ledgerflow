/**
 * The daily run, as the Settings → Schedule screen tells it (BB-06): which jobs are promised, whether
 * the last run covered them, and what the screen says when the record is old, missing, or silent about
 * a job. The two lists that must never drift apart — the jobs the cron route runs, and the jobs the
 * screen describes — are checked against each other here.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DAILY_JOBS, DAILY_LATE_HOURS, DAILY_RUN_AT_UTC, describeSchedule, nextDailyRunAt } from '../lib/jobSchedule';
import { readSchedule } from '../server/routes/scheduleRoutes';
import { jobsFor } from '../server/jobs/jobRegistry';
import type { Firestore } from '../server/db/firestore';

const root = path.resolve(import.meta.dirname, '../..');
/** what a run answers when every job went through */
const results = Object.fromEntries(DAILY_JOBS.map(j => [j.id, 'ok']));
const at = (iso: string) => new Date(iso);

describe('the two lists are the same list', () => {
  test('every job the cron route runs is described, and nothing is described that it does not run', () => {
    const running = jobsFor('daily').map(j => j.id);
    assert.ok(running.length >= 5, `the daily jobs were not read (${running.length})`);
    assert.deepEqual(DAILY_JOBS.map(j => j.id), running, 'the screen describes exactly what runs, in the order it runs');
  });

  test('every job says what it does, in a sentence, and has a name to show', () => {
    for (const job of DAILY_JOBS) {
      assert.ok(job.name.length > 3 && /^[A-Z]/.test(job.name), `${job.id}: a name a person reads`);
      assert.ok(job.what.length > 30 && /\.$/.test(job.what), `${job.id}: what it does, ending in a full stop`);
      assert.doesNotMatch(job.what, /\bAPI\b|\bendpoint\b|\bcron\b|\bfire\b/i, `${job.id}: not a description for a programmer`);
    }
  });

  test('the screen promises the time the installation actually runs it at', () => {
    const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')) as { crons: { path: string; schedule: string }[] };
    const daily = vercel.crons.find(c => c.path.split('/').slice(-2).join('/') === 'cron/daily');
    assert.ok(daily, 'the daily cron is scheduled in vercel.json');
    const [minute, hour] = daily!.schedule.split(' ').map(Number);
    assert.deepEqual([DAILY_RUN_AT_UTC.hour, DAILY_RUN_AT_UTC.minute], [hour, minute], 'the time shown as "due" is the time it is set for');
  });
});

describe('what the screen says about the last run', () => {
  test('the installation has no cron secret: nothing runs on its own, and it says so', () => {
    const view = describeSchedule({ run: null, cronConfigured: false, now: at('2026-10-05T09:00:00Z') });
    assert.equal(view.state, 'not_configured');
    assert.match(view.headline, /Nothing runs on its own/);
    assert.match(view.detail, /CRON_SECRET/);
    assert.ok(view.jobs.every(j => j.outcome === 'unknown' && /No run recorded/.test(j.detail)));
  });

  test('no run yet: the first one is due at the scheduled time', () => {
    const view = describeSchedule({ run: null, cronConfigured: true, now: at('2026-10-05T03:00:00Z') });
    assert.equal(view.state, 'never');
    assert.match(view.headline, /No run has been recorded/);
    assert.match(view.detail, /first one is due at 06:10/);
    assert.equal(view.ranAt, null);
  });

  test('a run an hour ago that said every job was fine: it is doing its work', () => {
    const view = describeSchedule({
      run: { finishedAt: '2026-10-05T06:11:00Z', status: 'ok', failedJobs: [], results },
      cronConfigured: true, now: at('2026-10-05T07:30:00Z'),
    });
    assert.equal(view.state, 'ok');
    assert.match(view.headline, /doing its work/);
    assert.match(view.detail, /Last ran 1 hour ago/);
    assert.equal(view.hoursSince, 1);
    assert.ok(view.jobs.every(j => j.outcome === 'ok' && j.detail === ''), 'each job answers for itself');
  });

  test('a job that went wrong is named, with what it said', () => {
    const view = describeSchedule({
      run: {
        finishedAt: '2026-10-05T06:20:00Z', status: 'failed', failedJobs: ['reminders'],
        results: { ...results, reminders: 'failed: the mail service refused every address' },
      },
      cronConfigured: true, now: at('2026-10-05T08:00:00Z'),
    });
    assert.equal(view.state, 'failed');
    assert.match(view.headline, /had problems: Invoice reminders\./, 'the job is named as the person sees it');
    const reminders = view.jobs.find(j => j.id === 'reminders')!;
    assert.equal(reminders.outcome, 'failed');
    assert.equal(reminders.detail, 'the mail service refused every address', 'the prefix is dropped, the words are kept');
    assert.equal(view.jobs.find(j => j.id === 'statements')!.outcome, 'ok', 'the job next to it is not blamed for it');
  });

  test('an older row that only kept the failures does not read as a clean bill of health', () => {
    const view = describeSchedule({ run: { finishedAt: '2026-10-05T06:11:00Z', status: 'ok', failedJobs: [] }, cronConfigured: true, now: at('2026-10-05T07:00:00Z') });
    assert.equal(view.state, 'ok');
    assert.ok(view.jobs.every(j => j.outcome === 'unknown' && /did not say what it did/.test(j.detail)), 'it says the run was silent, not that all was well');
  });

  test('two days without a run is late, and says which stopped', () => {
    const view = describeSchedule({ run: { finishedAt: '2026-10-03T06:11:00Z', status: 'ok', failedJobs: [], results }, cronConfigured: true, now: at('2026-10-05T09:00:00Z') });
    assert.equal(view.state, 'late');
    assert.ok(view.hoursSince !== null && view.hoursSince > DAILY_LATE_HOURS);
    assert.match(view.headline, /did not happen when it was due \(every day at 06:10 UTC\)/);
    assert.match(view.headline, /the schedule that stopped, not a job/);
  });

  test('a late run that did have failures says so instead', () => {
    const view = describeSchedule({ run: { finishedAt: '2026-10-03T06:11:00Z', status: 'failed', failedJobs: ['statements'], results: { ...results, statements: 'failed: no mail server' } }, cronConfigured: true, now: at('2026-10-05T09:00:00Z') });
    assert.equal(view.state, 'failed', 'what went wrong outranks that it is late');
    assert.match(view.detail, /2 days ago/);
  });
});

describe('when it is next due', () => {
  test('before the time: today; after it: tomorrow', () => {
    assert.equal(nextDailyRunAt(at('2026-10-05T03:00:00Z')), '2026-10-05T06:10:00.000Z');
    assert.equal(nextDailyRunAt(at('2026-10-05T06:09:59Z')), '2026-10-05T06:10:00.000Z');
    assert.equal(nextDailyRunAt(at('2026-10-05T06:10:00Z')), '2026-10-06T06:10:00.000Z', 'at the minute it counts as past');
    assert.equal(nextDailyRunAt(at('2026-10-05T23:00:00Z')), '2026-10-06T06:10:00.000Z');
  });

  test('across a month end and a leap day', () => {
    assert.equal(nextDailyRunAt(at('2026-12-31T09:00:00Z')), '2027-01-01T06:10:00.000Z');
    assert.equal(nextDailyRunAt(at('2028-02-28T09:00:00Z')), '2028-02-29T06:10:00.000Z');
  });
});

describe('the record is read from where the run leaves it', () => {
  const dbWith = (row?: Record<string, unknown>) => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          assert.equal(name, 'jobRuns');
          assert.equal(id, 'daily_latest');
          return { data: () => row };
        },
      }),
    }),
  }) as unknown as Firestore;

  test('the row the daily run wrote, in the screen’s words', async () => {
    const view = await readSchedule(dbWith({ finishedAt: '2026-10-05T06:11:00Z', status: 'ok', failedJobs: [], results }), at('2026-10-05T07:00:00Z'), true);
    assert.equal(view.state, 'ok');
    assert.equal(view.hoursSince, 0);
    assert.ok(view.jobs.some(j => j.id === 'maintenance' && j.outcome === 'ok'));
  });

  test('no row at all is not an error: it says nothing has been recorded', async () => {
    const view = await readSchedule(dbWith(), at('2026-10-05T07:00:00Z'), true);
    assert.equal(view.state, 'never');
  });

  test('a database that does not answer is said out loud, not turned into an empty schedule', async () => {
    const broken = { collection: () => ({ doc: () => ({ get: async () => { throw new Error('connection refused'); } }) }) } as unknown as Firestore;
    await assert.rejects(() => readSchedule(broken, at('2026-10-05T07:00:00Z'), true), /connection refused/);
  });
});
