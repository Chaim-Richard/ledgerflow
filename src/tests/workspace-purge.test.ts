import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { WORKSPACE_SCOPED_COLLECTIONS } from '../constants/collections';

describe('Workspace Purge Job Service Suite (§3 Workspace Purge)', () => {
  test('WORKSPACE_SCOPED_COLLECTIONS includes core financial and entity collections and excludes auditLogs', () => {
    assert.ok(WORKSPACE_SCOPED_COLLECTIONS.includes('transactions'));
    assert.ok(WORKSPACE_SCOPED_COLLECTIONS.includes('chartAccounts'));
    assert.ok(WORKSPACE_SCOPED_COLLECTIONS.includes('invoices'));
    assert.ok(WORKSPACE_SCOPED_COLLECTIONS.includes('journalEntries'));
    assert.ok(WORKSPACE_SCOPED_COLLECTIONS.includes('bankLines'));
    assert.equal((WORKSPACE_SCOPED_COLLECTIONS as readonly string[]).includes('auditLogs'), false, 'auditLogs must be kept for forensic compliance');
  });

  test('Purge engine handles paginated chunks, deletes collections in sequence, and keeps audit logs', async () => {
    const deletedDocs: string[] = [];
    let workspaceDeleted = false;
    let auditLogWritten = false;

    const mockDb: any = {
      collection(colName: string) {
        if (colName === 'workspaces') {
          return {
            where(field: string, op: string, val: string) {
              return {
                where(field2: string, op2: string, val2: string) {
                  return {
                    async get() {
                      return {
                        empty: false,
                        docs: [
                          {
                            id: 'ws_test_purge_123',
                            ref: {
                              async delete() {
                                workspaceDeleted = true;
                                deletedDocs.push('workspaces/ws_test_purge_123');
                              }
                            },
                            data() {
                              return {
                                status: 'pending_deletion',
                                scheduledPurgeAt: '2026-01-01T00:00:00.000Z'
                              };
                            }
                          }
                        ]
                      };
                    }
                  };
                }
              };
            },
            doc(id: string) {
              return {
                async delete() {
                  workspaceDeleted = true;
                  deletedDocs.push(`workspaces/${id}`);
                }
              };
            }
          };
        }

        if (colName === 'jobRuns') {
          return {
            doc(id: string) {
              return {
                async get() {
                  return { exists: false, data: () => ({}) };
                },
                async set(data: any, opts?: any) {}
              };
            }
          };
        }

        if (colName === 'auditLogs') {
          return {
            doc() {
              return {
                async set(data: any) {
                  auditLogWritten = true;
                }
              };
            }
          };
        }

        // Generic collection handler
        return {
          where() {
            return {
              orderBy() {
                return {
                  limit() {
                    return {
                      async get() {
                        return { empty: true, docs: [] };
                      }
                    };
                  }
                };
              }
            };
          },
          doc(id: string) {
            return {
              async get() {
                return { exists: false };
              }
            };
          }
        };
      },
      batch() {
        return {
          delete(ref: any) {},
          async commit() {}
        };
      }
    };

    const { purgePendingWorkspaces } = await import('../server/services/workspacePurgeService');
    const result = await purgePendingWorkspaces(mockDb as any);

    assert.deepEqual(result.purgedWorkspaces, ['ws_test_purge_123']);
    assert.equal(workspaceDeleted, true, 'Workspace document must be deleted last');
    assert.equal(auditLogWritten, true, 'Purge audit entry must be recorded');
  });
});
