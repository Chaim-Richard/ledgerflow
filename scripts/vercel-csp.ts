/**
 * vercel.json's Content-Security-Policy is a static header (Vercel reads vercel.json before the
 * build runs, so it cannot be filled in at build time). It is generated from the Supabase project the
 * browser bundle is built against (VITE_SUPABASE_URL, from the environment or .env files exactly as
 * Vite reads them, else supabase-config.json) — AUD-12.
 *
 *   npx tsx scripts/vercel-csp.ts           check: exit 1 if vercel.json disagrees (runs in `npm run build`)
 *   npx tsx scripts/vercel-csp.ts --write   rewrite vercel.json's CSP for the configured project
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from 'vite';
import { clientSupabaseUrl, staticCspHeaderValue, vercelCspValue, withVercelCsp } from '../src/server/http/contentSecurityPolicy';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'vercel.json');
const env = loadEnv('production', root, 'VITE_');
const projectUrl = clientSupabaseUrl(env);
const config = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
const expected = staticCspHeaderValue(projectUrl);

if (process.argv.includes('--write')) {
  fs.writeFileSync(file, `${JSON.stringify(withVercelCsp(config, projectUrl), null, 2)}\n`);
  console.log(`vercel.json Content-Security-Policy now allows ${new URL(projectUrl).host}.`);
} else if (vercelCspValue(config) !== expected) {
  console.error(`vercel.json's Content-Security-Policy does not match the Supabase project this build uses (${projectUrl}).\n`
    + 'Run `npm run csp:vercel` with the same VITE_SUPABASE_URL and commit vercel.json.\n'
    + `Expected:\n  ${expected}\nFound:\n  ${vercelCspValue(config) ?? '(none)'}`);
  process.exit(1);
}
