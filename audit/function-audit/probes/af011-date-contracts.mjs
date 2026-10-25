/**
 * AF-011 (#342) reproduction: the civil-date contract of formatDate/parseLocalDate when the
 * workspace's time zone differs from the device's.
 *
 * Run from the repository root:   TZ=UTC npx tsx audit/function-audit/probes/af011-date-contracts.mjs
 * (TZ is the device zone; pass another zone, e.g. TZ=America/New_York, to see the matrix change).
 *
 * Expected: a stored civil date (YYYY-MM-DD) reads back unchanged on every screen.
 * Observed at 50ee1205: it reads one day earlier whenever the workspace zone is ahead of the
 * device zone, and parseLocalDate's year is the previous year at a January 1 boundary.
 */
import { useAuthStore } from '../../../src/stores/useAuthStore';
import { formatDate, parseLocalDate } from '../../../src/lib/utils';

const zones = ['Pacific/Auckland', 'Asia/Jerusalem', 'Asia/Tokyo', 'UTC', 'America/New_York', 'America/Los_Angeles'];
const device = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log(`device zone: ${device}`);
for (const timezone of zones) {
  useAuthStore.setState({ currentWorkspaceId: 'w', workspaces: [{ id: 'w', timezone }] });
  const shown = formatDate('2026-01-01', 'YYYY-MM-DD');
  const midnight = parseLocalDate('2026-01-01');
  console.log(
    `workspace ${timezone.padEnd(20)} -> shown ${shown}  instant ${midnight.toISOString()}  getFullYear ${midnight.getFullYear()}` +
      (shown === '2026-01-01' && midnight.getFullYear() === 2026 ? '' : '   <-- SHIFTED'),
  );
}
