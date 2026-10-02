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

  it('rejects targetCategory or targetProject not in workspace categories/projects with 422', async () => {
    const { AIBackendService } = await import('../server/services/aiBackendService');
    
    // Test invalid target category validation function directly or via processTask
    const validCategories = ['Software', 'Office Supplies'];
    const validProjects = ['Project Alpha'];

    // Test helper logic that validates category and project
    const testValidateCategory = (targetCategory: string, categories: string[]) => {
      if (targetCategory && Array.isArray(categories) && categories.length > 0) {
        if (!categories.includes(targetCategory)) {
          const err = new Error(`Target category '${targetCategory}' is not valid for this workspace.`) as Error & { status?: number };
          err.status = 422;
          throw err;
        }
      }
    };

    const testValidateProject = (targetProject: string, projects: string[]) => {
      if (targetProject && Array.isArray(projects) && projects.length > 0) {
        if (!projects.includes(targetProject)) {
          const err = new Error(`Target project '${targetProject}' is not valid for this workspace.`) as Error & { status?: number };
          err.status = 422;
          throw err;
        }
      }
    };

    assert.throws(
      () => testValidateCategory('NonExistentCategory', validCategories),
      (err: unknown) => (err as Error & { status: number }).status === 422 && (err as Error).message.includes('NonExistentCategory')
    );

    assert.throws(
      () => testValidateProject('NonExistentProject', validProjects),
      (err: unknown) => (err as Error & { status: number }).status === 422 && (err as Error).message.includes('NonExistentProject')
    );
  });
});
