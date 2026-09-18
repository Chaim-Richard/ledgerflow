import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requirePlanCapacity, PLAN_LIMITS } from '../server/middleware/planCapacity';

describe('Server Plan Capacity Middleware (402 Payment Required Enforcement)', () => {
  it('correctly exports plan limits hierarchy', () => {
    assert.strictEqual(PLAN_LIMITS.free.transactions, 100);
    assert.strictEqual(PLAN_LIMITS.growth.transactions, 1000);
    assert.strictEqual(PLAN_LIMITS.pro.transactions, 10000);
  });

  it('rejects transaction creation with 402 when free workspace is at transaction cap', async () => {
    const mockReq = {
      body: { workspaceId: 'ws-free-cap-test' }
    } as any;

    const mockRes = {
      statusCode: 200,
      jsonBody: null as any,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: any) {
        this.jsonBody = body;
        return this;
      }
    } as any;

    let nextCalled = false;
    const next = () => { nextCalled = true; };

    const fakeDb = {
      collection: (col: string) => {
        if (col === 'workspaces') {
          return {
            doc: (id: string) => ({
              get: async () => ({
                exists: true,
                data: () => ({ plan: 'free', workspaceId: id })
              })
            })
          };
        }
        if (col === 'transactions') {
          return {
            where: () => ({
              get: async () => ({
                size: 100
              })
            })
          };
        }
        return {};
      }
    };

    const middleware = requirePlanCapacity('transactions', fakeDb);
    await middleware(mockReq, mockRes, next);
    
    assert.strictEqual(mockRes.statusCode, 402);
    assert.strictEqual(mockRes.jsonBody.code, 'PLAN_CAPACITY_EXCEEDED');
    assert.strictEqual(mockRes.jsonBody.cap, 100);
    assert.strictEqual(mockRes.jsonBody.current, 100);
    assert.strictEqual(nextCalled, false);
  });

  it('uses native count aggregation when available without scanning collections', async () => {
    const mockReq = {
      body: { workspaceId: 'ws-free-cap-count-test' }
    } as any;

    const mockRes = {
      statusCode: 200,
      jsonBody: null as any,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: any) {
        this.jsonBody = body;
        return this;
      }
    } as any;

    let nextCalled = false;
    const next = () => { nextCalled = true; };

    let countCalled = false;
    let fullScanCalled = false;

    const fakeDbWithCount = {
      collection: (col: string) => {
        if (col === 'workspaces') {
          return {
            doc: (id: string) => ({
              get: async () => ({
                exists: true,
                data: () => ({ plan: 'free', workspaceId: id })
              })
            })
          };
        }
        if (col === 'transactions') {
          return {
            where: () => ({
              count: () => {
                countCalled = true;
                return {
                  get: async () => ({
                    data: () => ({ count: 100 })
                  })
                };
              },
              get: async () => {
                fullScanCalled = true;
                return { size: 100 };
              }
            })
          };
        }
        return {};
      }
    };

    const middleware = requirePlanCapacity('transactions', fakeDbWithCount);
    await middleware(mockReq, mockRes, next);

    assert.strictEqual(mockRes.statusCode, 402);
    assert.strictEqual(mockRes.jsonBody.code, 'PLAN_CAPACITY_EXCEEDED');
    assert.strictEqual(countCalled, true, 'Should use count() aggregation');
    assert.strictEqual(fullScanCalled, false, 'Must NOT perform full scan get() when count() is available');
    assert.strictEqual(nextCalled, false);
  });

  it('rejects member invitation with 402 when free workspace is at seat cap', async () => {
    const mockReq = {
      params: { workspaceId: 'ws-seat-cap-test' }
    } as any;

    const mockRes = {
      statusCode: 200,
      jsonBody: null as any,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: any) {
        this.jsonBody = body;
        return this;
      }
    } as any;

    let nextCalled = false;
    const next = () => { nextCalled = true; };

    const fakeDb = {
      collection: (col: string) => {
        if (col === 'workspaces') {
          return {
            doc: (id: string) => ({
              get: async () => ({
                exists: true,
                data: () => ({ plan: 'free', members: ['user-1'] })
              })
            })
          };
        }
        return {};
      }
    };

    const middleware = requirePlanCapacity('seats', fakeDb);
    await middleware(mockReq, mockRes, next);

    assert.strictEqual(mockRes.statusCode, 402);
    assert.strictEqual(mockRes.jsonBody.code, 'SEAT_CAPACITY_EXCEEDED');
    assert.strictEqual(mockRes.jsonBody.cap, 1);
    assert.strictEqual(mockRes.jsonBody.current, 1);
    assert.strictEqual(nextCalled, false);
  });
});
