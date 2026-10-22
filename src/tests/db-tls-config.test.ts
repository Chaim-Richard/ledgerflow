/**
 * AUD-20: database TLS policy. poolConfigFromEnv is a pure config builder (no connection is
 * made): a remote database is verified against DATABASE_CA_CERT when it is set; without it the
 * connection stays encrypted-but-unverified (as before) and one clear warning names the variable;
 * a local database (the test DB) gets no TLS at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { poolConfigFromEnv, DATABASE_CA_WARNING } from '../server/db/pgFirestore';

const REMOTE = 'postgresql://app:secret@db.project-ref.supabase.co:5432/postgres?sslmode=require';
const CA_PEM = '-----BEGIN CERTIFICATE-----\nMIIBfakecertificatebody\n-----END CERTIFICATE-----';

function build(connectionString: string | undefined, env: NodeJS.ProcessEnv) {
  const warnings: string[] = [];
  const config = poolConfigFromEnv({ connectionString }, env, message => warnings.push(message));
  return { config, warnings };
}

test('remote database with DATABASE_CA_CERT verifies the server certificate and does not warn', () => {
  const { config, warnings } = build(REMOTE, { DATABASE_CA_CERT: CA_PEM });
  assert.deepEqual(config.ssl, { ca: CA_PEM, rejectUnauthorized: true });
  assert.deepEqual(warnings, []);
  // URL TLS flags are stripped so the policy above is the one pg applies.
  assert.doesNotMatch(String(config.connectionString), /sslmode/);
});

test('DATABASE_CA_CERT written with literal \\n escapes (one-line env value) becomes a real PEM', () => {
  const oneLine = CA_PEM.replace(/\n/g, '\\n');
  const { config } = build(REMOTE, { DATABASE_CA_CERT: oneLine });
  assert.deepEqual(config.ssl, { ca: CA_PEM, rejectUnauthorized: true });
});

test('remote database without DATABASE_CA_CERT keeps connecting encrypted and warns once, naming the variable', () => {
  for (const env of [{}, { DATABASE_CA_CERT: '' }, { DATABASE_CA_CERT: '  \n' }] as NodeJS.ProcessEnv[]) {
    const { config, warnings } = build(REMOTE, env);
    assert.deepEqual(config.ssl, { rejectUnauthorized: false }, 'current behaviour is kept');
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0], DATABASE_CA_WARNING);
    assert.match(warnings[0], /DATABASE_CA_CERT/);
    assert.match(warnings[0], /NOT verified/);
  }
});

test('local databases (the test DB) get no TLS and no warning, with or without a CA', () => {
  const locals = [
    'postgresql://postgres:postgres@localhost:5432/lf_test9',
    'postgresql://postgres:postgres@127.0.0.1:5432/lf_test9',
    'postgresql://postgres:postgres@[::1]:5432/lf_test9',
    'postgresql://postgres@pghost/lf_test9?host=/var/run/postgresql', // unix socket
  ];
  for (const url of locals) {
    for (const env of [{}, { DATABASE_CA_CERT: CA_PEM }] as NodeJS.ProcessEnv[]) {
      const { config, warnings } = build(url, env);
      assert.equal(config.ssl, undefined, url);
      assert.deepEqual(warnings, [], url);
    }
  }
});

test('the connection string falls back to DATABASE_URL from the given env', () => {
  const { config, warnings } = build(undefined, { DATABASE_URL: REMOTE, DATABASE_CA_CERT: CA_PEM });
  assert.match(String(config.connectionString), /db\.project-ref\.supabase\.co/);
  assert.deepEqual(warnings, []);
});
