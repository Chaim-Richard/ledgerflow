import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { csrfProtection } from '../server/middleware/csrf';
import { emailWebhookRouter } from '../server/routes/emailRoutes';

test('external email callback reaches its credential check, while other API routes retain CSRF protection', async () => {
  const app = express();
  app.use(csrfProtection({ isAllowedOrigin: () => false, ignoredPaths: [/^\/api\/v1\/email-events\/?$/] }));
  app.use(express.json());
  app.use('/api/v1/email-events', emailWebhookRouter);
  app.post('/api/v1/workspaces', (_req, res) => res.status(204).end());

  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const root = `http://127.0.0.1:${address.port}`;
  try {
    const options = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' };
    const webhook = await fetch(`${root}/api/v1/email-events`, options);
    assert.equal(webhook.status, 401, 'callback is rejected by its credential check, not by CSRF');
    const regular = await fetch(`${root}/api/v1/workspaces`, options);
    assert.equal(regular.status, 403, 'ordinary writes still require CSRF protection');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
