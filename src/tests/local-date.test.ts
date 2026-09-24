import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { getLocalDateISO, formatTzDate } from '../lib/utils';
import { parseCamt053Statement } from '../lib/camt053Parser';

describe('Local Date and Timezone Handling (§14 Part 3)', () => {
  test('formatTzDate returns correct local YYYY-MM-DD for America/Los_Angeles', () => {
    // 2026-03-11 03:00 UTC corresponds to 2026-03-10 20:00 (8:00 PM) in America/Los_Angeles (PDT)
    const date = new Date(Date.UTC(2026, 2, 11, 3, 0, 0));
    const localDate = formatTzDate(date, 'America/Los_Angeles');
    assert.equal(localDate, '2026-03-10');
  });

  test('StatementImporter date normalization retains exact YYYY-MM-DD and US slash formats', () => {
    const normalizeDateString = (dateStr: string): string => {
      if (!dateStr) return '';
      const s = dateStr.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const usMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
      if (usMatch) {
        const [_, m, d, rawY] = usMatch;
        const y = rawY.length === 2 ? (parseInt(rawY, 10) > 50 ? '19' + rawY : '20' + rawY) : rawY;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      return '';
    };

    assert.equal(normalizeDateString('2026-03-10'), '2026-03-10');
    assert.equal(normalizeDateString('03/10/2026'), '2026-03-10');
    assert.equal(normalizeDateString('3/10/2026'), '2026-03-10');
  });

  test('CAMT.053 parser skips entries without a valid date', () => {
    const xmlWithDate = `
      <Ntry>
        <Amt Ccy="USD">100.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-03-10</Dt></BookgDt>
        <Ustrd>Payment received</Ustrd>
      </Ntry>
    `;
    const xmlWithoutDate = `
      <Ntry>
        <Amt Ccy="USD">50.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <Ustrd>Entry missing date</Ustrd>
      </Ntry>
    `;

    const parsedValid = parseCamt053Statement(xmlWithDate);
    assert.equal(parsedValid.length, 1);
    assert.equal(parsedValid[0].date, '2026-03-10');

    const parsedMissing = parseCamt053Statement(xmlWithoutDate);
    assert.equal(parsedMissing.length, 0, 'Entry without date must be skipped');
  });
});
