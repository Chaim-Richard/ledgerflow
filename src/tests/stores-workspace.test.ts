/**
 * src/stores (H-29): what the stores must do when the ledger loads and when the workspace changes.
 * Income/expense totals follow the accounts (they stayed at zero when the entries arrived first),
 * a workspace switch leaves nothing of the old workspace behind (closed periods, lock exception,
 * hidden tabs, truncation banner), and the Transactions list opens unfiltered.
 */
import './helpers/dom';
import test, { beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLedger, useLedgerStore } from '../stores/useLedgerStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useSavedViewsStore } from '../stores/useSavedViewsStore';
import { useUIStore } from '../stores/useUIStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { makeChartAccount, makeTransaction } from './fixtures';
import type { Workspace } from '../types';

const bank = makeChartAccount({ id: 'bank', type: 'asset', category: 'Bank' });
const sales = makeChartAccount({ id: 'sales', type: 'income', category: 'Revenue', code: '4000' });
const rent = makeChartAccount({ id: 'rent', type: 'expense', category: 'Rent', code: '6000' });
const entries = [
  makeTransaction({ id: 's', projectId: 'p1', lines: [{ accountId: 'bank', amountCents: 50000 }, { accountId: 'sales', amountCents: -50000, category: 'Consulting' }] }),
  makeTransaction({ id: 'r', currency: 'EUR', exchangeRate: 1.2, lines: [{ accountId: 'rent', amountCents: 10000 }, { accountId: 'bank', amountCents: -10000 }] }),
  makeTransaction({ id: 'd', status: 'draft', lines: [{ accountId: 'bank', amountCents: 99900 }, { accountId: 'sales', amountCents: -99900 }] }),
];

describe('ledger totals (summarizeLedger)', () => {
  test('income, expenses, per project and per category, posted entries only, in the base currency', () => {
    const summary = summarizeLedger(entries, [bank, sales, rent]);
    assert.equal(summary.totalIncome, 50000);
    assert.equal(summary.totalExpense, 12000); // €100 at 1.2
    assert.equal(summary.totalBalance, 38000);
    assert.deepEqual(summary.projectMetrics, { p1: { income: 50000, expense: 0 } });
    assert.equal(summary.categoryMetrics.Consulting, -50000);
  });

  test('entries loaded before the accounts get their totals once the accounts arrive', () => {
    useLedgerStore.getState().resetStore();
    useLedgerStore.getState().setTransactions(entries);
    assert.equal(useLedgerStore.getState().runningBalances.totalIncome, 0); // nothing is income yet
    useLedgerStore.getState().setAccounts([bank, sales, rent]);
    assert.equal(useLedgerStore.getState().runningBalances.totalIncome, 50000);
    assert.equal(useLedgerStore.getState().runningBalances.totalExpense, 12000);
    assert.equal(useLedgerStore.getState().reconcileIntegrity(), true);
  });
});

describe('switching workspace', () => {
  // the person's own settings, kept across workspaces; everything else belongs to the workspace
  const KEPT = new Set(['isPrivacyMode', 'matchingThreshold', 'baseCurrency', '_version', '_lastSync']);

  test('resetStore empties every record of the old workspace', () => {
    const initial = useLedgerStore.getInitialState() as unknown as Record<string, unknown>;
    const dirty: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(initial)) {
      if (typeof value === 'function') continue;
      if (Array.isArray(value)) dirty[key] = [{ id: 'old' }];
      else if (value instanceof Set) dirty[key] = new Set(['old']);
      else if (value && typeof value === 'object') dirty[key] = { old: 1 };
      else if (typeof value === 'boolean') dirty[key] = !value;
      else if (typeof value === 'number') dirty[key] = value + 7;
      else dirty[key] = 'old';
    }
    useLedgerStore.setState(dirty);
    useLedgerStore.getState().resetStore();
    const after = useLedgerStore.getState() as unknown as Record<string, unknown>;
    const leftOver = Object.keys(dirty).filter(key => {
      if (KEPT.has(key) || key === 'integrityStatus' || key === 'lastActivity') return false;
      const now = after[key];
      return JSON.stringify(now instanceof Set ? [...now] : now) !== JSON.stringify(initial[key] instanceof Set ? [...(initial[key] as Set<unknown>)] : initial[key]);
    });
    assert.deepEqual(leftOver, [], 'kept from the old workspace');
  });

  test('a new workspace starts without the old one\'s closed periods, lock exception and saved-view filter', () => {
    useAuthStore.setState({ currentWorkspaceId: 'w1', workspaces: [{ id: 'w1' } as Workspace, { id: 'w2' } as Workspace] });
    useLedgerStore.setState({ periods: [{ id: 'jan', status: 'closed' }] as never, lockException: { startDate: '2026-01-01' } as never, isDataTruncated: true });
    useSavedViewsStore.setState({ activeViewId: 'view-liquid-cash' });
    useAuthStore.getState().setCurrentWorkspaceId('w2');
    const ledger = useLedgerStore.getState();
    assert.deepEqual(ledger.periods, []);
    assert.equal(ledger.lockException, null);
    assert.equal(ledger.isDataTruncated, false);
    assert.equal(useSavedViewsStore.getState().activeViewId, null);
    assert.equal(localStorage.getItem('ledgerflow_current_workspace'), 'w2');
  });

  test('each workspace has its own hidden sidebar tabs', () => {
    localStorage.setItem('ledgerflow_current_workspace', 'w1');
    useUIStore.getState().loadHiddenTabs('w1');
    useUIStore.getState().toggleTabVisibility('payroll');
    assert.deepEqual(useUIStore.getState().hiddenTabs, ['payroll']);
    localStorage.setItem('ledgerflow_current_workspace', 'w2');
    useUIStore.getState().loadHiddenTabs('w2');
    assert.deepEqual(useUIStore.getState().hiddenTabs, []);
    useUIStore.getState().toggleTabVisibility('projects');
    useUIStore.getState().loadHiddenTabs('w1');
    assert.deepEqual(useUIStore.getState().hiddenTabs, ['payroll']);
    localStorage.setItem('lf_hidden_tabs_w3', '{"not":"a list"}');
    useUIStore.getState().loadHiddenTabs('w3');
    assert.deepEqual(useUIStore.getState().hiddenTabs, []);
  });
});

describe('saved views', () => {
  beforeEach(() => useSavedViewsStore.getState().resetToDefaultViews());

  test('no view is switched on until the person picks one; deleting the active one switches it off', () => {
    assert.equal(useSavedViewsStore.getInitialState().activeViewId, null);
    useSavedViewsStore.getState().loadViewsForWorkspace('w9');
    assert.equal(useSavedViewsStore.getState().activeViewId, null);
    const [first, second] = useSavedViewsStore.getState().views;
    useSavedViewsStore.getState().setActiveView(first.id);
    useSavedViewsStore.getState().deleteSavedView(second.id);
    assert.equal(useSavedViewsStore.getState().activeViewId, first.id); // another view: unchanged
    useSavedViewsStore.getState().deleteSavedView(first.id);
    assert.equal(useSavedViewsStore.getState().activeViewId, null); // not the next one in the list
  });
});

describe('records to load (useDataNeedsStore)', () => {
  test('asks once per collection; a load clears its failure; a new workspace loads everything again', () => {
    useDataNeedsStore.setState({ asked: [], loaded: {}, failed: {} });
    const store = useDataNeedsStore.getState;
    store().ask(['invoices', 'bills']);
    store().ask(['bills', 'customers']);
    assert.deepEqual(store().asked, ['bills', 'customers', 'invoices']);
    store().markFailed('bills', 'offline');
    store().markLoaded('bills');
    assert.deepEqual(store().failed, {});
    assert.equal(store().loaded.bills, true);
    store().markFailed('invoices', 'denied');
    store().retry('invoices');
    assert.deepEqual(store().failed, {});
    store().resetLoaded();
    assert.deepEqual(store().loaded, {});
    assert.deepEqual(store().asked, ['bills', 'customers', 'invoices']); // still wanted
  });
});

describe('record links (useUIStore)', () => {
  test('opening a record goes to its screen and the address; changing screen forgets it', () => {
    useUIStore.getState().openRecord({ type: 'invoice', id: 'INV 7' });
    assert.equal(useUIStore.getState().activeTab, 'sales');
    assert.deepEqual(useUIStore.getState().focusRecord, { type: 'invoice', id: 'INV 7' });
    assert.equal(window.location.hash, '#sales/invoice/INV%207');
    useUIStore.getState().setActiveTab('purchases' as never);
    assert.equal(useUIStore.getState().focusRecord, null);
    assert.equal(window.location.hash, '#purchases');
  });
});
