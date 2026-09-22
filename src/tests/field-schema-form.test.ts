import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

describe('Field and SchemaForm Component Suite (Shortcut 7)', () => {
  it('Zod schema field inference works correctly for string, number, and enum types', () => {
    const TestSchema = z.object({
      name: z.string().min(1, 'Name is required'),
      amount: z.number().positive('Amount must be positive'),
      type: z.enum(['INVOICE', 'BILL', 'JOURNAL']),
      notes: z.string().optional()
    });

    const sampleValid = {
      name: 'Test Customer',
      amount: 1500,
      type: 'INVOICE',
      notes: 'Some notes'
    };

    const parsed = TestSchema.safeParse(sampleValid);
    assert.ok(parsed.success, 'Valid schema object should parse successfully');

    const sampleInvalid = {
      name: '',
      amount: -10,
      type: 'INVALID_ENUM'
    };

    const invalidParse = TestSchema.safeParse(sampleInvalid);
    assert.equal(invalidParse.success, false, 'Invalid object should fail Zod validation');
  });
});
