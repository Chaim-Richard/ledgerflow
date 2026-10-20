import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// AUD-06: every unit test file under src/ is one that `npm test` and `npm run test:cov` run.
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toRegex = (glob: string) => new RegExp('^' + escapeRegex(glob).replace(/\\\*/g, '[^/]*') + '$');

test('every src/**/*.test.ts(x) file is matched by the npm test globs', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
  for (const script of ['test', 'test:cov']) {
    const globs = pkg.scripts[script].split(/\s+/).filter(p => p.startsWith('src/') && p.includes('.test.'));
    const patterns = globs.map(toRegex);
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.posix.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.test\.tsx?$/.test(e.name)) files.push(full);
      }
    };
    walk('src');
    const missed = files.filter(f => !patterns.some(p => p.test(f)));
    assert.deepEqual(missed, [], `${script} does not run these test files; widen its globs`);
  }
});
