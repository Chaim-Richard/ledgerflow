import test from 'node:test';
import assert from 'node:assert/strict';
import { checkProductionConfig } from '../../scripts/check-prod-env';

const valid = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://localhost:5432/lf_test',
  SESSION_SECRET: '4f1bc9d7a2e863c0b5e4f9a12d783056b4c7a90d',
  SYSTEM_SALT: 'd96f4031a7e2bc8509fbd314ec670a259d1e8c43',
  INVITE_SECRET: 'e28f0cb6314d9a57b2c803f64e1a925d70bc3f46',
};

test('S-02: valid local test configuration passes core production preflight', () => {
  const results = checkProductionConfig(valid);
  assert.equal(results.filter(r => r.status === 'fail').length, 0);
  assert.ok(results.some(r => r.name === 'Deployment' && r.status === 'manual'));
});

test('S-02: missing or known dummy secrets fail without printing any values', () => {
  const env = { ...valid, SESSION_SECRET: 'dev_session_secret_32bytes_long', INVITE_SECRET: '' };
  const results = checkProductionConfig(env);
  assert.ok(results.some(r => r.name === 'Session signing' && r.status === 'fail'));
  assert.ok(results.some(r => r.name === 'Invitation signing' && r.status === 'fail'));
  assert.ok(!JSON.stringify(results).includes(env.SESSION_SECRET));
});

test('S-02: remote DB refuses missing or invalid CA; no URL disclosed', () => {
  const url = 'postgresql://private:secret@db.example.org:5432/ledgerflow';
  const results = checkProductionConfig({ ...valid, DATABASE_URL: url, DATABASE_CA_CERT: 'wrong' });
  assert.ok(results.some(r => r.name === 'Remote database certificate' && r.status === 'fail'));
  assert.ok(!JSON.stringify(results).includes(url));
});

test('S-02: optional Stripe is manual when absent, but enforced when configured', () => {
  const absent = checkProductionConfig(valid);
  assert.ok(absent.some(r => r.name === 'Stripe integration' && r.status === 'manual'));
  const configured = checkProductionConfig({ ...valid, STRIPE_SECRET_KEY: 'sk_test_bad' });
  assert.ok(configured.some(r => r.name === 'Stripe mode' && r.status === 'fail'));
  assert.ok(configured.some(r => r.name === 'Stripe webhook' && r.status === 'fail'));
});
