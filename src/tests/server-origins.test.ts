/** Which browser origins may call the API (CORS + CSRF) and which port the server uses (F-01). */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createOriginCheck, isAiStudioProxy, resolvePort } from '../server/http/origins';

describe('createOriginCheck', () => {
  const allowed = createOriginCheck({
    APP_URL: 'https://books.example.com/',
    ALLOWED_ORIGINS: 'https://partner.example.org, https://other.example.net',
    VERCEL_URL: 'ledgerflow-abc.vercel.app',
  });

  test('allows the app, listed origins, this Vercel deployment and local development', () => {
    for (const origin of [
      'https://books.example.com',
      'https://partner.example.org',
      'https://other.example.net',
      'https://ledgerflow-abc.vercel.app',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://192.168.1.20:3000',
      '',
    ]) assert.equal(allowed(origin), true, origin);
  });

  test('refuses other sites, look-alikes and other Vercel apps', () => {
    for (const origin of [
      'https://evil.example.com',
      'https://books.example.com.evil.io',
      'https://someone-else.vercel.app',
      'http://localhost.evil.io',
      'http://172.32.0.1:3000',
    ]) assert.equal(allowed(origin), false, origin);
  });
});

describe('port', () => {
  test('PORT from the host; the AI Studio proxy uses DEFAULT_APP_PORT', () => {
    assert.equal(resolvePort({ PORT: '8081' }), 8081);
    assert.equal(resolvePort({}), 3000);
    assert.equal(isAiStudioProxy({ NGINX_PORT: '8080' }), true);
    assert.equal(resolvePort({ NGINX_PORT: '8080', PORT: '8080', DEFAULT_APP_PORT: '3001' }), 3001);
  });
});
