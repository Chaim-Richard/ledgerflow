/**
 * A-33 (tracker Q-03): serial and lot numbers on a screen. Search where a serial has been (which
 * document, which line, which lot), see one item's lots and their dates, and see the same serial
 * recorded twice for one item — a typo to look at. Read-only: the screen reads the numbers the
 * documents carry and never changes a cost, a quantity or a posting. Recording serials on a
 * receipt or invoice line happens in that document's own form (asked of AI #1).
 */
import React, { useMemo, useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useDataNeedsStore } from '../../stores/useDataNeedsStore';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { useCollection } from '../../hooks/useCollection';
import type { Invoice, PurchaseOrder } from '../../types';
import { downloadCsv } from '../../lib/csvExport';
import {
  duplicateSerials, findSerial, lineSerials, lotRows, serialLookupCsvRows, serialsForItem,
  SERIAL_LOOKUP_CSV_HEADERS, type SerialPlacement, type SerializedLine,
} from '../../lib/serialNumbers';
import ReportTableScroll from './ReportTableScroll';

interface DocLike {
  id: string;
  type?: string;
  date?: string;
  lines?: SerializedLine[];
}
interface ItemLike { id: string; name?: string; sku?: string }

export default function SerialLotLookupReportView({ purchaseOrders: purchaseOrdersProp }: { purchaseOrders?: PurchaseOrder[] } = {}) {
  const invoices = useLedgerStore(s => s.invoices) as Invoice[];
  const items = useLedgerStore(s => s.inventory) as ItemLike[];
  const truncated = useLedgerStore(s => s.truncatedCollections);
  const failed = useDataNeedsStore(s => s.failed);
  const { loading } = useLedgerCollections('inventory', 'invoices');
  const { data: loadedOrders, loading: ordersLoading, truncated: ordersTruncated } = useCollection<PurchaseOrder>('purchaseOrders', { orderByField: 'createdAt', orderDirection: 'desc', limit: 500 });
  const purchaseOrders = purchaseOrdersProp ?? loadedOrders;
  const [query, setQuery] = useState('');
  const [itemId, setItemId] = useState('');

  const documents = useMemo(() => {
    const list: DocLike[] = [];
    for (const inv of invoices || []) {
      list.push({
        id: inv.id,
        type: 'invoice',
        date: inv.date,
        lines: (inv.items || []).map(l => ({
          description: l.description,
          itemId: l.itemId,
          quantity: l.quantity,
          ...((l.serialNumbers || []).length ? { serialNumbers: l.serialNumbers } : {}),
          ...(l.lotNumber ? { lotNumber: l.lotNumber } : {}),
        })),
      });
    }
    for (const po of purchaseOrders || []) {
      const itemOf = new Map((po.items || []).map(i => [i.id, i.itemId] as const));
      for (const receipt of po.receipts || []) {
        list.push({
          id: receipt.receiptNumber,
          type: 'goods receipt',
          date: receipt.receivedDate,
          lines: (receipt.items || []).map((line, index) => ({
            description: line.description || `Line ${index + 1}`,
            itemId: itemOf.get(line.poItemId),
            quantity: line.quantityReceived,
            ...((line.serialNumbers || []).length ? { serialNumbers: line.serialNumbers } : {}),
            ...(line.lotNumber ? { lotNumber: line.lotNumber } : {}),
          })),
        });
      }
    }
    return list;
  }, [invoices, purchaseOrders]);

  /** Every line that carries a serial or a lot, with its item — the universe the lookup reads. */
  const tracked = useMemo(() => {
    const ids = new Set<string>();
    for (const document of documents) {
      for (const line of document.lines || []) {
        if (line.itemId && (lineSerials(line).length || line.lotNumber)) ids.add(line.itemId);
      }
    }
    return (items || []).filter(item => ids.has(item.id));
  }, [documents, items]);

  const placements = useMemo(
    () => tracked.flatMap(item => serialsForItem(documents, item.id).map(row => ({ ...row, itemId: item.id }))),
    [documents, tracked],
  );
  const matches = useMemo(() => {
    const rows: Array<SerialPlacement & { itemId: string }> = [];
    for (const item of tracked) {
      rows.push(...findSerial(serialsForItem(documents, item.id), query).map(row => ({ ...row, itemId: item.id })));
    }
    return rows;
  }, [documents, tracked, query]);
  const selected = tracked.find(item => item.id === itemId) || tracked[0];
  const lots = useMemo(() => (selected ? lotRows(documents, selected.id) : []), [documents, selected]);
  const selectedSerials = useMemo(
    () => (selected ? serialsForItem(documents, selected.id) : []),
    [documents, selected],
  );
  const duplicates = useMemo(() => duplicateSerials(documents), [documents]);
  const partial = Boolean(truncated.inventory || truncated.invoices || ordersTruncated || failed.inventory || failed.invoices);
  const itemName = (id: string) => {
    const item = (items || []).find(i => i.id === id);
    return item ? (item.name || item.sku || item.id) : id;
  };

  return (
    <section aria-label="Serial and lot lookup" className="p-4 space-y-4 min-w-0">
      <h2>Serial &amp; lot lookup</h2>
      <p className="text-sm text-[var(--muted)]">
        Where a serial number has been: the document, the line and the lot it moved with. Below, one item&apos;s lots
        and the same serial recorded twice for one item — a typo to look at. The numbers are read from invoice lines
        and goods receipts; this screen changes no cost, quantity or posting. Recording happens on the goods receipt
        (Purchase orders → Receive goods) or on the invoice&apos;s own form.
      </p>

      {(loading || ordersLoading) && <p role="status" className="text-sm text-[var(--muted)]">Loading items and documents…</p>}
      {partial && <p role="alert" className="text-sm text-[var(--muted)]">
        The loaded items or documents are capped or failed at the database. What is shown may be incomplete.
      </p>}

      <div className="flex flex-wrap items-end gap-3" data-print-hide>
        <label className="flex flex-col gap-1 text-sm">Find a serial number
          <input type="search" aria-label="Find a serial number" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Type part of the serial" dir="auto"
            className="min-h-11 border rounded px-3 bg-[var(--panel)] text-[var(--text)] w-72" />
        </label>
        <button type="button" className="min-h-11 px-4 rounded border border-[var(--line)]" disabled={!matches.length}
          onClick={() => downloadCsv('serial-lookup', SERIAL_LOOKUP_CSV_HEADERS, serialLookupCsvRows(
            matches.map(({ serial, documentId, documentType, date, line, description, lotNumber }) => ({
              serial, documentId, documentType, date, line, description, lotNumber,
            })),
          ))}>
          Export CSV
        </button>
      </div>

      {query.trim() ? (
        <ReportTableScroll>
          <table className="w-full text-sm">
            <caption>Documents carrying a matching serial</caption>
            <thead>
              <tr>{['Serial', 'Item', 'Document', 'Type', 'Date', 'Line', 'Description', 'Lot'].map(head =>
                <th key={head} scope="col" className="text-left py-1 px-2">{head}</th>)}</tr>
            </thead>
            <tbody>
              {matches.map(row => (
                <tr key={`${row.itemId}:${row.documentId}:${row.line}:${row.serial}`} className="border-b border-[var(--line)]/50">
                  <th scope="row" className="text-left font-normal py-1 px-2"><bdi>{row.serial}</bdi></th>
                  <td className="py-1 px-2"><bdi>{itemName(row.itemId)}</bdi></td>
                  <td className="py-1 px-2">{row.documentId}</td>
                  <td className="py-1 px-2">{row.documentType}</td>
                  <td className="py-1 px-2">{row.date || '—'}</td>
                  <td className="py-1 px-2">{row.line}</td>
                  <td className="py-1 px-2"><bdi>{row.description || '—'}</bdi></td>
                  <td className="py-1 px-2">{row.lotNumber || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {matches.length === 0 && <p className="text-sm text-[var(--muted)]">No serial on a loaded document matches this search.</p>}
        </ReportTableScroll>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          {placements.length} serial number placement(s) recorded on loaded documents across {tracked.length} tracked item(s).
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3" data-print-hide>
        <label className="flex flex-col gap-1 text-sm">Tracked item
          <select aria-label="Tracked item" className="min-h-11 border rounded px-3 bg-[var(--panel)] text-[var(--text)] max-w-md"
            value={selected?.id || ''} onChange={e => setItemId(e.target.value)}>
            {tracked.map(item => <option key={item.id} value={item.id}>{item.name || item.sku || item.id}</option>)}
          </select>
        </label>
      </div>

      {tracked.length === 0 && (
        <p className="text-sm text-[var(--muted)]">
          No loaded invoice or receipt line carries a serial number or a lot yet. The numbers appear here when they are recorded
          on a goods receipt or invoice line.
        </p>
      )}

      {selected && (
        <>
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Lots of <bdi>{selected.name || selected.sku || selected.id}</bdi>
          </h3>
          <ReportTableScroll>
            <table className="w-full text-sm">
              <caption>Lots recorded for this item</caption>
              <thead>
                <tr>{['Lot', 'Lines', 'Units', 'First seen', 'Last seen'].map(head =>
                  <th key={head} scope="col" className="text-left py-1 px-2">{head}</th>)}</tr>
              </thead>
              <tbody>
                {lots.map(lot => (
                  <tr key={lot.lotNumber} className="border-b border-[var(--line)]/50">
                    <th scope="row" className="text-left font-normal py-1 px-2"><bdi>{lot.lotNumber}</bdi></th>
                    <td className="py-1 px-2">{lot.lines}</td>
                    <td className="py-1 px-2">{lot.quantity}</td>
                    <td className="py-1 px-2">{lot.firstDate || '—'}</td>
                    <td className="py-1 px-2">{lot.lastDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lots.length === 0 && <p className="text-sm text-[var(--muted)]">No lot is recorded for this item.</p>}
          </ReportTableScroll>

          <h3 className="text-sm font-semibold text-[var(--text)]">Serials of this item</h3>
          <ReportTableScroll>
            <table className="w-full text-sm">
              <caption>Serial numbers recorded for this item</caption>
              <thead>
                <tr>{['Serial', 'Document', 'Type', 'Date', 'Line', 'Lot'].map(head =>
                  <th key={head} scope="col" className="text-left py-1 px-2">{head}</th>)}</tr>
              </thead>
              <tbody>
                {selectedSerials.map(row => (
                  <tr key={`${row.documentId}:${row.line}:${row.serial}`} className="border-b border-[var(--line)]/50">
                    <th scope="row" className="text-left font-normal py-1 px-2"><bdi>{row.serial}</bdi></th>
                    <td className="py-1 px-2">{row.documentId}</td>
                    <td className="py-1 px-2">{row.documentType}</td>
                    <td className="py-1 px-2">{row.date || '—'}</td>
                    <td className="py-1 px-2">{row.line}</td>
                    <td className="py-1 px-2">{row.lotNumber || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedSerials.length === 0 && <p className="text-sm text-[var(--muted)]">No serial is recorded for this item.</p>}
          </ReportTableScroll>
        </>
      )}

      <h3 className="text-sm font-semibold text-[var(--text)]">The same serial twice</h3>
      <p className="text-xs text-[var(--muted)]">
        The same serial number recorded for one item on two different documents — usually a typing mistake to look at.
        Nothing is changed here.
      </p>
      <ReportTableScroll>
        <table className="w-full text-sm">
          <caption>Serials recorded twice for one item</caption>
          <thead>
            <tr>{['Serial', 'Documents'].map(head =>
              <th key={head} scope="col" className="text-left py-1 px-2">{head}</th>)}</tr>
          </thead>
          <tbody>
            {duplicates.map(row => (
              <tr key={row.serial} className="border-b border-[var(--line)]/50">
                <th scope="row" className="text-left font-normal py-1 px-2"><bdi>{row.serial}</bdi></th>
                <td className="py-1 px-2">{row.documents.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {duplicates.length === 0 && <p className="text-sm text-[var(--muted)]">No serial is recorded twice for one item.</p>}
      </ReportTableScroll>
    </section>
  );
}
