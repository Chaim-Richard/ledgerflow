import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('No Top-Level App Folder Guard Suite', () => {
  it('fails if a top-level app/ or app/applet/ directory exists in the workspace', () => {
    const appDir = path.resolve(process.cwd(), 'app');
    const exists = fs.existsSync(appDir);
    assert.equal(
      exists,
      false,
      'Security / Workspace Violation: Top-level app/ directory must not exist. Workspace files must reside at workspace root.'
    );
  });

  it('fails if bun.lock or yarn.lock exists in the workspace root', () => {
    const bunLock = path.resolve(process.cwd(), 'bun.lock');
    const yarnLock = path.resolve(process.cwd(), 'yarn.lock');
    assert.equal(fs.existsSync(bunLock), false, 'Workspace Violation: bun.lock must not exist. Use npm package-lock.json only.');
    assert.equal(fs.existsSync(yarnLock), false, 'Workspace Violation: yarn.lock must not exist. Use npm package-lock.json only.');
  });
});
