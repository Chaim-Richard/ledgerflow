/**
 * A-179: who logged time on which project this month. Hand-checked: October 2026 entries only;
 * billable and waiting-for-approval minutes are subsets of the person's minutes, never additions
 * to them; an entry with no project is "No project recorded"; September does not leak in.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { timeByPersonProject, timeByProjectCsvRows } from '../lib/timeByPersonProject';

const entry = (over: Record<string, unknown>) => ({
  id: 'e', kind: 'timeEntry', workspaceId: 'w1', person: 'Noa Levi', date: '2026-10-03',
  minutes: 60, description: 'work', billable: true, status: 'approved', createdAt: '2026-10-03T10:00:00Z',
  ...over,
});
const entries = [
  entry({ id: 'e1', projectId: 'p1', minutes: 120 }),
  entry({ id: 'e2', projectId: 'p1', minutes: 90, status: 'submitted' }),
  entry({ id: 'e3', projectId: 'p2', minutes: 45, billable: false, status: 'open' }),
  entry({ id: 'e4', minutes: 30, status: 'invoiced' }),
  entry({ id: 'e5', person: 'Omar Haddad', projectId: 'p1', minutes: 600 }),
  entry({ id: 'e6', projectId: 'p1', minutes: 5_000, date: '2026-09-30' }),
];
const projects = [{ id: 'p1', name: 'Website rebuild' }, { id: 'p2', name: 'Office move' }];
const { rows, people } = timeByPersonProject({ entries: entries as never, projects, month: '2026-10' });

test('minutes are grouped by person and project for the month, by hand', () => {
  const danaWebsite = rows.find(r => r.person === 'Noa Levi' && r.projectId === 'p1')!;
  assert.ok(danaWebsite);
  assert.equal(danaWebsite.minutes, 210);
  assert.equal(danaWebsite.billableMinutes, 210);
  assert.equal(danaWebsite.waitingMinutes, 90, 'the submitted entry is still waiting');
  assert.equal(danaWebsite.entries, 2);
  const danaOffice = rows.find(r => r.person === 'Noa Levi' && r.projectId === 'p2')!;
  assert.equal(danaOffice.billableMinutes, 0);
  const danaNone = rows.find(r => r.person === 'Noa Levi' && r.projectId === '')!;
  assert.equal(danaNone.projectName, 'No project recorded');
  assert.equal(rows.some(r => r.minutes === 5_000), false, 'September is another month');
});

test('the people totals add back to the rows and the CSV carries the same minutes', () => {
  const Dana = people.find(p => p.person === 'Noa Levi')!;
  assert.equal(Dana.minutes, 285);
  assert.equal(people[0].person, 'Omar Haddad', 'most time first');
  assert.equal(people[0].minutes, 600);
  const csv = timeByProjectCsvRows(rows);
  const danaWebsite = csv.find(r => r[0] === 'Noa Levi' && r[1] === 'Website rebuild')!;
  assert.deepEqual(danaWebsite.slice(2), [210, 3.5, 210, 90, 2]);
  assert.deepEqual(timeByPersonProject({ entries: entries as never, projects, month: 'Oct' }).rows, [], 'a broken month gives nothing');
});
