#!/usr/bin/env node
// A downward-only budget: package.json's eslint --max-warnings is authoritative.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const flag = /--max-warnings(?:=|\s+)(\d+)(?=\s|$)/;
const replaceFlag = /(--max-warnings(?:=|\s+))\d+(?=\s|$)/;

export function getCeiling(pkg) {
  const command = pkg?.scripts?.['lint:eslint'];
  if (typeof command !== 'string') throw new Error('Missing scripts.lint:eslint');
  const found = command.match(flag);
  if (!found) throw new Error('ESLint command is missing --max-warnings N');
  const count = Number(found[1]);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid warning ceiling');
  return count;
}

export function tightenCeiling(pkg, observed) {
  if (!Number.isSafeInteger(observed) || observed < 0) throw new Error('Invalid warning count');
  const limit = getCeiling(pkg);
  if (observed > limit) throw new Error('Refusing to increase ESLint ceiling: ' + observed + ' > ' + limit);
  if (observed === limit) return { changed: false, pkg, ceiling: limit };
  const updated = structuredClone(pkg);
  updated.scripts['lint:eslint'] = updated.scripts['lint:eslint'].replace(
    replaceFlag, (_match, prefix) => prefix + observed,
  );
  return { changed: true, pkg: updated, ceiling: observed };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => a !== '--update') || args.length > 1) {
    throw new Error('Usage: node scripts/eslint-warning-ratchet.mjs [--update]');
  }
  const pkgPath = resolve('package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  const limit = getCeiling(pkg);
  // Match the normal "eslint ." lint scope and count actual diagnostics, not suppressions.
  const { ESLint } = await import('eslint');
  const results = await new ESLint().lintFiles(['.']);
  const errors = results.reduce((n, r) => n + r.errorCount, 0);
  const warnings = results.reduce((n, r) => n + r.warningCount, 0);
  console.log('ESLint: ' + errors + ' errors, ' + warnings + ' warnings; ceiling ' + limit);
  if (errors > 0) throw new Error('ESLint has errors; not changing warning budget');
  const next = tightenCeiling(pkg, warnings);
  if (!next.changed) return console.log('Warning ceiling unchanged.');
  if (args.includes('--update')) {
    await writeFile(pkgPath, JSON.stringify(next.pkg, null, 2) + '\n');
    console.log('Reduced ESLint ceiling from ' + limit + ' to ' + next.ceiling);
  } else {
    console.log('Improved to ' + next.ceiling + '; use --update to update package.json');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(e => { console.error(e); process.exitCode = 1; });
}
