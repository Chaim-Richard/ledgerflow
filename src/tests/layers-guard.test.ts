import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const roots = ['src/lib', 'src/components'];

function files(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...files(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const violations: string[] = [];
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  for (const file of files(root)) {
    const content = fs.readFileSync(file, 'utf8');
    // lib must never import from components/ or server/
    if (root === 'src/lib') {
      if (/from\s+['\"]\.\.?\/.*components\//.test(content) || /from\s+['\"]\.\.\/components\//.test(content) || content.includes('/components/'))
        if (content.includes('from') && (content.includes('components/') || content.includes('src/components'))) violations.push(`${file}: lib/ imports components/`);
      if (content.includes('src/server') || content.includes('../server/') || content.includes('from \"../server')) violations.push(`${file}: lib/ imports server/`);
      // more precise: search import ... from ".../server/"
      for (const line of content.split('\n')) {
        if (/import\s+.*from\s+['\"].*\/server\//.test(line) || /import\s+.*from\s+['\"]\.\.\/\.\.\/server/.test(line)) violations.push(`${file}: ${line.trim()}`);
      }
    }
    if (root === 'src/components') {
      for (const line of content.split('\n')) {
        if (/import\s+.*from\s+['\"].*\/server\//.test(line) || /from\s+['\"]\.\.\/(server|server\/)/.test(line)) violations.push(`${file}: components/ imports server/: ${line.trim()}`);
      }
    }
  }
}

// allowlist: known historical exceptions documented
const allowlist: string[] = [
  // ledgerCollections.ts is a UI hook boundary and is allowed to be imported by components only, not the reverse
];

describe('Architecture layers (F-40)', () => {
  test('lib/ never imports components/ or server/; components/ never imports server/', () => {
    const filtered = violations.filter(v => !allowlist.some(a => v.includes(a)));
    assert.deepEqual(filtered, [], `Layer violations:\n${filtered.join('\n')}\n(photocraft xtask layers equivalent)`);
  });
});
