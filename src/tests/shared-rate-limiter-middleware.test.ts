import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SharedRateLimiter, sharedRateLimitMiddleware } from '../server/middleware/sharedRateLimiter';
import type { Firestore } from '../server/db/firestore';

test('S-01 middleware refuses requests if the rate-limit database is unavailable', async () => {
  const unavailable = {
    runTransaction: async () => { throw new Error('simulated database outage'); },
  } as unknown as Firestore;
  const limiter = new SharedRateLimiter({ windowMs: 60_000, max: 5, keyPrefix: 'unavailable-test' }, unavailable);
  const app = express();
  let reached = false;
  app.get('/protected', sharedRateLimitMiddleware(limiter, req => String(req.ip || 'unknown')), (_req, res) => {
    reached = true;
    res.json({ ok: true });
  });
  const server: Server = app.listen(0, '127.0.0.1');
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/protected`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'RATE_LIMIT_UNAVAILABLE');
    assert.equal(reached, false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
