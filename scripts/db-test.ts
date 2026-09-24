/**
 * Test database for CI and local runs (a plain Postgres, never the production database):
 *   npm run db:test-setup   applies supabase/tests/plain-postgres-stub.sql, then every migration
 *   npm run test:rules      runs supabase/tests/rls.test.sql (all inside one rolled-back transaction)
 * Reads LF_TEST_DATABASE_URL, e.g. postgresql://postgres:postgres@localhost:5432/lf_test
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const root = process.cwd();
const url = process.env.LF_TEST_DATABASE_URL;

async function main(command: string | undefined) {
  if (!url) throw new Error('Set LF_TEST_DATABASE_URL to a test Postgres database.');
  const host = new URL(url).hostname;
  if (command === 'setup' && /supabase\.(co|com)$/.test(host)) {
    throw new Error('Refusing to install the test stub into a Supabase database; use a local or CI Postgres.');
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    if (command === 'setup') {
      const files = [
        path.join(root, 'supabase/tests/plain-postgres-stub.sql'),
        ...fs.readdirSync(path.join(root, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort()
          .map(f => path.join(root, 'supabase/migrations', f)),
      ];
      for (const file of files) {
        await client.query(fs.readFileSync(file, 'utf8'));
        console.log(`applied ${path.relative(root, file)}`);
      }
    } else if (command === 'rls') {
      const results = await client.query(fs.readFileSync(path.join(root, 'supabase/tests/rls.test.sql'), 'utf8'));
      const all = Array.isArray(results) ? results : [results];
      const passed = all.some(r => r.rows?.some((row: Record<string, unknown>) => row.result === 'ALL RLS TESTS PASSED'));
      if (!passed) throw new Error('The RLS test script did not report success.');
      console.log('ALL RLS TESTS PASSED');
    } else {
      throw new Error('Usage: tsx scripts/db-test.ts setup|rls');
    }
  } finally {
    await client.end();
  }
}

main(process.argv[2]).catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
