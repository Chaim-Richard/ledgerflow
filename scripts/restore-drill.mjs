/**
 * S-03: Non-destructive local test-database restore drill.
 * REQUIRES a disposable LF_TEST_DATABASE_URL pointing to a LOCAL lf_test* DB.
 * No defaults; never drops or modifies the source; deletes only a new unique
 * temporary database that this process created.
 *
 * Prerequisites: PostgreSQL client executables (psql, createdb, pg_dump,
 * pg_restore, dropdb), and CREATE DATABASE permissions on localhost.
 */
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateDisposableDbUrl(value) {
  if (!value) throw new Error('Set LF_TEST_DATABASE_URL explicitly; no database default is permitted.');
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid LF_TEST_DATABASE_URL.'); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error('Expected a PostgreSQL URL.');
  if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname)) {
    throw new Error('Restore drill only supports localhost; production and cloud databases are forbidden.');
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!/^lf_test(?:_[a-z0-9_]+)?$/.test(database)) {
    throw new Error('Restore drill source database name must be lf_test or lf_test_<suffix>.');
  }
  return { url, database };
}

function run(command, args) {
  // execFileSync never invokes a shell. Avoid printing the connection string,
  // data, passwords or subprocess command on error.
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 }).trim();
  } catch {
    throw new Error('Restore drill operation failed: ' + command);
  }
}

const q = name => '"' + name.replaceAll('"', '""') + '"';

function databaseFingerprint(url, table) {
  // Summarize both count and sorted per-row content. Matching counts alone are
  // insufficient. jsonb formatting is stable on the SAME Postgres installation.
  const sql = 'select count(*)::text || \':\' || md5(coalesce(string_agg(' +
    'md5(to_jsonb(t)::text), \'\' order by md5(to_jsonb(t)::text)), \'\')) ' +
    'from public.' + q(table) + ' t';
  return run('psql', ['--no-psqlrc', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', url, '-c', sql]);
}

function publicTables(url) {
  const sql = "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name";
  return run('psql', ['--no-psqlrc', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', url, '-c', sql])
    .split('\n').filter(Boolean);
}

export function performLocalRestoreDrill(inputUrl) {
  const { url, database } = validateDisposableDbUrl(inputUrl);
  const random = randomBytes(6).toString('hex');
  const restored = 'lf_restore_drill_' + random;
  const target = new URL(url.toString());
  target.pathname = '/' + restored;
  const admin = new URL(url.toString());
  admin.pathname = '/postgres';
  const dir = mkdtempSync(join(tmpdir(), 'ledgerflow-restore-'));
  const dump = join(dir, 'backup.dump');
  let created = false;
  try {
    // Only a non-existent, randomly chosen database is created.
    // Never run dropdb on an arbitrary supplied name.
    run('createdb', ['--maintenance-db', admin.toString(), restored]);
    created = true;
    const sourceTablesBefore = publicTables(url.toString());
    const before = new Map(sourceTablesBefore.map(table => [table, databaseFingerprint(url.toString(), table)]));
    run('pg_dump', ['-Fc', '--no-owner', '--no-acl', '-f', dump, '-d', url.toString()]);
    run('pg_restore', ['--exit-on-error', '--no-owner', '--no-acl', '-d', target.toString(), dump]);

    // Source must be quiescent; detect any concurrent changes to a table's data
    // over the duration of the drill, or mark it inconclusive.
    const sourceTablesAfter = publicTables(url.toString());
    if (JSON.stringify(sourceTablesBefore) !== JSON.stringify(sourceTablesAfter)) {
      throw new Error('Source schema changed during backup; drill is inconclusive.');
    }
    const restoredTables = publicTables(target.toString());
    if (JSON.stringify(sourceTablesBefore) !== JSON.stringify(restoredTables)) {
      throw new Error('Restored database tables differ from source.');
    }
    const differences = [];
    for (const table of sourceTablesBefore) {
      const after = databaseFingerprint(url.toString(), table);
      const result = databaseFingerprint(target.toString(), table);
      if (before.get(table) !== after) {
        throw new Error('Source data changed during backup; drill is inconclusive.');
      }
      if (after !== result) differences.push(table);
    }
    if (differences.length) throw new Error('Restore data mismatch in ' + differences.length + ' tables.');

    return {
      passed: true,
      source: database,
      tableCount: sourceTablesBefore.length,
      note: 'Schema list and per-row digests matched on a disposable local database; application-level restore and independently worked financial reports are NOT certified.',
    };
  } finally {
    let cleanupFailure = false;
    if (created) {
      try {
        run('dropdb', ['--maintenance-db', admin.toString(), '--if-exists', '--force', restored]);
      } catch { cleanupFailure = true; }
    }
    // Remove the local dump even if dropping the temporary database failed.
    rmSync(dir, { recursive: true, force: true });
    if (cleanupFailure) {
      throw new Error('Temporary restore database cleanup failed; remove only ' + restored + ' manually.');
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = performLocalRestoreDrill(process.env.LF_TEST_DATABASE_URL);
    const reportDir = resolve('docs/eval');
    mkdirSync(reportDir, { recursive: true });
    const filename = join(reportDir, 'restore-drill-' + new Date().toISOString().replaceAll(':', '-') + '.md');
    writeFileSync(filename, [
      '# Local test database restore drill', '',
      'Result: PASS', 'Source: ' + result.source,
      'Tables checked: ' + result.tableCount, '', result.note, '',
    ].join('\n'));
    console.log('PASS — local database restore row digests matched; evidence: ' + filename);
  } catch (error) {
    console.error('FAIL — ' + (error instanceof Error ? error.message : 'Unknown restore drill error'));
    process.exitCode = 1;
  }
}
