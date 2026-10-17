import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseApprovalLimit } from '../lib/invoiceApproval';
import { parseAmountToCents } from '../lib/utils';

// AU-5: amounts read from text become cents exactly, never through parseFloat(x) * 100.
test('decimal text that a float gets wrong becomes the right cents', () => {
  assert.equal(Math.round(parseFloat('1.005') * 100), 100, 'the float way loses a cent');
  assert.equal(parseAmountToCents('1.005'), 101);
  assert.equal(parseApprovalLimit('1.005'), 101);
  assert.equal(parseApprovalLimit('1,500'), 150000);
  assert.equal(parseApprovalLimit('-3'), 0);
});

test('no server or library code turns text into cents with parseFloat(...) * 100', () => {
  const bad: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) {
        fs.readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
          if (/parseFloat\((?:[^()]|\([^()]*\))*\)\s*\*\s*100\b/.test(line)) bad.push(`${full}:${i + 1}`);
        });
      }
    }
  };
  for (const dir of ['src/lib', 'src/server', 'src/services']) walk(dir);
  assert.deepEqual(bad, [], 'use parseAmountToCents (src/lib/utils.ts) instead');
});
