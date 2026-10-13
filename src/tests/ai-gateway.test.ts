/** The AI gateway (strategic review): only declared fields reach the model; every call is traced and priced from the table. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_TASK_FIELDS, allowedPayload, tracedClient, type AiCallTrace } from '../server/services/aiGateway';

test('a task sends only its declared fields; an unknown task sends nothing', () => {
  const payload = { query: 'cash?', context: 'x', workspaceId: 'ws1', secretNotes: 'do not send', transactions: [1] };
  assert.deepEqual(allowedPayload('parse-query', payload), { query: 'cash?', context: 'x' });
  assert.deepEqual(allowedPayload('nope', payload), {});
  assert.ok(Object.values(AI_TASK_FIELDS).every(fields => !fields.includes('workspaceId')), 'ids never go to the model');
});

test('each model call is recorded with tokens, measured time and the table price; failures too', async () => {
  let clock = 1000;
  const fake = { models: { generateContent: async (req: { model: string }) => {
    clock += 250;
    if (req.model === 'broken') throw new Error('down');
    return { text: '{}', usageMetadata: { promptTokenCount: 1_000_000, candidatesTokenCount: 1_000_000 } };
  } }, other: 'kept' };
  const traces: AiCallTrace[] = [];
  const client = tracedClient(fake, traces, () => clock)!;
  await client.models.generateContent({ model: 'gemini-2.5-flash' });
  await client.models.generateContent({ model: 'unpriced-model' });
  await assert.rejects(client.models.generateContent({ model: 'broken' }), /down/);
  assert.equal(client.other, 'kept');
  assert.deepEqual(traces, [
    { model: 'gemini-2.5-flash', inputTokens: 1_000_000, outputTokens: 1_000_000, ms: 250, costCents: 280, ok: true },
    { model: 'unpriced-model', inputTokens: 1_000_000, outputTokens: 1_000_000, ms: 250, ok: true },
    { model: 'broken', inputTokens: 0, outputTokens: 0, ms: 250, ok: false },
  ]);
  assert.equal(tracedClient(null, traces), null);
});
