/** D-65: seeded civil-calendar properties; device and workspace zones deliberately disagree. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { addToDateISO, calendarDateISO, monthBoundsISO } from '../lib/utils';
import { getFiscalYearBounds, getFiscalQuarter } from '../lib/fiscalCalendar';
import { useAuthStore } from '../stores/useAuthStore';
import type { Workspace } from '../types';

const ZONES = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Asia/Jerusalem', 'Pacific/Auckland', 'Pacific/Kiritimati'];
// UTC oracle is used only to enumerate Gregorian dates, never to interpret a device-local Date.
const epoch = Date.parse('2000-01-01T00:00:00Z');
const civil = fc.integer({ min: 0, max: 36889 }).map(offset => new Date(epoch + offset * 86400000).toISOString().slice(0, 10));
const deviceDate = (day: string) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d); };
const shiftOracle = (day: string, delta: number) => new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86400000).toISOString().slice(0, 10);

for (const zone of ZONES) {
  test(`D-65 civil dates remain stable on device ${zone} with a different workspace zone`, () => {
    const oldTZ = process.env.TZ;
    const auth = useAuthStore.getState();
    try {
      process.env.TZ = zone;
      useAuthStore.setState({ currentWorkspaceId: 'civil-properties', workspaces: [{ id: 'civil-properties', timezone: zone === 'Pacific/Auckland' ? 'America/Los_Angeles' : 'Pacific/Auckland' } as Workspace] });
      fc.assert(fc.property(civil, fc.integer({ min: -800, max: 800 }), (day, delta) => {
        assert.equal(calendarDateISO(deviceDate(day)), day, 'device-built picker date must not use workspace instant conversion');
        assert.equal(addToDateISO(day, { days: delta }), shiftOracle(day, delta));
        assert.equal(addToDateISO(addToDateISO(day, { days: delta }), { days: -delta }), day);
        const bounds = monthBoundsISO(day);
        assert.equal(bounds.start, `${day.slice(0, 7)}-01`);
        assert.ok(bounds.start <= day && day <= bounds.end);
        assert.equal(shiftOracle(bounds.end, 1).slice(8), '01', 'month end is immediately before next month');
      }), { seed: 650022, numRuns: 400 });
      // Explicitly pin leap-century and DST boundaries, independent of generated samples.
      for (const day of ['2000-02-29', '2024-02-29', '2026-03-08', '2026-03-27', '2026-04-05', '2026-09-27', '2026-10-25', '2026-11-01', '2100-02-28']) {
        assert.equal(calendarDateISO(deviceDate(day)), day);
        assert.equal(addToDateISO(day, { days: 1 }), shiftOracle(day, 1));
      }
      assert.equal(addToDateISO('2100-02-28', { days: 1 }), '2100-03-01');
      assert.equal(addToDateISO('2000-02-28', { days: 1 }), '2000-02-29');
      fc.assert(fc.property(civil, fc.integer({ min: 1, max: 12 }), (day, startMonth) => {
        const year = getFiscalYearBounds(day, startMonth, 1);
        const quarter = getFiscalQuarter(day, startMonth, 1);
        assert.ok(year.startDate <= day && day <= year.endDate);
        assert.ok(quarter.startDate <= day && day <= quarter.endDate);
        assert.ok(year.startDate <= quarter.startDate && quarter.endDate <= year.endDate);
        assert.equal(quarter.fiscalYear, year.fiscalYear);
        assert.equal(quarter.startDate.slice(8), '01');
      }), { seed: 650023, numRuns: 200 });
    } finally {
      if (oldTZ === undefined) delete process.env.TZ;
      else process.env.TZ = oldTZ;
      useAuthStore.setState(auth, true);
    }
  });
}
