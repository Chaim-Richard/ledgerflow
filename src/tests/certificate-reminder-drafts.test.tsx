/**
 * C-83 on the screen: the customer-certificate report offers a reminder draft for each certificate
 * that expired, is expiring or has no expiry recorded, in English or Hebrew, and never sends it.
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import CertificateReminderDrafts from '../components/reporting/CertificateReminderDrafts';

const rows = [
  { id: '1', customer: 'Acme Ltd', number: 'CERT-77', expires: '2026-10-01', state: 'Expired' as const, email: 'books@acme.test' },
  { id: '2', customer: 'Beta', number: 'B-1', expires: '2027-05-01', state: 'Current by recorded date' as const },
  { id: '3', customer: 'חברת דוגמה', number: '', expires: '', state: 'No expiry recorded' as const },
];

afterEach(() => cleanup());

describe('The certificate reminder drafts', () => {
  test('a letter is offered for the certificates that need one and not for a current one', () => {
    render(<CertificateReminderDrafts rows={rows} today="2026-10-27" entityName={'ספרים בע"מ'} emailsTrusted />);
    assert.ok(screen.getByRole('heading', { name: 'Reminder drafts' }));
    assert.ok(screen.getByRole('heading', { name: 'Reminder for Acme Ltd' }));
    assert.ok(screen.getByRole('heading', { name: 'Reminder for חברת דוגמה' }));
    assert.equal(screen.queryByRole('heading', { name: 'Reminder for Beta' }), null, 'a current certificate asks for nothing');
    const mail = screen.getByRole('link', { name: /Open in mail app/ });
    assert.match(mail.getAttribute('href') || '', /^mailto:books@acme\.test\?/);
    assert.match(document.body.textContent || '', /A draft only: copy it or open it in your own mail app/);
  });

  test('the language switch rewrites every draft in Hebrew, right to left', async () => {
    render(<CertificateReminderDrafts rows={rows} today="2026-10-27" entityName={'ספרים בע"מ'} emailsTrusted />);
    const select = screen.getByLabelText(/Letter language/i) as HTMLSelectElement;
    await act(async () => { fireEvent.change(select, { target: { value: 'he' } }); });
    const hebrew = screen.getAllByText(/בקשה לאישור פטור ממס מעודכן/);
    assert.ok(hebrew.length >= 2, 'both customers get a Hebrew subject');
    const bodies = document.querySelectorAll('pre[dir="rtl"]');
    assert.equal(bodies.length, 2, 'the Hebrew letters are laid out right to left');
  });

  test('copying puts the letter on the clipboard and says so', async () => {
    let copied = '';
    Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied = text; } } });
    render(<CertificateReminderDrafts rows={rows.slice(0, 1)} today="2026-10-27" emailsTrusted />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Copy letter/ })); });
    assert.match(copied, /Request for an updated tax exemption certificate — Acme Ltd/);
    assert.ok(screen.getByRole('status').textContent?.includes('on the clipboard'));
  });

  test('a list that changed since the last complete read offers the letter but no mail link', () => {
    render(<CertificateReminderDrafts rows={rows} today="2026-10-27" />);
    assert.equal(screen.queryAllByRole('link', { name: /Open in mail app/ }).length, 0, 'a stale address is never used');
    assert.equal(screen.queryAllByRole('button', { name: /Copy letter/ }).length, 2, 'the drafts are still there to copy');
    assert.match(document.body.textContent || '', /No saved email is used until the customers are read completely again/);
  });

  test('a refused clipboard is said out loud instead of nothing', async () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
    render(<CertificateReminderDrafts rows={rows.slice(0, 1)} today="2026-10-27" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Copy letter/ })); });
    assert.ok(screen.getByRole('alert').textContent?.includes('refused the clipboard'));
    assert.equal(screen.queryByRole('status'), null, 'no false success');
  });

  test('two customers with one name keep their own letter and copy state', async () => {
    const twins = [
      { id: 'a', customer: 'Same Name', number: 'A-1', expires: '2026-01-01', state: 'Expired' as const },
      { id: 'b', customer: 'Same Name', number: 'B-2', expires: '2026-02-01', state: 'Expired' as const },
    ];
    Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
    render(<CertificateReminderDrafts rows={twins} today="2026-10-27" />);
    assert.equal(screen.getAllByRole('button', { name: /Copy letter/ }).length, 2);
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: /Copy letter/ })[0]); });
    assert.equal(screen.getAllByRole('status').length, 1, 'one card says it was copied, the other does not');
    assert.match(document.body.textContent || '', /number A-1/, 'the two letters stay apart by record');
    assert.match(document.body.textContent || '', /number B-2/);
  });

  test('nothing needs a letter when every certificate is current', () => {
    render(<CertificateReminderDrafts rows={[rows[1]]} today="2026-10-27" />);
    assert.match(document.body.textContent || '', /No certificate needs a reminder/);
    assert.equal(screen.queryAllByRole('button', { name: /Copy letter/ }).length, 0);
  });
});
