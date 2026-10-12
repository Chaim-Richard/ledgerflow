import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkUsTaxId,
  formatUsTaxIdForInput,
  maskUsTaxId,
  usTaxIdWarning,
  type UsTaxIdKind,
} from '../lib/tax/usTaxIdFormat';

test('E-14: EIN accepts nine digits or correctly placed separator', () => {
  assert.deepEqual(checkUsTaxId('12-3456789', 'ein'), {
    state: 'valid-format', kind: 'ein', problem: null, masked: '**-***6789',
  });
  assert.deepEqual(checkUsTaxId(' 123456789 ', 'ein'), checkUsTaxId('12 3456789', 'ein'));
  assert.equal(formatUsTaxIdForInput('123456789', 'ein'), '12-3456789');
  assert.equal(formatUsTaxIdForInput('12-3456789', 'ein'), '12-3456789');
  assert.equal(maskUsTaxId('123456789', 'ein'), '**-***6789');
});

test('E-14: SSN accepts nine digits or correctly placed separators', () => {
  assert.deepEqual(checkUsTaxId('123-45-6789', 'ssn'), {
    state: 'valid-format', kind: 'ssn', problem: null, masked: '***-**-6789',
  });
  assert.equal(checkUsTaxId('123 45 6789', 'ssn').state, 'valid-format');
  assert.equal(checkUsTaxId('123456789', 'ssn').state, 'valid-format');
  assert.equal(formatUsTaxIdForInput('123456789', 'ssn'), '123-45-6789');
  assert.equal(maskUsTaxId(' 123-45-6789 ', 'ssn'), '***-**-6789');
});

test('E-14: explicit kind prevents confusing an EIN layout with an SSN layout', () => {
  assert.equal(checkUsTaxId('123-45-6789', 'ein').problem, 'layout');
  assert.equal(checkUsTaxId('12-3456789', 'ssn').problem, 'layout');
  assert.equal(checkUsTaxId('123456789', 'ein').state, 'valid-format');
  assert.equal(checkUsTaxId('123456789', 'ssn').state, 'valid-format');
});

test('E-14: SSA impossible area values are rejected', () => {
  for (const prefix of ['000', '666', '900', '901', '999']) {
    assert.equal(checkUsTaxId(prefix + '456789', 'ssn').problem, 'area');
  }
  // SSA randomization allows other areas; do not depend on obsolete
  // geographic or "high group" heuristics.
  assert.equal(checkUsTaxId('899456789', 'ssn').state, 'valid-format');
  assert.equal(checkUsTaxId('001456789', 'ssn').state, 'valid-format');
});

test('E-14: SSA impossible group and serial values are rejected', () => {
  assert.equal(checkUsTaxId('123006789', 'ssn').problem, 'group');
  assert.equal(checkUsTaxId('123450000', 'ssn').problem, 'serial');
  assert.equal(checkUsTaxId('123010001', 'ssn').state, 'valid-format');
});

test('E-14: placeholders are not accepted as usable tax identifiers', () => {
  for (const kind of ['ein', 'ssn'] as UsTaxIdKind[]) {
    const parsed = checkUsTaxId('000000000', kind);
    assert.equal(parsed.problem, 'placeholder');
    assert.equal(parsed.masked, null);
    assert.equal(maskUsTaxId('000000000', kind), null);
    assert.equal(formatUsTaxIdForInput('000000000', kind), null);
  }
});

test('E-14: optional blanks are not reported as errors', () => {
  for (const kind of ['ein', 'ssn'] as UsTaxIdKind[]) {
    for (const input of [null, undefined, '', '   ', '\t']) {
      assert.deepEqual(checkUsTaxId(input, kind), { state: 'empty', kind, masked: null, problem: null });
      assert.equal(usTaxIdWarning(checkUsTaxId(input, kind)), null);
    }
  }
});

test('E-14: characters, misplaced separators and incomplete input are refused', () => {
  for (const input of ['12-345 6789', '12/3456789', '+123456789', '１２３４５６７８９', 'x123456789', '12.3456789', '123456789\n', '1e8']) {
    // Trim at the edges is allowed, not arbitrary changes inside the ID.
    if (input === '123456789\n') continue;
    const result = checkUsTaxId(input, 'ein');
    assert.equal(result.state, 'warning');
    assert.equal(result.masked, null);
    assert.equal(formatUsTaxIdForInput(input, 'ein'), null);
  }
  assert.equal(checkUsTaxId('12345678', 'ein').problem, 'layout');
  assert.equal(checkUsTaxId('1234567890', 'ssn').problem, 'layout');
  assert.equal(checkUsTaxId(123456789, 'ein').problem, 'characters');
  assert.equal(checkUsTaxId({}, 'ssn').problem, 'characters');
});

test('E-14: static warnings and masked results do not reveal full tax IDs', () => {
  for (const kind of ['ein', 'ssn'] as UsTaxIdKind[]) {
    const input = '123456789';
    const valid = checkUsTaxId(input, kind);
    assert.equal(JSON.stringify(valid).includes(input), false);
    assert.equal(JSON.stringify(valid).includes('12345'), false);
    assert.equal(usTaxIdWarning(valid), null);
    const bad = checkUsTaxId('12345678', kind);
    const warning = usTaxIdWarning(bad);
    assert.ok(warning?.length);
    assert.equal(warning?.includes('12345678'), false);
    assert.equal(JSON.stringify(bad).includes('12345678'), false);
  }
});

test('E-14: formatting helpers are deterministic and never modify their inputs', () => {
  const input = Object.freeze({ raw: ' 12-3456789 ' });
  assert.deepEqual(checkUsTaxId(input.raw, 'ein'), checkUsTaxId(input.raw, 'ein'));
  assert.equal(input.raw, ' 12-3456789 ');
  assert.equal(formatUsTaxIdForInput(input.raw, 'ein'), '12-3456789');
  assert.equal(maskUsTaxId(input.raw, 'ein'), '**-***6789');
});
