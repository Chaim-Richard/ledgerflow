/**
 * Warranty, insurance and service reminders for fixed assets (X-08, X-06). An asset can carry the day
 * its warranty ends, the day its insurance renews and the day its next service is due; from 30 days
 * before (and on the day) the people who keep the books are told once for each date in the bell, and
 * the register says how many days are left. Disposed assets are left out. Pure: the nightly job and
 * the register both use it.
 */
export type AssetReminderKind = 'warranty' | 'insurance' | 'service';
export const REMINDER_DAYS = 30;

export interface AssetReminder { kind: AssetReminderKind; date: string; daysLeft: number }

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Days since 1970-01-01 for a calendar day (no clock or time zone involved). */
const dayNumber = (d: string) => {
  const m = YMD.exec(d);
  if (!m) return null;
  let y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  y -= month <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
};

export function assetRemindersDue(
  asset: { status?: string; warrantyExpires?: string; insuranceRenews?: string; nextServiceDue?: string },
  today: string,
  days = REMINDER_DAYS,
): AssetReminder[] {
  if (asset.status === 'disposed') return [];
  const now = dayNumber(today);
  if (now === null) return [];
  const due: AssetReminder[] = [];
  for (const [kind, date] of [['warranty', asset.warrantyExpires], ['insurance', asset.insuranceRenews], ['service', asset.nextServiceDue]] as const) {
    const at = date ? dayNumber(String(date).slice(0, 10)) : null;
    if (at === null) continue;
    const daysLeft = at - now;
    if (daysLeft >= 0 && daysLeft <= days) due.push({ kind, date: String(date).slice(0, 10), daysLeft });
  }
  return due;
}

export function reminderText(name: string, r: AssetReminder): string {
  const when = r.daysLeft === 0 ? 'today' : r.daysLeft === 1 ? 'tomorrow' : `in ${r.daysLeft} days (${r.date})`;
  return r.kind === 'warranty' ? `The warranty on ${name} ends ${when}` : r.kind === 'insurance' ? `The insurance on ${name} renews ${when}` : `${name} is due for its service ${when}`;
}
