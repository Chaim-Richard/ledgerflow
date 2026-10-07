/**
 * LedgerFlow API client (Z-06): a small, dependency-free TypeScript client for the public API, for
 * scripts and integrations (Node 18+ or a browser). Pass an API key ("<keyId>.<secret>" from
 * Developer → API keys). It follows list pages for you, sends an Idempotency-Key with every create
 * so a retried request never creates twice, waits and retries when the key's limit a minute is
 * reached (429), and turns refusals into a LedgerFlowError with the status and the server's message.
 *
 *   const lf = new LedgerFlowClient({ apiKey: process.env.LEDGERFLOW_KEY!, baseUrl: 'https://your-app' });
 *   for await (const entry of lf.listTransactions(workspaceId, { startDate: '2026-01-01' })) { … }
 *   const { ids } = await lf.createTransactions(workspaceId, [entryA, entryB]);
 */
export interface LedgerLine { accountId: string; accountName?: string; amountCents: number; description?: string }
export interface LedgerEntry {
  id?: string;
  workspaceId?: string;
  date: string;
  description?: string;
  currency?: string;
  status?: string;
  lines: LedgerLine[];
  updatedAt?: unknown;
  [field: string]: unknown;
}

export interface ClientOptions {
  apiKey: string;
  /** The app's address, e.g. https://ledgerflow.example.com (default: same origin). */
  baseUrl?: string;
  /** How many times to wait and retry after a 429 (default 3). */
  maxRetries?: number;
  fetch?: typeof fetch;
  /** For tests: how to wait between retries. */
  sleep?: (ms: number) => Promise<void>;
}

export class LedgerFlowError extends Error {
  constructor(readonly status: number, message: string, readonly body: unknown) { super(message); this.name = 'LedgerFlowError'; }
}

const randomKey = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export class LedgerFlowClient {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: ClientOptions) {
    if (!options.apiKey || !options.apiKey.includes('.')) throw new Error('Pass the whole API key: "<keyId>.<secret>"');
    this.base = (options.baseUrl || '').replace(/\/+$/, '');
    this.fetchImpl = options.fetch || globalThis.fetch.bind(globalThis);
    this.maxRetries = options.maxRetries ?? 3;
    this.sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  }

  private async request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers: { 'X-API-Key': this.options.apiKey, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (res.status === 429 && attempt < this.maxRetries) {
        const seconds = Number(res.headers.get('retry-after') || res.headers.get('ratelimit-reset') || 1);
        await this.sleep(Math.max(1, Number.isFinite(seconds) ? seconds : 1) * 1000);
        continue;
      }
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) throw new LedgerFlowError(res.status, String(data.message || data.error || `Request failed (${res.status})`), data);
      return data as T;
    }
  }

  /** Every entry in the workspace (newest first), page after page; `fields` keeps only those fields. */
  async *listTransactions(workspaceId: string, query: { startDate?: string; endDate?: string; accountId?: string; fields?: string[]; pageSize?: number } = {}): AsyncGenerator<LedgerEntry> {
    let cursor: string | null = null;
    do {
      const params = new URLSearchParams({ workspaceId, limit: String(query.pageSize || 100) });
      if (query.startDate) params.set('startDate', query.startDate);
      if (query.endDate) params.set('endDate', query.endDate);
      if (query.accountId) params.set('accountId', query.accountId);
      if (query.fields?.length) params.set('fields', query.fields.join(','));
      if (cursor) params.set('cursor', cursor);
      const page = await this.request<{ transactions: LedgerEntry[]; nextCursor: string | null }>('GET', `/api/v1/transactions?${params}`);
      for (const entry of page.transactions || []) yield entry;
      cursor = page.nextCursor;
    } while (cursor);
  }

  /** One entry; its lines must add up to zero. Safe to retry: the same Idempotency-Key is reused. */
  async createTransaction(workspaceId: string, entry: LedgerEntry): Promise<LedgerEntry> {
    const res = await this.request<{ data: LedgerEntry }>('POST', '/api/v1/transactions', { transaction: { ...entry, workspaceId } }, { 'Idempotency-Key': randomKey() });
    return res.data;
  }

  /** Up to 500 entries, all or none; their ids in the order given. */
  async createTransactions(workspaceId: string, entries: LedgerEntry[]): Promise<{ created: number; ids: string[] }> {
    const res = await this.request<{ data: { created: number; ids: string[] } }>('POST', '/api/v1/transactions/batch-create', { workspaceId, transactions: entries }, { 'Idempotency-Key': randomKey() });
    return res.data;
  }

  /** Change fields of an entry (not its lines or date); with `ifUpdatedAt`, refused (412) if it changed since. */
  async updateTransaction(id: string, changes: Record<string, unknown>, options: { ifUpdatedAt?: string } = {}): Promise<void> {
    await this.request('PUT', `/api/v1/transactions/${encodeURIComponent(id)}`, { partialUpdate: changes }, options.ifUpdatedAt ? { 'If-Match': `"${options.ifUpdatedAt}"` } : {});
  }

  /** Delete a draft entry (a posted one is voided instead). */
  async deleteTransaction(id: string): Promise<void> {
    await this.request('DELETE', `/api/v1/transactions/${encodeURIComponent(id)}`);
  }
}
