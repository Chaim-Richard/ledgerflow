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
import { REPORT_ONLY_HEADER, clientSupabaseUrl, staticCspRollout, vercelCspValue, withVercelCsp } from '../src/server/http/contentSecurityPolicy';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'vercel.json');
const env = loadEnv('production', root, 'VITE_');
const projectUrl = clientSupabaseUrl(env);
const config = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
const rollout = staticCspRollout();
const expected = withVercelCsp(config, projectUrl, rollout);

if (process.argv.includes('--write')) {
  fs.writeFileSync(file, `${JSON.stringify(expected, null, 2)}\n`);
  console.log(`vercel.json Content-Security-Policy now allows ${new URL(projectUrl).host} (S-23 stage: ${rollout}).`);
} else {
  // S-23: both the enforced policy and the report-only one the browser measures against.
  for (const header of ['content-security-policy', REPORT_ONLY_HEADER.toLowerCase()]) {
    const want = vercelCspValue(expected, header);
    const have = vercelCspValue(config, header);
    if (want === have) continue;
    console.error(`vercel.json's ${header} does not match the Supabase project this build uses (${projectUrl}) `
      + `at S-23 stage "${rollout}".\n`
      + 'Run `npm run csp:vercel` with the same VITE_SUPABASE_URL and commit vercel.json.\n'
      + `Expected:\n  ${want ?? '(none)'}\nFound:\n  ${have ?? '(none)'}`);
    process.exit(1);
  }
}
