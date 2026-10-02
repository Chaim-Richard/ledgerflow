/** Dates on screen follow the user's choice in Preferences (I-12); inputs and files stay YYYY-MM-DD. */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { DATE_DISPLAY_FORMATS, formatDate, setDateDisplayFormat } from '../lib/utils';

describe('Date display', () => {
  test('each choice', () => {
    assert.equal(formatDate('2026-03-07', 'MMM DD, YYYY'), 'Mar 07, 2026');
    assert.equal(formatDate('2026-03-07', 'YYYY-MM-DD'), '2026-03-07');
    assert.equal(formatDate('2026-03-07', 'MM/DD/YYYY'), '03/07/2026');
    assert.equal(formatDate('2026-03-07', 'DD/MM/YYYY'), '07/03/2026');
    assert.equal(DATE_DISPLAY_FORMATS.length, 4);
  });

  test('the saved choice applies everywhere; nothing or nonsense shows nothing or the text', () => {
    setDateDisplayFormat('DD/MM/YYYY');
    assert.equal(formatDate('2026-12-31'), '31/12/2026');
    setDateDisplayFormat('nonsense');
    assert.equal(formatDate('2026-12-31'), 'Dec 31, 2026');
    assert.equal(formatDate(undefined), '');
    assert.equal(formatDate('not a date'), 'not a date');
  });

  test('a calendar date is the same day in every time zone (no UTC shift)', () => {
    setDateDisplayFormat('YYYY-MM-DD');
    assert.equal(formatDate('2026-01-01'), '2026-01-01');
  });
});
