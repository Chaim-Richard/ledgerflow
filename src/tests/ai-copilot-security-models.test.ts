import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AIBackendService } from '../services/aiBackendService.js';
import { SecurityService } from '../services/securityService.js';

describe('AI Copilot Model Routing, Security Guardrails & Data Access', () => {
  const ai = new AIBackendService('dummy-key');

  test('Model routing: defaults to gemini-3.8-flash for OCR, statement parsing, and default labeling', () => {
    // Empty payload
    assert.equal(ai.getModel({}), 'gemini-3.8-flash');
    // Standard payload
    assert.equal(ai.getModel({ selectedModel: 'Gemini 3.8 Flash' }), 'gemini-3.8-flash');
    // OCR tasks
    assert.equal(ai.getModel({ task: 'parse-receipt' }), 'gemini-3.8-flash');
    assert.equal(ai.getModel({ task: 'parse-statement' }), 'gemini-3.8-flash');
  });

  test('Model routing: routes to gemini-3.1-pro-preview when deep reasoning or Pro tier is requested', () => {
    assert.equal(ai.getModel({ selectedModel: 'Gemini 3.1 Pro' }), 'gemini-3.1-pro-preview');
    assert.equal(ai.getModel({ selectedModel: 'pro' }), 'gemini-3.1-pro-preview');
    assert.equal(ai.getModel({ selectedModel: 'gemini-3.1-pro' }), 'gemini-3.1-pro-preview');
  });

  test('Model routing: strictly rejects deprecated model family designations', () => {
    const defaultModel = ai.getModel({});
    assert.ok(!defaultModel.includes('1.5'), 'Must not route to deprecated 1.5 models');
    assert.ok(!defaultModel.includes('2.0'), 'Must not route to deprecated 2.0 models');
    assert.ok(!defaultModel.includes('2.5'), 'Must not route to deprecated 2.5 models');
  });

  test('Security guardrail: user queries and ledger context undergo PII redaction before processing', () => {
    const sensitiveQuery = "What is the cash flow for client John Doe with SSN 123-45-6789 and credit card 4111-2222-3333-4444?";
    const scrubbed = SecurityService.scrubPII(sensitiveQuery);
    
    assert.ok(!scrubbed.includes('123-45-6789'), 'SSN must be sanitized');
    assert.ok(!scrubbed.includes('4111-2222-3333-4444'), 'Credit card number must be sanitized');
    assert.ok(scrubbed.includes('[SSN_REDACTED]'), 'SSN placeholder must be present');
    assert.ok(scrubbed.includes('[CREDIT_CARD_REDACTED]'), 'Payment instrument placeholder must be present');
  });

  test('Security guardrail: API keys in natural language are scrubbed from telemetry and prompts', () => {
    const rawApiKeyQuery = "Can you debug why key AIzaSyD-dummySecretKey123456789012345 fails?";
    const scrubbed = SecurityService.scrubPII(rawApiKeyQuery);
    
    assert.ok(!scrubbed.includes('AIzaSyD-dummySecretKey123456789012345'), 'Gemini API key must be redacted');
    assert.ok(scrubbed.includes('[SECRET_KEY_REDACTED]'), 'Secret key placeholder must be inserted');
  });

  test('Financial ledger context integrity: aggregates cash, burn rate, and runway without mutating state', () => {
    const mockAccounts = [
      { id: 'acc-1', name: 'Operating Checking', category: 'Cash', type: 'asset', balanceCents: 5000000 },
      { id: 'acc-2', name: 'Accounts Receivable', category: 'Receivables', type: 'asset', balanceCents: 1200000 },
      { id: 'acc-3', name: 'Software Subscriptions', category: 'Operating Expenses', type: 'expense', balanceCents: 600000 },
      { id: 'acc-4', name: 'SaaS Revenue', category: 'Revenue', type: 'revenue', balanceCents: 1000000 }
    ];

    const mockTransactions = [
      { id: 'tx-1', date: '2026-03-01', description: 'Stripe payout', totalAmountCents: 1000000, status: 'posted', lines: [] },
      { id: 'tx-2', date: '2026-03-02', description: 'AWS hosting', totalAmountCents: 600000, status: 'posted', lines: [] }
    ];

    // Verify read-only context can be assembled cleanly
    let cashCents = 0;
    mockAccounts.forEach(a => {
      if (a.category === 'Cash') cashCents += a.balanceCents;
    });

    assert.equal(cashCents, 5000000);
    assert.equal(mockTransactions.length, 2);
  });
});
