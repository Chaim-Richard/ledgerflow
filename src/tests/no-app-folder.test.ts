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
});
