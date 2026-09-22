import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AutoRuleSchema } from '../schemas';

describe('AutoRule Schema & Security Guard Suite (Prompt D)', () => {
  it('valid AutoRule object passes validation', () => {
    const validRule = {
      name: 'Categorize Software Expenses',
      condition: {
        vendor: 'GitHub',
        descriptionContains: 'GITHUB'
      },
      action: {
        targetCategory: 'Software Subscriptions',
        targetClass: 'Administrative'
      },
      isActive: true,
      createdBy: 'ai'
    };

    const res = AutoRuleSchema.safeParse(validRule);
    assert.ok(res.success, 'Valid AutoRule should pass validation');
  });

  it('AutoRule object with unknown action or extra keys fails strict validation', () => {
    const invalidActionRule = {
      name: 'Malicious Rule',
      condition: { vendor: 'Malicious Vendor' },
      action: {
        targetCategory: 'Software',
        unknownActionKey: 'evil_payload'
      }
    };

    const resAction = AutoRuleSchema.safeParse(invalidActionRule);
    assert.equal(resAction.success, false, 'Unknown action keys should be rejected by strict schema');

    const invalidTopLevelRule = {
      name: 'Extra Property Rule',
      condition: { vendor: 'GitHub' },
      action: { targetCategory: 'Software' },
      extraProperty: 'should_fail'
    };

    const resTop = AutoRuleSchema.safeParse(invalidTopLevelRule);
    assert.equal(resTop.success, false, 'Extra top-level keys should be rejected by strict schema');
  });
});
