import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadAttachmentLinkIndex,
  queryAttachmentLinkIndexPage,
  type AttachmentIndexClient,
  type AttachmentIndexQueryBuilder,
} from '../services/attachmentActions';

interface CallLog {
  table: string;
  columns: string;
  eq: Array<[string, string]>;
  included: Array<[string, string[]]>;
  order?: [string, { ascending: boolean }];
  range?: [number, number];
}

function fakeClient(rows: unknown[], error: { message?: string } | null = null): { client: AttachmentIndexClient; calls: CallLog[] } {
  const calls: CallLog[] = [];
  const client: AttachmentIndexClient = {
    from(table: string) {
      const call: CallLog = { table, columns: '', eq: [], included: [] };
      calls.push(call);
      const builder = {
        select(columns: string) { call.columns = columns; return builder; },
        eq(column: string, value: string) { call.eq.push([column, value]); return builder; },
        in(column: string, values: string[]) { call.included.push([column, values]); return builder; },
        order(column: string, options: { ascending: boolean }) { call.order = [column, options]; return builder; },
        range(from: number, to: number) {
          call.range = [from, to];
          return Promise.resolve({ data: rows, error });
        },
        then(onfulfilled?: (value: { data: unknown; error: { message?: string } | null }) => unknown, onrejected?: (reason: unknown) => unknown) {
          return Promise.resolve({ data: rows, error }).then(onfulfilled, onrejected);
        },
      };
      return builder as unknown as AttachmentIndexQueryBuilder;
    },
  };
  return { client, calls };
}

test('attachment index selects only link metadata and applies workspace/collection filters in the database query', async () => {
  const { client, calls } = fakeClient([
    { id: 'f1', linkedId: 'bill-1', linkedCollection: 'bills', name: 'receipt.pdf', createdAt: '2026-01-01', fileUrl: 'data:large-file' },
    { id: 'wrong', linkedId: 'invoice-1', linkedCollection: 'invoices', fileUrl: 'data:ignored' },
    { id: 'bad', linkedId: null, linkedCollection: 'bills' },
  ]);
  const rows = await queryAttachmentLinkIndexPage(client, 'workspace-A', ['bills'], 0, 999);
  assert.deepEqual(rows, [{ id: 'f1', linkedId: 'bill-1', linkedCollection: 'bills', name: 'receipt.pdf', createdAt: '2026-01-01' }]);
  assert.equal(calls[0].table, 'documents');
  assert.match(calls[0].columns, /linkedId:data->>linkedId/);
  assert.match(calls[0].columns, /name:data->>name/);
  assert.doesNotMatch(calls[0].columns, /fileUrl/);
  assert.deepEqual(calls[0].eq, [['workspace_id', 'workspace-A']]);
  assert.deepEqual(calls[0].included, [['data->>linkedCollection', ['bills']]]);
  assert.deepEqual(calls[0].order, ['id', { ascending: true }]);
  assert.deepEqual(calls[0].range, [0, 999]);
});

test('the configured metadata cap is reported as incomplete, not an empty complete index', async () => {
  const { client, calls } = fakeClient([
    { id: 'f1', linkedId: 'b1', linkedCollection: 'bills' },
    { id: 'f2', linkedId: 'b2', linkedCollection: 'bills' },
  ]);
  const index = await loadAttachmentLinkIndex('workspace-A', ['bills'], client, 2);
  assert.equal(index.rows.length, 2);
  assert.equal(index.truncated, true);
  assert.deepEqual(calls[0].range, [0, 1]);
});

test('a short page is complete and database errors are surfaced', async () => {
  const empty = fakeClient([{ id: 'f1', linkedId: 'b1', linkedCollection: 'bills' }]);
  const complete = await loadAttachmentLinkIndex('workspace-A', ['bills'], empty.client, 2);
  assert.equal(complete.truncated, false);
  const failed = fakeClient([], { message: 'permission denied' });
  await assert.rejects(() => queryAttachmentLinkIndexPage(failed.client, 'workspace-A', ['bills'], 0, 999), /permission denied/);
});
