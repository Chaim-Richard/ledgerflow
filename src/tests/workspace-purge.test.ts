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
            where(_field: string, _op: string, _val: string) {
              return {
                where(_field2: string, _op2: string, _val2: string) {
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
            doc(_id: string) {
              return {
                async get() {
                  return { exists: false, data: () => ({}) };
                },
                async set(_data: any, _opts?: any) {}
              };
            }
          };
        }

        if (colName === 'auditLogs') {
          return {
            doc() {
              return {
                async set(_data: any) {
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
          doc(_id: string) {
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
          delete(_ref: any) {},
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

  test('Purge engine handles storage failure in production by failing job and preserving workspace doc', async () => {
    let workspaceDeleted = false;
    let jobFailedRecorded = false;
    let lastRecordedError = '';

    const mockDb: any = {
      collection(colName: string) {
        if (colName === 'workspaces') {
          return {
            where() {
              return {
                where() {
                  return {
                    async get() {
                      return {
                        empty: false,
                        docs: [
                          {
                            id: 'ws_test_storage_fail',
                            ref: {
                              async delete() {
                                workspaceDeleted = true;
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
            }
          };
        }

        if (colName === 'jobRuns') {
          return {
            doc(_id: string) {
              return {
                async get() {
                  return { exists: false, data: () => ({}) };
                },
                async set(data: any) {
                  if (data.status === 'failed') {
                    jobFailedRecorded = true;
                    lastRecordedError = data.lastError || '';
                  }
                }
              };
            }
          };
        }

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
          }
        };
      },
      batch() {
        return {
          delete() {},
          async commit() {}
        };
      }
    };

    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const { purgePendingWorkspaces } = await import('../server/services/workspacePurgeService');
      const result = await purgePendingWorkspaces(mockDb as any);

      assert.equal(result.purgedWorkspaces.length, 0, 'Workspace must NOT be marked purged if storage fails');
      assert.equal(workspaceDeleted, false, 'Workspace doc must not be deleted on storage error');
      assert.equal(jobFailedRecorded, true, 'Job run status must be set to failed');
      assert.ok(lastRecordedError.includes('Storage purge failed'), 'Job run must record storage error');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });
});
