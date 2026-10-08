/**
 * Ask the books, verified (DA-03): a question in words becomes typed filters (which accounts, which
 * label, which dates), shown to the person so they can see and change what was understood. The figure
 * is never produced here: the server calculates it with the same code as "explain this number" (N-12,
 * `GET /api/v1/reports/explain`), on the full history, posted entries only, in the workspace's
 * currency, under the person's own access; and the entries behind it are listed.
 *
 * The reading is plain matching, no AI and no guessing: account names, label values (their code,
 * description or aliases), and a few ways of saying a period ("last year", "this month", "in March
 * 2026", "Q1 2026", "2025"). An account with sub-accounts takes them in. Words like "spend" or
 * "income" without an account mean all expense or all income accounts. Anything it can't place is
 * said, never filled in.
 */
import type { ChartAccount, DimensionDefinition, DimensionNode } from '../types';
import { getFiscalYearBounds } from './fiscalCalendar';

export interface AskFilter {
  accountIds: string[];
  startDate: string;
  endDate: string;
  label?: { dimensionId: string; value: string };
}

export interface AskReading {
  filter: AskFilter | null;
  /** what was understood, in words, for each part */
  understood: { accounts: string[]; label: string | null; period: string };
  /** whether the answer reads as money out (expenses), money in (income) or the books' sign */
  sense: 'spent' | 'earned' | 'net';
  /** what could not be placed (the filter is null when it stops the answer) */
  problem: string | null;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const SHORT = MONTHS.map(m => m.slice(0, 3));

const norm = (s: string) => s.normalize('NFC').toLocaleLowerCase().replace(/[֑-ׇ]/g, '').replace(/[^\p{L}\p{N}%&' ]+/gu, ' ').replace(/\s+/g, ' ').trim();
/** whole words of `needle` inside `hay` (both normalized) */
const has = (hay: string, needle: string) => needle.length > 0 && ` ${hay} `.includes(` ${needle} `);

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const month = (y: number, m: number) => ({ startDate: `${y}-${pad(m)}-01`, endDate: `${y}-${pad(m)}-${pad(lastDay(y, m))}` });

/** The period a question names, or this fiscal year so far (said as such). */
export function readPeriod(text: string, today: string, fiscalYearStartMonth = 1): { startDate: string; endDate: string; said: string } {
  const q = norm(text);
  const [y, m] = today.split('-').map(Number);
  const fy = (date: string) => getFiscalYearBounds(date, fiscalYearStartMonth);
  const calendar = fiscalYearStartMonth === 1;
  if (/\blast (fiscal )?year\b/.test(q)) {
    // the fiscal year holding the day before this one starts
    const [sy, sm] = fy(today).startDate.split('-').map(Number);
    const b = fy(sm === 1 ? `${sy - 1}-12-31` : `${sy}-${pad(sm - 1)}-${pad(lastDay(sy, sm - 1))}`);
    return { ...b, said: `last ${calendar ? '' : 'fiscal '}year (${b.startDate} to ${b.endDate})` };
  }
  if (/\bthis (fiscal )?year\b|\byear to date\b|\bytd\b/.test(q)) {
    const b = fy(today);
    return { startDate: b.startDate, endDate: today, said: `this ${calendar ? '' : 'fiscal '}year so far (${b.startDate} to ${today})` };
  }
  if (/\blast month\b/.test(q)) {
    const r = m === 1 ? month(y - 1, 12) : month(y, m - 1);
    return { ...r, said: `last month (${r.startDate} to ${r.endDate})` };
  }
  if (/\bthis month\b/.test(q)) {
    const r = month(y, m);
    return { startDate: r.startDate, endDate: today, said: `this month so far (${r.startDate} to ${today})` };
  }
  const quarter = q.match(/\bq([1-4]) (\d{4})\b/);
  if (quarter) {
    const [qn, qy] = [Number(quarter[1]), Number(quarter[2])];
    const r = { startDate: month(qy, qn * 3 - 2).startDate, endDate: month(qy, qn * 3).endDate };
    return { ...r, said: `Q${qn} ${qy} (${r.startDate} to ${r.endDate})` };
  }
  const named = q.match(new RegExp(`\\b(${[...MONTHS, ...SHORT].join('|')}) (\\d{4})\\b`));
  if (named) {
    const mi = (MONTHS.indexOf(named[1]) >= 0 ? MONTHS.indexOf(named[1]) : SHORT.indexOf(named[1])) + 1;
    const r = month(Number(named[2]), mi);
    return { ...r, said: `${MONTHS[mi - 1][0].toUpperCase()}${MONTHS[mi - 1].slice(1)} ${named[2]} (${r.startDate} to ${r.endDate})` };
  }
  const year = q.match(/\b(19|20)(\d{2})\b/);
  if (year) {
    const yy = Number(year[1] + year[2]);
    const r = { startDate: `${yy}-01-01`, endDate: `${yy}-12-31` };
    return { ...r, said: `${yy} (${r.startDate} to ${r.endDate})` };
  }
  const b = fy(today);
  return { startDate: b.startDate, endDate: today, said: `this ${calendar ? '' : 'fiscal '}year so far (${b.startDate} to ${today}), as no period was named` };
}

const SPEND = /\b(spend|spent|spending|cost|costs|expense|expenses|paid|pay for)\b/;
const EARN = /\b(earn|earned|income|revenue|revenues|sales|sold|made)\b/;

export function readQuestion(text: string, ctx: { accounts: ChartAccount[]; dimensions?: DimensionDefinition[]; nodes?: DimensionNode[]; today: string; fiscalYearStartMonth?: number }): AskReading {
  const q = norm(text);
  const period = readPeriod(text, ctx.today, ctx.fiscalYearStartMonth);
  const live = ctx.accounts.filter(a => !a.isArchived);

  // the label first, so its words are not read as an account (a property called "Ocean" vs an account)
  let label: AskFilter['label'];
  let labelSaid: string | null = null;
  let rest = q;
  const dims = new Map((ctx.dimensions || []).map(d => [d.id, d]));
  const candidates = (ctx.nodes || []).filter(n => n.status !== 'archived' && dims.has(n.dimensionId))
    .flatMap(n => [n.description, n.id, ...(n.aliases || [])].filter(Boolean).map(say => ({ node: n, say: norm(String(say)) })))
    .filter(c => c.say.length >= 2)
    .sort((a, b) => b.say.length - a.say.length);
  const hit = candidates.find(c => has(q, c.say));
  if (hit) {
    label = { dimensionId: hit.node.dimensionId, value: hit.node.id };
    labelSaid = `${dims.get(hit.node.dimensionId)?.name || hit.node.dimensionId} = ${hit.node.description || hit.node.id}`;
    rest = ` ${q} `.replace(` ${hit.say} `, ' ').trim();
  }

  // accounts named in the question, the longest names first; one inside a longer one is not counted twice
  const named: ChartAccount[] = [];
  let left = ` ${rest} `;
  for (const a of [...live].sort((x, y) => norm(y.name).length - norm(x.name).length)) {
    const n = norm(a.name);
    if (n.length >= 3 && left.includes(` ${n} `)) { named.push(a); left = left.replace(` ${n} `, ' '); }
  }
  const sense: AskReading['sense'] = SPEND.test(q) ? 'spent' : EARN.test(q) ? 'earned' : 'net';
  let chosen = named;
  if (chosen.length === 0 && sense !== 'net') {
    const type = sense === 'spent' ? ['expense', 'cost_of_goods'] : ['income'];
    chosen = live.filter(a => type.includes(String(a.type).toLowerCase()));
  }
  // an account takes in its sub-accounts
  const ids = new Set(chosen.map(a => a.id));
  for (let grew = true; grew;) {
    grew = false;
    for (const a of live) if (a.parentId && ids.has(a.parentId) && !ids.has(a.id)) { ids.add(a.id); grew = true; }
  }
  const accounts = named.length > 0 ? named.map(a => a.name) : chosen.length > 0 ? [sense === 'spent' ? 'all expense accounts' : 'all income accounts'] : [];
  const understood = { accounts, label: labelSaid, period: period.said };
  if (ids.size === 0) return { filter: null, understood, sense, problem: 'Name an account (as it is called in the chart of accounts), or ask about spending or income' };
  const hasLabelWords = (ctx.dimensions || []).some(d => has(q, norm(d.name)));
  return {
    filter: { accountIds: [...ids], startDate: period.startDate, endDate: period.endDate, ...(label ? { label } : {}) },
    understood, sense,
    problem: !label && hasLabelWords ? 'A label was named, but none of its values: the answer is for every value' : null,
  };
}

/** The answer in the sense of the question: money out positive for spending, money in positive for income. */
export const answerCents = (totalCents: number, sense: AskReading['sense']) => (sense === 'earned' ? -totalCents : totalCents);
