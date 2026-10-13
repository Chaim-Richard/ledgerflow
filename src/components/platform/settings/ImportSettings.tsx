import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Download, FileUp, History, Loader2, Undo2, Upload } from 'lucide-react';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useCurrentRole } from '../../../hooks/useCurrentRole';
import { db, getIdToken } from '../../../firebase';
import { collection, getDocs, limit, orderBy, query, where } from '../../../lib/db/firestore';
import { parseCsv } from '../../../lib/csv';
import { parseExcelToRows } from '../../../lib/excelExport';
import { cn, formatCurrency, getLocalDateISO } from '../../../lib/utils';
import {
  IMPORT_DEFINITIONS, IMPORT_KINDS, MAX_IMPORT_ROWS, applyMapping, guessMapping, openingStockCents, prepareImport,
} from '../../../lib/recordImport';
import type { FieldMapping, ImportIssue, ImportKind } from '../../../lib/recordImport';
import { downloadCsv } from '../../../lib/csvExport';
import { normalizeFreshBooksCsv } from '../../../lib/freshBooksImport';
import { normalizeQuickBooksCsv } from '../../../lib/quickBooksCsvImport';

type CsvSource = 'generic' | 'freshbooks' | 'quickbooks';
const normalizeSourceTable = (source: CsvSource, kind: ImportKind, cells: string[][]): string[][] =>
  source === 'freshbooks' ? normalizeFreshBooksCsv(kind, cells) :
  source === 'quickbooks' ? normalizeQuickBooksCsv(kind, cells) : cells;

/**
 * Settings → Import data (K-01): customers, vendors, items or accounts from a CSV or Excel file.
 * The file is read in the browser, columns are matched by header name (changeable), every row is
 * checked with the same rules the server uses (src/lib/recordImport.ts), and the server saves
 * all rows at once or none. Recent imports can be undone.
 */

interface ImportResult {
  batchId: string | null;
  created: number;
  skipped: ImportIssue[];
  openingStockCents: number;
  dryRun: boolean;
}

interface RecentImport {
  batchId: string;
  description: string;
  timestamp: string;
}

const KIND_HELP: Record<ImportKind, string> = {
  customers: 'Name, email, phone, address, tax ID, terms…',
  vendors: 'Name, email, phone, category, 1099…',
  items: 'Name, SKU, price, cost, quantity on hand…',
  accounts: 'Name, code, type (asset, bank, income…)',
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = await getIdToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || 'The request failed') as Error & { issues?: ImportIssue[] };
    if (Array.isArray(data.details) && data.details.every((d: unknown) => typeof (d as ImportIssue)?.row === 'number')) error.issues = data.details;
    throw error;
  }
  return data as T;
}

async function loadRecentImports(workspaceId: string): Promise<RecentImport[]> {
  if (!workspaceId) return [];
  try {
    const snap = await getDocs(query(collection(db, 'auditLogs'), where('workspaceId', '==', workspaceId), where('action', '==', 'records_imported'), orderBy('timestamp', 'desc'), limit(8)));
    return snap.docs.map(d => {
      const data = d.data();
      return { batchId: String(data.entityId || ''), description: String(data.details?.description || 'Import'), timestamp: String(data.timestamp || '') };
    }).filter(r => r.batchId.startsWith('imp_'));
  } catch {
    return [];
  }
}

function downloadSample(kind: ImportKind) {
  downloadCsv(`${kind}-import-template.csv`, IMPORT_DEFINITIONS[kind].fields.map(f => f.label), []);
}

export default function ImportSettings() {
  const workspaceId = useAuthStore(s => s.currentWorkspaceId) || '';
  const role = useCurrentRole();
  const canImport = role !== 'viewer';
  const canImportAccounts = role === 'owner' || role === 'accountant';

  const [kind, setKind] = useState<ImportKind>('customers');
  const [source, setSource] = useState<CsvSource>('generic');
  const [fileName, setFileName] = useState('');
  const [rawTable, setRawTable] = useState<string[][]>([]);
  const table = useMemo(() => normalizeSourceTable(source, kind, rawTable), [kind, source, rawTable]);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [openingDate, setOpeningDate] = useState(() => getLocalDateISO());
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [serverIssues, setServerIssues] = useState<ImportIssue[]>([]);
  const [recent, setRecent] = useState<RecentImport[]>([]);
  const [recentVersion, setRecentVersion] = useState(0);

  const definition = IMPORT_DEFINITIONS[kind];
  const columns = useMemo(() => (table[0] || []).map((name, position) => ({ name, position })), [table]);
  const rows = useMemo(() => applyMapping(kind, table.slice(1), mapping), [kind, table, mapping]);
  const prepared = useMemo(() => prepareImport(kind, rows), [kind, rows]);
  const stockCents = kind === 'items' ? openingStockCents(prepared.records) : 0;
  const issues = serverIssues.length > 0 ? serverIssues : prepared.errors;
  const tooMany = rows.length > MAX_IMPORT_ROWS;
  const ready = table.length > 1 && prepared.errors.length === 0 && prepared.records.length > 0 && !tooMany;

  useEffect(() => {
    let cancelled = false;
    loadRecentImports(workspaceId).then(list => { if (!cancelled) setRecent(list); });
    return () => { cancelled = true; };
  }, [workspaceId, recentVersion]);
  const loadRecent = () => setRecentVersion(v => v + 1);

  const resetResults = () => {
    setCheck(null);
    setResult(null);
    setServerIssues([]);
  };

  const chooseKind = (next: ImportKind) => {
    setKind(next);
    const preview = normalizeSourceTable(source, next, rawTable);
    setMapping(preview.length ? guessMapping(next, preview[0]) : {});
    resetResults();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    resetResults();
    try {
      const lower = file.name.toLowerCase();
      const cells = lower.endsWith('.xlsx')
        ? (await parseExcelToRows(await file.arrayBuffer())).map(r => r.map(c => (c === null || c === undefined ? '' : String(c).trim())))
        : parseCsv(await file.text());
      if (cells.length < 2) {
        toast.error('The file needs a header row and at least one row of data.');
        return;
      }
      setFileName(file.name);
      setRawTable(cells);
      const converted = normalizeSourceTable(source, kind, cells);
      setMapping(guessMapping(kind, converted[0]));
    } catch (err) {
      toast.error(`The file could not be read: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const send = async (dryRun: boolean) => {
    setBusy(true);
    setServerIssues([]);
    try {
      const body = { kind, rows, dryRun, ...(stockCents > 0 ? { openingDate } : {}) };
      const res = await post<ImportResult>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/import-records`, body);
      if (dryRun) {
        setCheck(res);
      } else {
        setResult(res);
        setCheck(null);
        setRawTable([]);
        setFileName('');
        toast.success(`Imported ${res.created} ${definition.label.toLowerCase()}${res.skipped.length ? ` (${res.skipped.length} already existed)` : ''}.`);
        loadRecent();
      }
    } catch (err) {
      const issuesFromServer = (err as { issues?: ImportIssue[] }).issues;
      if (issuesFromServer) setServerIssues(issuesFromServer);
      toast.error(err instanceof Error ? err.message : 'The import failed');
    } finally {
      setBusy(false);
    }
  };

  const undo = async (batchId: string) => {
    setBusy(true);
    try {
      const res = await post<{ removed: number; kept: string[] }>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/import-records/${encodeURIComponent(batchId)}/undo`, {});
      toast.success(`Removed ${res.removed} imported record${res.removed === 1 ? '' : 's'}${res.kept.length ? `; kept ${res.kept.length} already in use (${res.kept.slice(0, 3).join(', ')}${res.kept.length > 3 ? '…' : ''})` : ''}.`);
      if (result?.batchId === batchId) setResult(null);
      loadRecent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The import could not be undone');
    } finally {
      setBusy(false);
    }
  };

  if (!canImport) {
    return (
      <div className="ledger-card p-8 bg-[var(--surface)] border border-[var(--line)] rounded-2xl text-sm text-[var(--muted)]">
        Importing data needs the bookkeeper, accountant or owner role.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="ledger-card p-6 md:p-8 bg-[var(--surface)] border border-[var(--line)] shadow-sm rounded-2xl space-y-6" aria-labelledby="import-title">
        <div className="flex items-center gap-4 border-b border-[var(--line)] pb-5">
          <div className="w-12 h-12 bg-[var(--brass-soft)] border border-[var(--brass-line)] text-[var(--brass)] rounded-xl flex items-center justify-center">
            <Upload size={22} aria-hidden="true" />
          </div>
          <div>
            <h2 id="import-title" className="text-xl font-bold text-[var(--text)]">Import data</h2>
            <p className="text-xs text-[var(--muted)]">Bring in customers, vendors, items or your chart of accounts from a spreadsheet (CSV or Excel). Nothing is saved until every row is correct.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-xs font-bold flex flex-col gap-1">CSV source
            <select aria-label="CSV source" value={source} onChange={e => {
              const next: CsvSource = e.target.value === 'freshbooks' ? 'freshbooks' : e.target.value === 'quickbooks' ? 'quickbooks' : 'generic';
              setSource(next);
              const converted = normalizeSourceTable(next, kind, rawTable);
              setMapping(converted.length ? guessMapping(kind, converted[0]) : {});
              resetResults();
            }} className="min-h-11 border rounded px-3 bg-[var(--panel)] text-sm">
              <option value="generic">Standard spreadsheet / Wave</option><option value="freshbooks">FreshBooks CSV</option><option value="quickbooks">QuickBooks Online CSV</option>
            </select>
          </label>
          {source === 'freshbooks' && <p className="text-xs text-[var(--muted)]">Choose a FreshBooks Clients, Vendors, or Items export. We combine name and address columns for preview, then use the normal validated import. No transactions are imported. <a className="underline" href="https://support.freshbooks.com/hc/en-us/articles/360032628152-How-do-I-export-my-data" target="_blank" rel="noopener noreferrer">Export instructions</a>.</p>}
          {source === 'quickbooks' && <p className="text-xs text-[var(--muted)]">Choose a QuickBooks Online Account List, Customer Contact List, Vendor Contact List, or Products &amp; Services export. Put headers on the first row; review mappings and check before importing. Account balances, existing stock quantities and transactions are not carried over. <a className="underline" href="https://quickbooks.intuit.com/learn-support/en-us/help-article/list-management/export-reports-lists-data-quickbooks-online/L1xleDrLp_US_en_US" target="_blank" rel="noopener noreferrer">QBO export instructions</a>.</p>}
        </div>
        <fieldset className="space-y-3">
          <legend className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">1. What are you importing?</legend>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {IMPORT_KINDS.map(k => {
              const disabled = k === 'accounts' && !canImportAccounts;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  disabled={disabled}
                  title={disabled ? 'Only owners and accountants can change the chart of accounts' : undefined}
                  onClick={() => chooseKind(k)}
                  className={cn(
                    'text-left p-4 rounded-xl border transition-colors disabled:opacity-50',
                    kind === k ? 'border-[var(--brass)] bg-[var(--brass-soft)]' : 'border-[var(--line)] bg-[var(--panel)] hover:border-[var(--brass-line)]',
                  )}
                >
                  <span className="block font-bold text-sm text-[var(--text)]">{IMPORT_DEFINITIONS[k].label}</span>
                  <span className="block text-[11px] text-[var(--muted)] mt-1">{KIND_HELP[k]}</span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => downloadSample(kind)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brass)] hover:underline">
            <Download size={14} aria-hidden="true" /> Download an empty {definition.label.toLowerCase()} template
          </button>
        </fieldset>

        <div className="space-y-2">
          <label htmlFor="import-file" className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] block">2. Choose the file</label>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              id="import-file"
              type="file"
              accept=".csv,.txt,.xlsx,text/csv"
              onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }}
              className="text-sm text-[var(--text)] file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-[var(--line)] file:bg-[var(--panel)] file:text-[var(--text)]"
            />
            {fileName && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <FileUp size={14} aria-hidden="true" /> {fileName} · {table.length - 1} row{table.length === 2 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--muted)]">The first row must be the column names. Up to {MAX_IMPORT_ROWS} rows per file.</p>
        </div>

        {table.length > 1 && (
          <fieldset className="space-y-3">
            <legend className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">3. Match the columns</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {definition.fields.map(field => (
                <div key={field.key} className="space-y-1">
                  <label htmlFor={`map-${field.key}`} className="text-xs font-semibold text-[var(--text)]">
                    {field.label}{field.required ? ' *' : ''}
                  </label>
                  <select
                    id={`map-${field.key}`}
                    value={mapping[field.key] ?? -1}
                    onChange={e => { setMapping({ ...mapping, [field.key]: Number(e.target.value) }); resetResults(); }}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] text-sm text-[var(--text)]"
                  >
                    <option value={-1}>(not in the file)</option>
                    {columns.map(c => <option key={c.position} value={c.position}>{c.name || `Column ${c.position + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </fieldset>
        )}

        {table.length > 1 && (
          <div className="space-y-4" aria-live="polite">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">4. Check and import</h3>
            <p className="text-sm text-[var(--text)]">
              <strong>{prepared.records.length}</strong> row{prepared.records.length === 1 ? '' : 's'} ready
              {issues.length > 0 && <>, <strong className="text-[var(--neg)]">{new Set(issues.map(i => i.row)).size}</strong> with problems (fix them in the file and choose it again)</>}.
              {tooMany && <span className="text-[var(--neg)]"> The file has more than {MAX_IMPORT_ROWS} rows; split it.</span>}
            </p>

            {issues.length > 0 && (
              <div className="max-h-64 overflow-auto border border-[var(--line)] rounded-xl">
                <table className="w-full text-xs">
                  <caption className="sr-only">Rows with problems</caption>
                  <thead className="bg-[var(--panel)] text-[var(--muted)]">
                    <tr><th scope="col" className="text-left px-3 py-2">Row</th><th scope="col" className="text-left px-3 py-2">Problem</th></tr>
                  </thead>
                  <tbody>
                    {issues.slice(0, 200).map(issue => (
                      <tr key={`${issue.row}:${issue.field ?? ''}:${issue.message}`} className="border-t border-[var(--line)]">
                        <td className="px-3 py-1.5 font-mono">{issue.row}</td>
                        <td className="px-3 py-1.5 text-[var(--text)]"><AlertCircle size={12} className="inline mr-1 text-[var(--neg)]" aria-hidden="true" />{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {prepared.records.length > 0 && (
              <div className="overflow-auto border border-[var(--line)] rounded-xl">
                <table className="w-full text-xs">
                  <caption className="sr-only">First rows to import</caption>
                  <thead className="bg-[var(--panel)] text-[var(--muted)]">
                    <tr>
                      <th scope="col" className="text-left px-3 py-2">Row</th>
                      {definition.fields.filter(f => (mapping[f.key] ?? -1) >= 0).map(f => <th scope="col" key={f.key} className="text-left px-3 py-2">{f.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {prepared.records.slice(0, 5).map(record => (
                      <tr key={record.row} className="border-t border-[var(--line)]">
                        <td className="px-3 py-1.5 font-mono">{record.row}</td>
                        {definition.fields.filter(f => (mapping[f.key] ?? -1) >= 0).map(f => {
                          const value = record.data[f.key];
                          const shown = f.type === 'money' && typeof value === 'number' ? formatCurrency(value) : value === undefined ? '' : String(value);
                          return <td key={f.key} className="px-3 py-1.5 text-[var(--text)]">{shown}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {stockCents > 0 && (
              <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] space-y-2">
                <p className="text-xs text-[var(--text)]">
                  Opening stock worth <strong>{formatCurrency(stockCents)}</strong> (quantity × cost) will be recorded in the books:
                  Inventory is increased and Opening Balance Equity is credited, on this date.
                </p>
                <label htmlFor="opening-date" className="text-xs font-semibold text-[var(--text)] mr-2">Opening stock date</label>
                <input id="opening-date" type="date" value={openingDate} onChange={e => setOpeningDate(e.target.value)} className="px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-sm text-[var(--text)]" />
              </div>
            )}

            {check && (
              <p className="text-sm text-[var(--text)]">
                Check: {check.created} new {definition.label.toLowerCase()} will be added
                {check.skipped.length > 0 && <> and {check.skipped.length} skipped because they already exist ({check.skipped.slice(0, 3).map(s => s.message.replace(/ already exists$/, '')).join(', ')}{check.skipped.length > 3 ? '…' : ''})</>}.
              </p>
            )}

            <div className="flex gap-3 flex-wrap">
              <button type="button" disabled={!ready || busy} onClick={() => send(true)} className="px-4 py-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] text-sm font-semibold text-[var(--text)] disabled:opacity-50">
                Check against existing {definition.label.toLowerCase()}
              </button>
              <button type="button" disabled={!ready || busy} onClick={() => send(false)} className="px-4 py-2 rounded-lg bg-[var(--brass)] text-sm font-bold text-black disabled:opacity-50 inline-flex items-center gap-2">
                {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                Import {prepared.records.length} {definition.label.toLowerCase()}
              </button>
            </div>
          </div>
        )}

        {result && result.batchId && (
          <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] flex items-start justify-between gap-4 flex-wrap" role="status">
            <div className="text-sm text-[var(--text)]">
              <CheckCircle2 size={16} className="inline mr-1.5 text-[var(--pos)]" aria-hidden="true" />
              Imported {result.created} {definition.label.toLowerCase()}.
              {result.skipped.length > 0 && <> Skipped {result.skipped.length} that already existed.</>}
              {result.openingStockCents > 0 && <> Opening stock of {formatCurrency(result.openingStockCents)} recorded.</>}
            </div>
            <button type="button" disabled={busy} onClick={() => undo(String(result.batchId))} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brass)] hover:underline disabled:opacity-50">
              <Undo2 size={14} aria-hidden="true" /> Undo this import
            </button>
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="ledger-card p-6 bg-[var(--surface)] border border-[var(--line)] rounded-2xl space-y-3" aria-labelledby="recent-imports">
          <h2 id="recent-imports" className="text-sm font-bold text-[var(--text)] inline-flex items-center gap-2"><History size={16} aria-hidden="true" /> Recent imports</h2>
          <p className="text-[11px] text-[var(--muted)]">Undo removes the imported records nothing uses yet; records already on invoices, bills or ledger entries are kept.</p>
          <ul className="divide-y divide-[var(--line)]">
            {recent.map(r => (
              <li key={r.batchId} className="py-2 flex items-center justify-between gap-4 text-sm">
                <span className="text-[var(--text)]">{r.description}<span className="block text-[11px] text-[var(--muted)]">{r.timestamp.slice(0, 16).replace('T', ' ')}</span></span>
                <button type="button" disabled={busy} onClick={() => undo(r.batchId)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brass)] hover:underline disabled:opacity-50">
                  <Undo2 size={14} aria-hidden="true" /> Undo
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
