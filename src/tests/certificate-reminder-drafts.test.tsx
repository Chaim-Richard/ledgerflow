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
    render(<CertificateReminderDrafts rows={rows} today="2026-10-27" entityName={'ספרים בע"מ'} />);
    assert.ok(screen.getByRole('heading', { name: 'Reminder drafts' }));
    assert.ok(screen.getByRole('heading', { name: 'Reminder for Acme Ltd' }));
    assert.ok(screen.getByRole('heading', { name: 'Reminder for חברת דוגמה' }));
    assert.equal(screen.queryByRole('heading', { name: 'Reminder for Beta' }), null, 'a current certificate asks for nothing');
    const mail = screen.getByRole('link', { name: /Open in mail app/ });
    assert.match(mail.getAttribute('href') || '', /^mailto:books@acme\.test\?/);
    assert.match(document.body.textContent || '', /A draft only: copy it or open it in your own mail app/);
  });

  test('the language switch rewrites every draft in Hebrew, right to left', async () => {
    render(<CertificateReminderDrafts rows={rows} today="2026-10-27" entityName={'ספרים בע"מ'} />);
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
    render(<CertificateReminderDrafts rows={rows.slice(0, 1)} today="2026-10-27" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Copy letter/ })); });
    assert.match(copied, /Request for an updated tax exemption certificate — Acme Ltd/);
    assert.ok(screen.getByRole('status').textContent?.includes('on the clipboard'));
  });

  test('nothing needs a letter when every certificate is current', () => {
    render(<CertificateReminderDrafts rows={[rows[1]]} today="2026-10-27" />);
    assert.match(document.body.textContent || '', /No certificate needs a reminder/);
    assert.equal(screen.queryAllByRole('button', { name: /Copy letter/ }).length, 0);
  });
});
