/**
 * Server-side Supabase Auth (src/server/auth/supabaseAuth.ts): token checks always run;
 * the account operations run against a database when LF_TEST_DATABASE_URL is set.
 */
import test, { after, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { SignJWT } from 'jose';
import type { JWTPayload } from 'jose';
import { AuthError, authAdmin, verifyIdToken } from '../server/auth/supabaseAuth';
import { getDb } from '../server/db/firestore';

const dbUrl = process.env.LF_TEST_DATABASE_URL;
if (dbUrl) process.env.DATABASE_URL = dbUrl;
process.env.SUPABASE_URL = 'https://example-project.supabase.co';
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret-with-at-least-32-characters-long';
const ISSUER = 'https://example-project.supabase.co/auth/v1';

async function token(claims: JWTPayload, options: { secret?: string; issuer?: string; audience?: string; expiresIn?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? 'authenticated')
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '1h')
    .sign(new TextEncoder().encode(options.secret ?? process.env.SUPABASE_JWT_SECRET));
}

const uid = () => crypto.randomUUID();

function authCode(err: unknown): string | undefined {
  return err instanceof AuthError ? err.code : undefined;
}

describe('verifyIdToken', () => {
  test('accepts a signed-in user token and maps it to the shape routes use', async () => {
    const id = uid();
    const decoded = await verifyIdToken(await token({ sub: id, role: 'authenticated', is_anonymous: true, app_metadata: {} }));
    assert.equal(decoded.uid, id);
    assert.equal(decoded.email_verified, false);
    assert.equal(decoded.firebase.sign_in_provider, 'anonymous');
    assert.equal(decoded.admin, undefined);
  });

  test('platform admin comes from app_metadata, never from user-editable metadata', async () => {
    // aal2 (code-verified) and no email: no database lookups needed
    const admin = await verifyIdToken(await token({
      sub: uid(), role: 'authenticated', aal: 'aal2', app_metadata: { provider: 'email', admin: true, role: 'admin' },
    }));
    assert.equal(admin.admin, true);
    assert.equal(admin.role, 'admin');
    assert.equal(admin.firebase.sign_in_provider, 'password');

    const pretender = await verifyIdToken(await token({
      sub: uid(), role: 'authenticated', aal: 'aal2', app_metadata: { provider: 'google' }, user_metadata: { admin: true, role: 'admin' },
    }));
    assert.equal(pretender.admin, undefined);
    assert.equal(pretender.role, undefined);
    assert.equal(pretender.firebase.sign_in_provider, 'google.com');
  });

  test('refuses tokens that are not signed-in user tokens from this project', async () => {
    const sub = uid();
    const bad = [
      await token({ sub, role: 'authenticated' }, { secret: 'another-secret-that-is-at-least-32-characters' }),
      await token({ sub, role: 'authenticated' }, { issuer: 'https://other.supabase.co/auth/v1' }),
      await token({ sub, role: 'authenticated' }, { audience: 'anon' }),
      await token({ sub, role: 'authenticated' }, { expiresIn: '-1m' }),
      await token({ role: 'anon' }),
      await token({ sub: 'not-a-uuid', role: 'authenticated' }),
      'not.a.token',
      '',
    ];
    const unsigned = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub, role: 'authenticated', aud: 'authenticated', iss: ISSUER })).toString('base64url')}.`;
    bad.push(unsigned);
    for (const t of bad) {
      await assert.rejects(verifyIdToken(t), (err: unknown) => authCode(err) === 'auth/invalid-id-token' || authCode(err) === 'auth/argument-error');
    }
  });
});

describe('email confirmation and account operations', { skip: !dbUrl && 'LF_TEST_DATABASE_URL not set' }, () => {
  const created: string[] = [];

  async function addUser(email: string, confirmed: boolean, appMeta: Record<string, unknown> = { provider: 'email', providers: ['email'] }) {
    const id = uid();
    created.push(id);
    await getDb().pool.query(
      'insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data) values ($1, $2, $3, $4)',
      [id, email, confirmed ? new Date() : null, JSON.stringify(appMeta)]);
    return id;
  }

  after(async () => {
    await getDb().pool.query('delete from auth.users where id = any($1::uuid[])', [created]);
    await getDb().terminate();
  });

  test('email_verified follows the confirmation in the database', async () => {
    const email = `new-${crypto.randomBytes(3).toString('hex')}@example.com`;
    const id = await addUser(email, false);
    const t = await token({ sub: id, email, role: 'authenticated', app_metadata: { provider: 'email' } });
    assert.equal((await verifyIdToken(t)).email_verified, false);
    await getDb().pool.query('update auth.users set email_confirmed_at = now() where id = $1', [id]);
    assert.equal((await verifyIdToken(t)).email_verified, true);
  });

  test('two-step login: a password-only token is refused once an authenticator is verified', async () => {
    const email = `mfa-${crypto.randomBytes(3).toString('hex')}@example.com`;
    const id = await addUser(email, true);
    const aal1 = await token({ sub: id, email, role: 'authenticated', aal: 'aal1', app_metadata: { provider: 'email' } });
    assert.equal((await verifyIdToken(aal1)).uid, id);

    const other = await addUser(`mfa2-${crypto.randomBytes(3).toString('hex')}@example.com`, true);
    await getDb().pool.query(
      "insert into auth.mfa_factors (id, user_id, factor_type, status) values ($1, $2, 'totp', 'verified')", [uid(), other]);
    const otherAal1 = await token({ sub: other, email: 'x@example.com', role: 'authenticated', aal: 'aal1', app_metadata: { provider: 'email' } });
    await assert.rejects(verifyIdToken(otherAal1), (err: unknown) => authCode(err) === 'auth/multi-factor-auth-required');
    const otherAal2 = await token({ sub: other, email: 'x@example.com', role: 'authenticated', aal: 'aal2', app_metadata: { provider: 'email' } });
    assert.equal((await verifyIdToken(otherAal2)).uid, other);
  });

  test('look users up by id or email (any case); unknown users are not found', async () => {
    const email = `Look-${crypto.randomBytes(3).toString('hex')}@Example.com`;
    const id = await addUser(email.toLowerCase(), true);
    assert.equal((await authAdmin.getUserByEmail(email)).uid, id);
    const byId = await authAdmin.getUser(id);
    assert.equal(byId.email, email.toLowerCase());
    assert.equal(byId.emailVerified, true);
    await assert.rejects(authAdmin.getUser(uid()), (err: unknown) => authCode(err) === 'auth/user-not-found');
    await assert.rejects(authAdmin.getUser('uid_legacy_firebase'), (err: unknown) => authCode(err) === 'auth/user-not-found');
    await assert.rejects(authAdmin.getUserByEmail('nobody@example.com'), (err: unknown) => authCode(err) === 'auth/user-not-found');
  });

  test('setCustomUserClaims replaces admin/role and keeps the sign-in provider', async () => {
    const id = await addUser(`claims-${crypto.randomBytes(3).toString('hex')}@example.com`, true);
    await authAdmin.setCustomUserClaims(id, { admin: true, role: 'admin' });
    let meta = (await getDb().pool.query('select raw_app_meta_data as m from auth.users where id = $1', [id])).rows[0].m;
    assert.deepEqual(meta, { provider: 'email', providers: ['email'], admin: true, role: 'admin' });

    await authAdmin.setCustomUserClaims(id, { admin: false });
    meta = (await getDb().pool.query('select raw_app_meta_data as m from auth.users where id = $1', [id])).rows[0].m;
    assert.deepEqual(meta, { provider: 'email', providers: ['email'], admin: false });

    await assert.rejects(authAdmin.setCustomUserClaims(id, { provider: 'google' }), (err: unknown) => authCode(err) === 'auth/invalid-claims');
  });

  test('revokeRefreshTokens ends every session; deleteUser removes the account', async () => {
    const id = await addUser(`bye-${crypto.randomBytes(3).toString('hex')}@example.com`, true);
    await getDb().pool.query('insert into auth.sessions (id, user_id) values ($1, $3), ($2, $3)', [uid(), uid(), id]);
    await authAdmin.revokeRefreshTokens(id);
    assert.equal((await getDb().pool.query('select count(*)::int as n from auth.sessions where user_id = $1', [id])).rows[0].n, 0);

    await authAdmin.deleteUser(id);
    await assert.rejects(authAdmin.getUser(id), (err: unknown) => authCode(err) === 'auth/user-not-found');
    await assert.rejects(authAdmin.deleteUser(id), (err: unknown) => authCode(err) === 'auth/user-not-found');
  });
});
