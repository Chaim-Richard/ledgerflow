/**
 * Load test (C-20): seeds one workspace with many entries in a local database and measures what
 * opening the books costs: the paged query the app runs for the newest 20,000 entries (1,000 rows
 * a request), one page after another and four at a time, the size of what comes back, the report
 * maths in the browser on those rows, and the same balances worked out by the database over every
 * entry. Prints a Markdown table; `--write` puts it in docs/perf.md. The workspace is removed after.
 *
 *   LF_TEST_DATABASE_URL=postgresql://postgres@localhost:55432/lf_ci npx tsx scripts/load-test.ts [count] [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { balancesAsOf } from '../src/lib/closingSnapshot';
import { runDataChecks } from '../src/lib/dataChecks';
import type { ChartAccount, Transaction } from '../src/types';

const url = process.env.LF_TEST_DATABASE_URL;
if (!url) { console.error('Set LF_TEST_DATABASE_URL to a local test database'); process.exit(1); }
const count = Number(process.argv.find(a => /^\d+$/.test(a)) || 200_000);
const write = process.argv.includes('--write');
const CAP = 20_000;
const PAGE = 1_000;

const pool = new pg.Pool({ connectionString: url, max: 6 });
const ws = `ws_load_${crypto.randomBytes(4).toString('hex')}`;
const ms = (start: bigint) => Number(process.hrtime.bigint() - start) / 1e6;
const round = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10);

async function seed() {
  const accounts = Array.from({ length: 25 }, (_, i) => ({ id: `${ws}_a${i}`, code: String(1000 + i * 100), name: `Account ${i}`, type: i < 5 ? 'asset' : i < 8 ? 'liability' : i < 10 ? 'equity' : i < 15 ? 'revenue' : 'expense', category: i === 0 ? 'Cash' : 'Other' }));
  for (const a of accounts) {
    await pool.query('insert into public."chartAccounts" (id, data) values ($1, $2)', [a.id, JSON.stringify({ ...a, workspaceId: ws, uid: 'load', balanceCents: 0 })]);
  }
  const started = process.hrtime.bigint();
  // one statement, generated in the database: dates over five years, two lines each, balanced
  await pool.query(`
    insert into public.transactions (id, data)
    select $1 || '_t' || g,
      jsonb_build_object(
        'workspaceId', $1::text, 'uid', 'load', 'status', 'completed', 'currency', 'USD',
        'date', to_char(date '2022-01-01' + (g % 1826), 'YYYY-MM-DD'),
        'description', 'Entry ' || g, 'totalAmountCents', 100 + (g * 37) % 99900,
        'lines', jsonb_build_array(
          jsonb_build_object('accountId', $1 || '_a0', 'amountCents', -(100 + (g * 37) % 99900)),
          jsonb_build_object('accountId', $1 || '_a' || (10 + g % 15), 'amountCents', 100 + (g * 37) % 99900)))
    from generate_series(1, $2::int) g`, [ws, count]);
  await pool.query('analyze public.transactions');
  return { accounts, seedMs: ms(started) };
}

const pageSql = `select id, data::text as data, updated_at from public.transactions
  where workspace_id = $1 and (data->>'date') is not null order by data->>'date' desc offset $2 limit $3`;

async function pagesOneByOne() {
  const started = process.hrtime.bigint();
  const rows: Array<{ id: string; data: string }> = [];
  const pageTimes: number[] = [];
  for (let from = 0; rows.length < CAP; from += PAGE) {
    const t = process.hrtime.bigint();
    const { rows: page } = await pool.query(pageSql, [ws, from, PAGE]);
    pageTimes.push(ms(t));
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return { rows, totalMs: ms(started), firstMs: pageTimes[0], lastMs: pageTimes[pageTimes.length - 1], requests: pageTimes.length };
}

async function pagesFourAtATime() {
  const started = process.hrtime.bigint();
  const rows: Array<{ id: string; data: string }> = [];
  for (let from = 0; rows.length < CAP;) {
    const wave = [0, 1, 2, 3].map(i => from + i * PAGE).filter(f => f < CAP);
    const pages = await Promise.all(wave.map(f => pool.query(pageSql, [ws, f, PAGE]).then(r => r.rows)));
    for (const p of pages) rows.push(...p);
    from += wave.length * PAGE;
    if (pages.some(p => p.length < PAGE)) break;
  }
  return { rows, totalMs: ms(started) };
}

async function main() {
  console.log(`Seeding ${count.toLocaleString('en-US')} entries into ${ws}…`);
  const { accounts, seedMs } = await seed();
  try {
    const one = await pagesOneByOne();
    const four = await pagesFourAtATime();
    const bytes = one.rows.reduce((s, r) => s + r.data.length + r.id.length, 0);
    let t = process.hrtime.bigint();
    const parsed = one.rows.map(r => ({ ...JSON.parse(r.data), id: r.id })) as Transaction[];
    const parseMs = ms(t);
    const chart = accounts.map(a => ({ ...a, workspaceId: ws, uid: 'load', balanceCents: 0 })) as unknown as ChartAccount[];
    t = process.hrtime.bigint();
    balancesAsOf(chart, parsed, '2099-12-31');
    const balancesMs = ms(t);
    t = process.hrtime.bigint();
    runDataChecks({ transactions: parsed, accounts: chart, invoices: [], bills: [], recurring: [], today: '2026-10-07', baseCurrency: 'USD' });
    const checksMs = ms(t);
    t = process.hrtime.bigint();
    await pool.query(`select l->>'accountId' as account, sum((l->>'amountCents')::bigint) as cents
      from public.transactions, jsonb_array_elements(data->'lines') l where workspace_id = $1 group by 1`, [ws]);
    const sqlBalancesMs = ms(t);

    const table = [
      `# Load test (C-20)`,
      ``,
      `Measured ${new Date().toISOString().slice(0, 10)} on the local test database (PostgreSQL 16, no network), one workspace with ${count.toLocaleString('en-US')} entries (two lines each) and 25 accounts. Run it again with \`LF_TEST_DATABASE_URL=… npx tsx scripts/load-test.ts ${count} --write\`.`,
      ``,
      `| What | Result |`,
      `| --- | --- |`,
      `| Seeding ${count.toLocaleString('en-US')} entries (one SQL statement) | ${round(seedMs / 1000)} s |`,
      `| The app's query for the newest ${CAP.toLocaleString('en-US')} entries, ${PAGE.toLocaleString('en-US')} a request, one after another | ${one.requests} requests, ${round(one.totalMs)} ms in the database (first page ${round(one.firstMs)} ms, last ${round(one.lastMs)} ms) |`,
      `| The same, four requests at a time | ${round(four.totalMs)} ms in the database |`,
      `| Size of those ${one.rows.length.toLocaleString('en-US')} rows | ${round(bytes / 1024 / 1024)} MB of JSON before compression |`,
      `| Reading them in the browser (JSON parse) | ${round(parseMs)} ms |`,
      `| Every account's balance from them (as the reports do) | ${round(balancesMs)} ms |`,
      `| All Data Health checks on them | ${round(checksMs)} ms |`,
      `| Every account's balance over all ${count.toLocaleString('en-US')} entries, worked out by the database | ${round(sqlBalancesMs)} ms |`,
      ``,
      `What it means:`,
      ``,
      `- Over the internet each request also waits for the round trip (about 50–150 ms to the hosted database). One after another, ${one.requests} requests add ${one.requests} round trips; four at a time, about ${Math.ceil(one.requests / 4)}. The app now asks four at a time.`,
      `- Later pages cost more in the database than the first (each skips the rows before it); at ${CAP.toLocaleString('en-US')} rows that stays small.`,
      `- The browser holds at most ${CAP.toLocaleString('en-US')} entries, newest first, and says so when there are more. Working every balance out in the database from all ${count.toLocaleString('en-US')} entries took ${round(sqlBalancesMs / 1000)} s in this run (a first run on a cold database takes several times longer; the lines sit inside each entry's JSON). Reports over a workspace this size should get their balances from the database instead of holding every entry in the browser (L-123).`,
      ``,
    ].join('\n');
    console.log(`\n${table}`);
    if (write) {
      fs.writeFileSync(path.resolve('docs/perf.md'), table);
      console.log('Written to docs/perf.md');
    }
  } finally {
    await pool.query('delete from public.transactions where workspace_id = $1', [ws]);
    await pool.query('delete from public."chartAccounts" where workspace_id = $1', [ws]);
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
