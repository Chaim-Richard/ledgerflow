import test from 'node:test';
import assert from 'node:assert/strict';
import { safeRequestTarget } from '../server/http/safeRequestTarget';

test('request logs never retain query credentials, even on invalid URLs', () => {
  assert.equal(safeRequestTarget('/api/v1/email-events?token=example-secret&workspaceId=abc'), '/api/v1/email-events');
  assert.equal(safeRequestTarget('/api/v1/reports?workspaceId=abc&token=secret#fragment'), '/api/v1/reports');
  assert.equal(safeRequestTarget('/api/health'), '/api/health');
  assert.equal(safeRequestTarget('?token=only'), '/');
});

test('private invite and invoice link tokens are redacted from path segments', () => {
  assert.equal(safeRequestTarget('/api/v1/invites/private-invite?other=1'), '/api/v1/invites/[redacted]');
  assert.equal(safeRequestTarget('/api/v1/invoices/public/access-token'), '/api/v1/invoices/public/[redacted]');
  assert.equal(safeRequestTarget('/i/pay_ab123abc?x=2'), '/i/[redacted]');
  assert.equal(safeRequestTarget('/api/v1/workspaces/ws-1/invoices'), '/api/v1/workspaces/ws-1/invoices');
});
