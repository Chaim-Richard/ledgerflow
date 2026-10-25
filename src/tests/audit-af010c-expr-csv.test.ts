/**
 * Independent audit Pass A, slice 2 — untrusted-input parsers:
 * src/lib/amountExpression.ts (BigInt rational evaluator behind money fields) and
 * src/lib/csv.ts (RFC 4180 parser used by statement imports).
 * Expected figures worked by hand. Observed edge defects are locked and named.
 * Evidence: audit/function-audit/AF-010-money-microfunctions.md (slice 2 addendum).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAmountExpression, MAX_EXPRESSION_LENGTH, MAX_PARENTHESIS_DEPTH } from '../lib/amountExpression';
import { parseCsv, parseCsvChecked, detectDelimiter } from '../lib/csv';

test('AF-010 expression evaluator: exact rational arithmetic and half-away-from-zero cents', () => {
  assert.equal(evaluateAmountExpression('100 / 3 * 2'), 6667); // 66.666.. dollars
  assert.equal(evaluateAmountExpression('(40 + 5) / 3'), 1500);
  assert.equal(evaluateAmountExpression('2/3'), 67);
  assert.equal(evaluateAmountExpression('-2/3'), -67, 'negative half rounds away from zero');
  assert.equal(evaluateAmountExpression('0.005'), 1);
  assert.equal(evaluateAmountExpression('-0.005'), -1);
  assert.equal(evaluateAmountExpression(''), 0);
  assert.throws(() => evaluateAmountExpression('1/0'), /Division by zero/);
  assert.throws(() => evaluateAmountExpression('1+'), /Unexpected end/);
  assert.throws(() => evaluateAmountExpression('*3'), /Unexpected token/);
  assert.throws(() => evaluateAmountExpression('1 2'), /Unexpected tokens remaining/);
  assert.throws(() => evaluateAmountExpression('1..2'), /Invalid decimal/);
  assert.throws(() => evaluateAmountExpression('abc'), /Invalid character/);
  assert.throws(() => evaluateAmountExpression('('.repeat(MAX_PARENTHESIS_DEPTH + 1) + '1'), /depth exceeds/);
  assert.throws(() => evaluateAmountExpression('9'.repeat(MAX_EXPRESSION_LENGTH + 1)), /length exceeds/);
  assert.throws(() => evaluateAmountExpression(')1'), /Unmatched closing/);
  assert.throws(() => evaluateAmountExpression('(1'), /Unmatched opening/);
});

test('AF-010-F7 (P3): beyond Number safe range the evaluator loses its integer-cents guarantee', () => {
  // 25 integer digits fit the 80-char limit; the decimal branch builds via Number(intPart), and
  // every branch ends with Number(quotient), so beyond 2^53 the output is a rounded float, not exact
  // cents. Unrealistic money magnitude, but the evaluator advertises exact BigInt arithmetic;
  // fix direction: build BigInts without Number() and return a safe-integer check or BigInt result.
  const out = evaluateAmountExpression('1234567890123456789012345.00');
  assert.equal(Number.isSafeInteger(out), false, 'OBSERVED: non-safe-integer output from huge literal');
  assert.equal(Number.isSafeInteger(evaluateAmountExpression('9007199254740993')), false,
    'OBSERVED: the final Number() conversion cannot carry exact cents above 2^53');
});

test('AF-010 CSV parser: RFC 4180 core, delimiter detection and whole-file refusal', () => {
  assert.deepEqual(parseCsv('a,b,c\r\n1,"x,y",3'), [['a', 'b', 'c'], ['1', 'x,y', '3']]);
  assert.equal(detectDelimiter('a;b;c\n1;2;3'), ';');
  assert.equal(detectDelimiter('a\tb\n1\t2'), '\t');
  assert.deepEqual(parseCsv('a,b\n"line1\nline2",z'), [['a', 'b'], ['line1\nline2', 'z']], 'newline inside a quoted cell');
  assert.throws(() => parseCsvChecked('a,b\n1,"unterminated'), /never closed/, 'truncated quote refuses the whole file');
  assert.deepEqual(parseCsv('a,b\nx"y,z'), [['a', 'b'], ['x"y', 'z']], 'stray quote is treated as a literal, no crash');
  // observed leniency: cells are trimmed even inside quotes
  assert.deepEqual(parseCsv('" hello ","x"'), [['hello', 'x']], 'OBSERVED: quoted-cell surrounding whitespace is trimmed');
});
