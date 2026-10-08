/**
 * Learned patterns are saved under an id that never collides (N-14, TOOL_REVIEW F1): two Hebrew
 * descriptions of the same length used to become "____" and overwrite each other. Plain Latin text
 * keeps the id it always had, so existing patterns keep counting up; every id stays short enough for
 * the database; and both places that save patterns use the same rule.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { learnedPatternId } from '../lib/learnedPatterns';

test('Hebrew descriptions of the same length get different ids, the same text the same id', () => {
  assert.notEqual(learnedPatternId('שלום'), learnedPatternId('תודה'));
  assert.equal(learnedPatternId('שלום'), learnedPatternId('שלום'));
  assert.notEqual(learnedPatternId('קפה גרג'), learnedPatternId('קפה ארומה'));
  assert.notEqual(learnedPatternId('café'), learnedPatternId('cafe'), 'accents are text too');
});

test('plain Latin text keeps the id it had, so existing patterns keep counting', () => {
  assert.equal(learnedPatternId('joes coffee'), 'joes_coffee');
  assert.equal(learnedPatternId('amazon 2024'), 'amazon_2024');
});

test('ids stay short and safe for the database, however long the text', () => {
  for (const text of ['x'.repeat(500), 'ח'.repeat(400), 'mixed עברית and english '.repeat(20)]) {
    const id = learnedPatternId(text);
    assert.ok(id.length <= 80, `${id.length}`);
    assert.match(id, /^[a-z0-9_]+$/);
  }
  assert.notEqual(learnedPatternId('x'.repeat(500)), learnedPatternId('x'.repeat(501)), 'long texts that share a start still differ');
});

test('both places that save patterns use the rule, and nothing builds an id the old way', () => {
  for (const file of ['src/hooks/useEntityOperations.ts', 'src/hooks/transactionActions/postingHelpers.ts']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /learnedPatternId\(cleanDesc\)/, file);
    assert.doesNotMatch(source, /replace\(\/\[\^a-z0-9\]\/g, '_'\)/, file);
  }
});
