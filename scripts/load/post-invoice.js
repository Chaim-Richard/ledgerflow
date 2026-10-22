/**
 * Load test: posting an invoice (BP-06). This is the write path that must not degrade quietly: the
 * server builds the entries, checks the role and the closing date, and commits the document and its
 * entries in one database transaction (`POST /api/v1/documents/:type/:id/post`, L-94 step 2).
 *
 *   k6 run -e WORKSPACE_ID=… -e LOAD_EMAIL=… -e LOAD_PASSWORD=… scripts/load/post-invoice.js
 *
 * Each iteration posts a NEW invoice (its own id and idempotency key), so the run adds records to the
 * workspace it names. Point it at a test workspace you can throw away — never at real books.
 *
 * The fixture is the one the server tests use (src/tests/l94-step2-document-post.test.ts):
 *   2 × 150.00 = 300.00 + 10% tax 30.00 = 330.00 → A/R +330.00, Sales −300.00, VAT −30.00
 */
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, WORKSPACE_ID, authHeaders, loadOptions, requireSetup, signIn } from './lib.js';

export const options = loadOptions(5, '60s', {
  // a save the person is waiting for; the database is local to the server in a normal deployment
  'http_req_duration{name:post-invoice}': ['p(95)<2000'],
  'http_req_failed{name:post-invoice}': ['rate<0.01'],
});

export function setup() {
  requireSetup();
  return { token: signIn(http) };
}

let counter = 0;

function invoice(id) {
  return {
    id,
    workspaceId: WORKSPACE_ID,
    number: `LOAD-${id}`,
    customerName: 'Load Test Customer',
    customerId: 'load-customer',
    date: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    status: 'sent',
    currency: 'USD',
    amountCents: 33_000,
    taxAmountCents: 3_000,
    taxRate: 10,
    items: [{ id: 'l1', description: 'Hours', quantity: 2, rateCents: 15_000, amountCents: 30_000 }],
  };
}

export default function (data) {
  // unique per virtual user and iteration: a repeated id would be an update, not a create
  const id = `load-${__VU}-${__ITER}-${Date.now()}-${counter++}`;
  const response = http.post(
    `${BASE_URL}/api/v1/documents/invoices/${id}/post`,
    JSON.stringify({ workspaceId: WORKSPACE_ID, action: 'create', data: invoice(id) }),
    {
      headers: { ...authHeaders(data.token), 'Idempotency-Key': `load-${id}` },
      tags: { name: 'post-invoice' },
    },
  );
  check(response, {
    'posted (200)': r => r.status === 200,
    'the entries came back': r => Array.isArray(r.json('transactions')),
  });
}
