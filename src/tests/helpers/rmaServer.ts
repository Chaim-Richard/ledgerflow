/**
 * ISS-143: a stand-in for POST /api/v1/workspaces/:ws/return-authorizations in screen tests. It records each call
 * and answers as the server does: a new RMA (requested, numbered) for a request, or the next status for an action.
 * Other calls (the store's reads, other panels' writes) get 200 with no body, like stubFetchWithBodies.
 */
import { createReturnAuthorization, transitionReturnAuthorization, type ReturnAuthorizationRecord } from '../../lib/warehouseRecords';

export interface RmaCall { url: string; method: string; body: Record<string, unknown> | null }

export function stubRmaServer(options: {
  workspaceId: string;
  /** the invoice line as the server reads it */
  line: (invoiceLineId: string) => { itemId: string; description: string; soldQuantity: number };
  customerName?: string;
  invoiceNumber?: string;
  /** answer every call with this status and message instead */
  refuse?: { status: number; message: string };
  records?: ReturnAuthorizationRecord[];
}): RmaCall[] {
  const calls: RmaCall[] = [];
  let n = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null;
    calls.push({ url, method: String(init?.method || 'GET'), body });
    const json = (status: number, data: unknown) => new Response(data === null ? 'null' : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (options.refuse) return json(options.refuse.status, { status: 'error', message: options.refuse.message });
    const match = /\/return-authorizations(?:\/([^/?]+))?$/.exec(url.split('?')[0]);
    if (!match || !body) return json(200, null);
    if (!match[1]) {
      n += 1;
      const record = createReturnAuthorization({
        id: `rma_test${n}`, number: `RMA-2026-TESTTESTTE${String(n).padStart(2, '2')}`, workspaceId: options.workspaceId,
        customerId: String(body.customerId), customerName: options.customerName || 'Customer', invoiceId: String(body.invoiceId),
        invoiceNumber: options.invoiceNumber || String(body.invoiceId), reason: String(body.reason),
        lines: (body.lines as Array<{ invoiceLineId: string; quantity: number }>).map(l => ({ ...l, ...options.line(l.invoiceLineId) })),
        actor: { uid: 'test-user', name: 'Test', role: 'owner' }, at: new Date().toISOString(),
      });
      options.records?.push(record);
      return json(200, { status: 'success', record, replayed: false });
    }
    const record = options.records?.find(r => r.id === decodeURIComponent(match[1]));
    if (!record) return json(404, { status: 'error', message: 'That RMA is not this customer\'s' });
    const moved = transitionReturnAuthorization(record, { type: body.action as 'approve', ...(body.note ? { note: String(body.note) } : {}) } as never, { uid: 'approver', name: 'Approver', role: 'owner' }, new Date().toISOString());
    return moved.ok ? json(200, { status: 'success', record: moved.record, replayed: false }) : json(409, { status: 'error', message: moved.reason });
  }) as typeof fetch;
  return calls;
}
