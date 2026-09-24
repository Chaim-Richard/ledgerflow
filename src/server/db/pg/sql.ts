/**
 * SQL for the Postgres Firestore layer: filters, ordering and cursors compiled to WHERE /
 * ORDER BY over the jsonb `data` column, and database errors translated to Firestore codes.
 */
import pg from 'pg';
import { DOCUMENT_ID, FirestoreError, encodeValue, invalid, isRefLike } from './values';
import type { OrderByDirection, WhereFilterOp } from './values';

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

export const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;
export const quoteLiteral = (text: string) => `'${text.replace(/'/g, "''")}'`;

/** data->'a'->'b' (jsonb) */
export function jsonExpr(segments: string[]): string {
  return `(data${segments.map(s => `->${quoteLiteral(s)}`).join('')})`;
}

/** data->'a'->>'b' (text); single fields match the (data->>'field') indexes. */
export function textExpr(segments: string[]): string {
  const head = segments.slice(0, -1).map(s => `->${quoteLiteral(s)}`).join('');
  return `(data${head}->>${quoteLiteral(segments[segments.length - 1])})`;
}

export class Params {
  readonly values: unknown[] = [];
  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

export const isIdField = (segments: string[]) => segments.length === 1 && segments[0] === DOCUMENT_ID;
export const isWorkspaceField = (segments: string[]) => segments.length === 1 && segments[0] === 'workspaceId';

export function jsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'string': return 'string';
    default: return 'object';
  }
}

export function queryValue(value: unknown): unknown {
  if (isRefLike(value)) return value.id;
  return encodeValue(value, new Date().toISOString());
}

export function asList(value: unknown, op: string): unknown[] {
  if (!Array.isArray(value)) throw invalid(`'${op}' filters need an array value`);
  return value.map(queryValue);
}

export interface Filter { segments: string[]; op: WhereFilterOp; value: unknown }
export interface Order { segments: string[]; direction: OrderByDirection }
export interface Cursor { values: unknown[]; inclusive: boolean }
export interface QuerySpec {
  filters: Filter[];
  orders: Order[];
  limit?: number;
  offset?: number;
  startCursor?: Cursor;
  endCursor?: Cursor;
}

export function compileFilter(f: Filter, p: Params): string {
  const { segments, op } = f;
  if (isIdField(segments)) {
    const idOf = (v: unknown) => (isRefLike(v) ? v.id : String(v));
    switch (op) {
      case '==': return `id = ${p.add(idOf(f.value))}`;
      case '!=': return `id <> ${p.add(idOf(f.value))}`;
      case '<': case '<=': case '>': case '>=': return `id ${op} ${p.add(idOf(f.value))}`;
      case 'in': return `id = any(${p.add(asList(f.value, op).map(idOf))}::text[])`;
      case 'not-in': return `not (id = any(${p.add(asList(f.value, op).map(idOf))}::text[]))`;
      default: throw invalid(`'${op}' is not supported on the document id`);
    }
  }
  const j = jsonExpr(segments);
  const t = textExpr(segments);
  const value = f.value === undefined ? undefined : queryValue(f.value);
  if (value === undefined && op !== 'in' && op !== 'not-in' && op !== 'array-contains-any') {
    throw invalid(`Filter on "${segments.join('.')}" has an undefined value`);
  }
  switch (op) {
    case '==':
      if (value === null) return `${j} = 'null'::jsonb`;
      if (typeof value === 'string') {
        return isWorkspaceField(segments)
          ? `workspace_id = ${p.add(value)}`
          : `(${t} = ${p.add(value)} and jsonb_typeof(${j}) = 'string')`;
      }
      return `${j} = ${p.add(JSON.stringify(value))}::jsonb`;
    case '!=':
      return `(${j} is not null and ${j} <> 'null'::jsonb and ${j} <> ${p.add(JSON.stringify(value))}::jsonb)`;
    case '<': case '<=': case '>': case '>=':
      if (typeof value === 'string') return `(jsonb_typeof(${j}) = 'string' and ${t} ${op} ${p.add(value)})`;
      return `(jsonb_typeof(${j}) = '${jsonType(value)}' and ${j} ${op} ${p.add(JSON.stringify(value))}::jsonb)`;
    case 'in': {
      const list = asList(f.value, op);
      if (list.length === 0) return 'false';
      if (list.every(v => typeof v === 'string')) {
        return isWorkspaceField(segments)
          ? `workspace_id = any(${p.add(list)}::text[])`
          : `(${t} = any(${p.add(list)}::text[]) and jsonb_typeof(${j}) = 'string')`;
      }
      return `${j} = any(${p.add(list.map(v => JSON.stringify(v)))}::jsonb[])`;
    }
    case 'not-in': {
      const list = asList(f.value, op);
      if (list.length === 0) return `(${j} is not null and ${j} <> 'null'::jsonb)`;
      return `(${j} is not null and ${j} <> 'null'::jsonb and not (${j} = any(${p.add(list.map(v => JSON.stringify(v)))}::jsonb[])))`;
    }
    case 'array-contains':
      return `(jsonb_typeof(${j}) = 'array' and ${j} @> ${p.add(JSON.stringify([value]))}::jsonb)`;
    case 'array-contains-any': {
      const list = asList(f.value, op);
      if (list.length === 0) return 'false';
      return `(jsonb_typeof(${j}) = 'array' and exists (select 1 from jsonb_array_elements(${p.add(JSON.stringify(list))}::jsonb) e where ${j} @> jsonb_build_array(e)))`;
    }
    default:
      throw invalid(`Unsupported filter operator '${op}'`);
  }
}

/** The effective order: the explicit orderBy fields, then the document id. */
export function effectiveOrders(spec: QuerySpec): Order[] {
  const orders = [...spec.orders];
  if (!orders.some(o => isIdField(o.segments))) {
    const last = orders[orders.length - 1];
    orders.push({ segments: [DOCUMENT_ID], direction: last ? last.direction : 'asc' });
  }
  return orders;
}

/** Lexicographic cursor condition over the order keys (Firestore startAt/startAfter/endAt/endBefore). */
export function compileCursor(cursor: Cursor, orders: Order[], isStart: boolean, p: Params): string {
  const keys = orders.slice(0, cursor.values.length);
  if (keys.length === 0) return 'true';
  const exprs = keys.map((o, i) => {
    const raw = cursor.values[i];
    if (isIdField(o.segments)) {
      return { expr: 'id', param: p.add(isRefLike(raw) ? raw.id : String(raw)), cast: '', o };
    }
    const value = queryValue(raw);
    return { expr: jsonExpr(o.segments), param: p.add(JSON.stringify(value === undefined ? null : value)), cast: '::jsonb', o };
  });
  const terms: string[] = [];
  for (let i = 0; i < exprs.length; i++) {
    const parts: string[] = [];
    for (let k = 0; k < i; k++) parts.push(`${exprs[k].expr} = ${exprs[k].param}${exprs[k].cast}`);
    const { expr, param, cast, o } = exprs[i];
    const forward = (o.direction === 'asc') === isStart;
    const last = i === exprs.length - 1;
    const cmp = forward ? (last && cursor.inclusive ? '>=' : '>') : (last && cursor.inclusive ? '<=' : '<');
    parts.push(`${expr} ${cmp} ${param}${cast}`);
    terms.push(`(${parts.join(' and ')})`);
  }
  return `(${terms.join(' or ')})`;
}

export function compileWhere(spec: QuerySpec, p: Params): string {
  const clauses = spec.filters.map(f => compileFilter(f, p));
  for (const o of spec.orders) {
    if (!isIdField(o.segments)) clauses.push(`${jsonExpr(o.segments)} is not null`);
  }
  const orders = effectiveOrders(spec);
  if (spec.startCursor) clauses.push(compileCursor(spec.startCursor, orders, true, p));
  if (spec.endCursor) clauses.push(compileCursor(spec.endCursor, orders, false, p));
  return clauses.length ? ` where ${clauses.join(' and ')}` : '';
}

export function compileOrder(spec: QuerySpec): string {
  const parts = effectiveOrders(spec).map(o =>
    `${isIdField(o.segments) ? 'id' : jsonExpr(o.segments)} ${o.direction === 'desc' ? 'desc' : 'asc'}`);
  return ` order by ${parts.join(', ')}`;
}

export function compileLimit(spec: QuerySpec): string {
  let sql = '';
  if (spec.limit !== undefined) sql += ` limit ${spec.limit}`;
  if (spec.offset !== undefined) sql += ` offset ${spec.offset}`;
  return sql;
}

// ---------------------------------------------------------------------------
// Running statements
// ---------------------------------------------------------------------------

export interface DocRow { id: string; data: string; created_at: Date; updated_at: Date }

export interface Runner {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]): Promise<pg.QueryResult<R>>;
}

export function translateError(err: unknown, context: string): unknown {
  if (err instanceof FirestoreError) return err;
  if (err instanceof pg.DatabaseError) {
    switch (err.code) {
      case '40001':
      case '40P01':
        return new FirestoreError(10, `${context}: the transaction conflicted with another write; please retry`, { cause: err });
      case '23505':
        return new FirestoreError(6, `${context}: document already exists`, { cause: err });
      case '22P02':
      case '22023':
      case '23514':
      case '54000':
        return new FirestoreError(3, `${context}: ${err.message}`, { cause: err });
      case '42501':
        return new FirestoreError(7, `${context}: ${err.message}`, { cause: err });
      case '57P01':
      case '57P03':
      case '08000':
      case '08003':
      case '08006':
        return new FirestoreError(14, `${context}: database unavailable (${err.message})`, { cause: err });
      default:
        return new FirestoreError(13, `${context}: ${err.message}`, { cause: err });
    }
  }
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && /^(ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE)/.test(code)) {
    return new FirestoreError(14, `${context}: database unavailable (${code})`, { cause: err });
  }
  return err;
}

export const COLLECTION_ID = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;


const RETRYABLE_SQLSTATES = new Set(['40001', '40P01']);

export function isRetryable(err: unknown): boolean {
  if (err instanceof FirestoreError) {
    const cause = err.cause;
    return err.code === 10 && cause instanceof pg.DatabaseError && RETRYABLE_SQLSTATES.has(cause.code || '');
  }
  return err instanceof pg.DatabaseError && RETRYABLE_SQLSTATES.has(err.code || '');
}

