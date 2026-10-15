import React, { useEffect, useState } from 'react';
import { AlertCircle, Building2 } from 'lucide-react';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import { customerOpenQuotes, type CustomerQuoteItem } from '../../lib/customerQuotes';
import type { Estimate } from '../../types';

/**
 * Customer portal (K-27, A-49 / A-175): what a customer sees at `/c/<token>`: their invoices from
 * this business, what is still due on each, "View and pay" for each one's own page, and their open
 * estimates and proposals with the Y-20 signing link (`/e/<signToken>`). No sign-in; nothing else.
 */
interface PortalInvoice { number: string; date: string; dueDate: string; totalCents: number; dueCents: number; currency: string; status: 'open' | 'overdue' | 'paid'; payPath: string }
interface PortalData {
  business: string;
  customer: string;
  customerId?: string;
  currency: string;
  owedCents: number;
  invoices: PortalInvoice[];
  estimates?: Estimate[];
  quotes?: Array<CustomerQuoteItem & { signToken?: string }>;
}

const STATUS = { open: 'Open', overdue: 'Overdue', paid: 'Paid' } as const;
const QUOTE_STATE = { open: 'Open', expired: 'Expired', signed: 'Signed', closed: 'Closed' } as const;

export default function CustomerPortalPage() {
  const token = window.location.pathname.split('/')[2] || '';
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch(`/api/v1/invoices/public/portal/${encodeURIComponent(token)}`);
        const body = await res.json().catch(() => ({}));
        if (!live) return;
        if (!res.ok) throw new Error(body.message || 'This link is not valid any more. Ask for a new one.');
        setData(body as PortalData);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { live = false; };
  }, [token]);

  return (
    <main className="min-h-screen bg-[var(--ink)] text-[var(--text)] p-4 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        {error ? (
          <div role="alert" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-bold">Your invoices</h1>
              <p className="text-sm text-[var(--muted)] mt-1">{error}</p>
            </div>
          </div>
        ) : !data ? (
          <p role="status" className="text-sm text-[var(--muted)]">Loading your invoices…</p>
        ) : (
          <>
            <header className="space-y-1">
              <p className="text-sm text-[var(--muted)] flex items-center gap-2"><Building2 className="w-4 h-4" aria-hidden="true" /> <bdi>{data.business}</bdi></p>
              <h1 className="text-2xl font-bold">Invoices for <bdi>{data.customer}</bdi></h1>
              <p className="text-sm">
                {data.owedCents > 0 ? <>Still to pay: <strong>{formatCurrency(data.owedCents, data.currency)}</strong></> : 'Nothing to pay at the moment. Thank you.'}
              </p>
            </header>
            {data.invoices.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No invoices yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]" role="region" aria-label="Your invoices" tabIndex={0}>
                <table className="w-full text-sm">
                  <caption className="sr-only">Invoices from {data.business} for {data.customer}</caption>
                  <thead>
                    <tr className="text-left text-xs text-[var(--muted)]">
                      <th scope="col" className="p-3">Invoice</th>
                      <th scope="col" className="p-3">Date</th>
                      <th scope="col" className="p-3">Due</th>
                      <th scope="col" className="p-3 text-right">Total</th>
                      <th scope="col" className="p-3 text-right">Still due</th>
                      <th scope="col" className="p-3">Status</th>
                      <th scope="col" className="p-3"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map(inv => (
                      <tr key={`${inv.number}-${inv.date}`} className="border-t border-[var(--line)]">
                        <td className="p-3 font-semibold"><bdi>{inv.number}</bdi></td>
                        <td className="p-3 tabular-nums">{inv.date}</td>
                        <td className="p-3 tabular-nums">{inv.dueDate}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(inv.totalCents, inv.currency)}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(inv.dueCents, inv.currency)}</td>
                        <td className={`p-3 ${inv.status === 'overdue' ? 'text-rose-600 font-semibold' : inv.status === 'paid' ? 'text-[var(--muted)]' : ''}`}>{STATUS[inv.status]}</td>
                        <td className="p-3">
                          {inv.payPath && (
                            <a href={inv.payPath} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap">
                              {inv.status === 'paid' ? 'View' : 'View and pay'}<span className="sr-only"> invoice {inv.number}</span>
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-[var(--muted)]">Paid invoices from the last 12 months are shown. Questions about an invoice? Reply to the email it came with.</p>
            {(() => {
              const quoteRows: Array<CustomerQuoteItem & { signToken?: string }> = data.quotes
                ? data.quotes
                : data.estimates && data.customerId
                ? customerOpenQuotes(data.estimates, data.customerId, getLocalDateISO()).map(q => {
                    const est = data.estimates?.find(e => e.id === q.estimateId);
                    return { ...q, ...(est?.signToken ? { signToken: est.signToken } : {}) };
                  })
                : [];
              if (quoteRows.length === 0) return null;
              return (
                <section aria-label="Quotes and proposals" className="space-y-2 pt-2">
                  <h2 className="text-lg font-bold">Estimates &amp; proposals</h2>
                  <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                    <table className="w-full text-sm">
                      <caption className="sr-only">Quotes and proposals for {data.customer}</caption>
                      <thead>
                        <tr className="text-left text-xs text-[var(--muted)]">
                          <th scope="col" className="p-3">Quote</th>
                          <th scope="col" className="p-3">Title</th>
                          <th scope="col" className="p-3">Valid until</th>
                          <th scope="col" className="p-3 text-right">Amount</th>
                          <th scope="col" className="p-3">Status</th>
                          <th scope="col" className="p-3"><span className="sr-only">Accept</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {quoteRows.map(q => (
                          <tr key={q.estimateId} className="border-t border-[var(--line)]">
                            <td className="p-3 font-semibold"><bdi>{q.number}</bdi>{q.versionLabel ? <div className="text-xs font-normal text-[var(--muted)]"><bdi>{q.versionLabel} — the latest is shown</bdi></div> : null}</td>
                            <td className="p-3"><bdi>{q.title}</bdi></td>
                            <td className="p-3 tabular-nums">{q.expiryDate || '—'}</td>
                            <td className="p-3 text-right tabular-nums">{formatCurrency(q.amountCents, q.currency || data.currency)}</td>
                            <td className="p-3">{QUOTE_STATE[q.state]}</td>
                            <td className="p-3">
                              {q.canAccept && q.signToken && (
                                <a href={`/e/${encodeURIComponent(q.signToken)}`} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap">
                                  Review and accept<span className="sr-only"> quote {q.number}</span>
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })()}
          </>
        )}
      </div>
    </main>
  );
}
