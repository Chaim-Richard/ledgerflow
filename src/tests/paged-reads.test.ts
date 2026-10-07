/**
 * Long lists are read a few pages at a time (C-20): the first page alone, then up to four at once,
 * in the right order, nothing twice, stopping at the limit or the last short page; rows with the
 * same date keep one order on every page (the id decides).
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { collection, getDocs, getFirestore, limit, orderBy, query, where } from '../lib/db/firestore';

function fakeClient(rows: Array<{ id: string; date: string; ws: string }>) {
  let inFlight = 0;
  const stats = { requests: 0, mostAtOnce: 0, ranges: [] as Array<[number, number]> };
  const builder = () => {
    const conds: Array<(r: typeof rows[number]) => boolean> = [];
    const orders: Array<{ key: (r: typeof rows[number]) => string; asc: boolean }> = [];
    const b = {
      eq(c: string, v: unknown) { if (c === 'data->>workspaceId') conds.push(r => r.ws === v); return b; },
      not() { return b; },
      order(c: string, o: { ascending: boolean }) { orders.push({ key: c === 'id' ? r => r.id : r => r.date, asc: o.ascending }); return b; },
      async range(from: number, to: number) {
        stats.requests++;
        stats.ranges.push([from, to]);
        inFlight++;
        stats.mostAtOnce = Math.max(stats.mostAtOnce, inFlight);
        await new Promise(r => setTimeout(r, 5));
        inFlight--;
        const sorted = rows.filter(r => conds.every(fn => fn(r))).sort((x, y) => {
          for (const o of orders) { const a = o.key(x); const z = o.key(y); if (a !== z) return (a < z ? -1 : 1) * (o.asc ? 1 : -1); }
          return 0;
        });
        return { data: sorted.slice(from, to + 1).map(r => ({ id: r.id, data: { workspaceId: r.ws, date: r.date }, updated_at: '2026-10-07T00:00:00Z' })), error: null };
      },
    };
    return b;
  };
  const client = { from: () => ({ select: () => builder() }) };
  return { db: getFirestore(() => client as unknown as SupabaseClient), stats };
}

const many = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${String(i).padStart(5, '0')}`, date: `2026-${String(1 + (i % 12)).padStart(2, '0')}-01`, ws: 'w' }));

describe('Paged reads', () => {
  test('9,500 rows: the first page, then four at a time; all rows once, newest first, ties by id', async () => {
    const { db, stats } = fakeClient(many(9_500));
    const snap = await getDocs(query(collection(db, 'transactions'), where('workspaceId', '==', 'w'), orderBy('date', 'desc')));
    assert.equal(snap.docs.length, 9_500);
    assert.equal(new Set(snap.docs.map(d => d.id)).size, 9_500);
    const keys = snap.docs.map(d => `${(d.data() as { date: string }).date}|${d.id}`);
    assert.ok(keys.every((k, i) => i === 0 || keys[i - 1].slice(0, 10) > k.slice(0, 10) || (keys[i - 1].slice(0, 10) === k.slice(0, 10) && keys[i - 1] < k)));
    assert.equal(stats.requests, 1 + 4 + 4 + 4, 'page 1, then three waves of four (the last wave reaches past the end and stops)');
    assert.equal(stats.mostAtOnce, 4);
  });

  test('a limit is kept: 2,500 of 9,500 in three requests; a short list in one', async () => {
    const big = fakeClient(many(9_500));
    const snap = await getDocs(query(collection(big.db, 'transactions'), where('workspaceId', '==', 'w'), orderBy('date', 'desc'), limit(2_500)));
    assert.equal(snap.docs.length, 2_500);
    assert.deepEqual(big.stats.ranges, [[0, 999], [1000, 1999], [2000, 2499]]);
    const small = fakeClient(many(300));
    assert.equal((await getDocs(query(collection(small.db, 'transactions'), where('workspaceId', '==', 'w')))).docs.length, 300);
    assert.equal(small.stats.requests, 1);
  });
});
