import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectRouteSource, inventoryMarkdown } from '../../scripts/idempotency-route-inventory';

test('S-05: route declaration discovered, but no automatic idempotency certification', () => {
  const routes = inspectRouteSource(
    "router.post('/api/v1/payments', async (req, res) => { await savePayment(req.body); res.sendStatus(200); });",
    'sample.ts',
  );
  assert.equal(routes.length, 1);
  assert.deepEqual([routes[0].method, routes[0].route, routes[0].evidence],
    ['POST', '/api/v1/payments', 'not-visible']);
  assert.match(inventoryMarkdown(routes), /not proof/);
});

test('S-05: visible helper is only a review lead', () => {
  const routes = inspectRouteSource(
    "router.post('/api/v1/transactions', async () => { await executeIdempotent('id'); });",
    'sample.ts',
  );
  assert.equal(routes[0].evidence, 'visible-helper-call');
  assert.match(routes[0].note, /review operation identity/);
});

test('S-05: nested route methods included; arbitrary function calls excluded', () => {
  const routes = inspectRouteSource(
    "router.get('/read', noop); router.patch('/edit', handler); router.delete('/clear', handler);",
    'sample.ts',
  );
  assert.deepEqual(routes.map(r => r.method), ['PATCH', 'DELETE']);
});
