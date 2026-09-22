import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('package-lock.json contains all required platform binaries', () => {
  const lockfilePath = path.resolve(process.cwd(), 'package-lock.json');
  assert.ok(fs.existsSync(lockfilePath), 'package-lock.json must exist');

  const lockfileContent = fs.readFileSync(lockfilePath, 'utf-8');
  const lockfile = JSON.parse(lockfileContent);

  const packages = lockfile.packages || {};
  const packageKeys = Object.keys(packages);

  const targets = [
    {
      name: '@rollup/rollup-*',
      platforms: ['darwin-arm64', 'darwin-x64', 'win32-x64', 'linux-arm64', 'linux-x64'],
      matcher: (key: string, platform: string) => key.startsWith('node_modules/@rollup/rollup-') && key.includes(platform)
    },
    {
      name: 'lightningcss-*',
      platforms: ['darwin-arm64', 'darwin-x64', 'win32-x64', 'linux-arm64', 'linux-x64'],
      matcher: (key: string, platform: string) => key.startsWith('node_modules/lightningcss-') && key.includes(platform)
    },
    {
      name: '@tailwindcss/oxide-*',
      platforms: ['darwin-arm64', 'darwin-x64', 'win32-x64', 'linux-arm64', 'linux-x64'],
      matcher: (key: string, platform: string) => key.startsWith('node_modules/@tailwindcss/oxide-') && key.includes(platform)
    }
  ];

  for (const target of targets) {
    for (const platform of target.platforms) {
      const match = packageKeys.some(key => target.matcher(key, platform));
      assert.ok(
        match,
        `package-lock.json is missing ${target.name} entry for platform: ${platform}. Ensure lockfile was generated with all platform binaries.`
      );
    }
  }
});
