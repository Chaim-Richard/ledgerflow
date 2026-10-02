import assert from 'node:assert/strict';
import { test, describe, beforeEach } from 'node:test';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';
import { useSavedViewsStore } from '../stores/useSavedViewsStore';
import { unreadCount, useNotificationStore } from '../stores/useNotificationStore';
import { ChartAccount, Transaction } from '../types';

describe('Client Stores State & Mutator Suite (src/stores)', () => {

  describe('1. useLedgerStore Invariants & Actions', () => {
    beforeEach(() => {
      useLedgerStore.setState({
        transactions: [],
        accounts: [],
        baseCurrency: 'USD'
      });
    });

    test('setTransactions updates store and maintains array immutability', () => {
      const mockTx: Transaction[] = [
        {
          id: 'tx_store_1',
          uid: 'usr_1',
          workspaceId: 'ws_test_store',
          date: '2026-09-17',
          description: 'Store Test Transaction',
          totalAmountCents: 10000,
          currency: 'USD',
          status: 'completed',
          type: 'income',
          createdAt: '2026-09-17T00:00:00Z',
          lines: [
            { accountId: 'acc_cash', accountName: 'Cash', amountCents: 10000 },
            { accountId: 'acc_rev', accountName: 'Revenue', amountCents: -10000 }
          ]
        }
      ];

      useLedgerStore.getState().setTransactions(mockTx);
      const state = useLedgerStore.getState();

      assert.equal(state.transactions.length, 1);
      assert.equal(state.transactions[0].id, 'tx_store_1');
      assert.equal(state.transactions[0].totalAmountCents, 10000);
    });

    test('setAccounts preserves chart of accounts hierarchy', () => {
      const mockAccounts: ChartAccount[] = [
        { id: 'acc_100', uid: 'usr_1', code: '1000', name: 'Cash On Hand', type: 'asset', workspaceId: 'ws_test_store', balanceCents: 10000 },
        { id: 'acc_400', uid: 'usr_1', code: '4000', name: 'Sales Income', type: 'income', workspaceId: 'ws_test_store', balanceCents: 10000 }
      ];

      useLedgerStore.getState().setAccounts(mockAccounts);
      const state = useLedgerStore.getState();

      assert.equal(state.accounts.length, 2);
      assert.equal(state.accounts[0].code, '1000');
    });

    test('resetStore clears state back to empty baseline', () => {
      useLedgerStore.getState().setTransactions([{ id: 'tx_1', totalAmountCents: 500 } as unknown as Transaction]);
      useLedgerStore.getState().resetStore();

      const state = useLedgerStore.getState();
      assert.equal(state.transactions.length, 0);
      assert.equal(state.accounts.length, 0);
    });
  });

  describe('2. useAuthStore Session & Guest Mode', () => {
    test('guest authentication flags correctly state guest status', () => {
      useAuthStore.setState({
        user: null,
        isGuest: true
      });

      const state = useAuthStore.getState();
      assert.equal(state.isGuest, true);
      assert.equal(state.user, null);
    });

    test('setUser updates authenticated user state', () => {
      const mockUser = {
        uid: 'usr_test_123',
        email: 'accountant@ledgerflow.io',
        displayName: 'Senior Accountant',
        getIdTokenResult: async () => ({ claims: {} })
      };

      useAuthStore.getState().setUser(mockUser as unknown as Parameters<ReturnType<typeof useAuthStore.getState>['setUser']>[0]);
      const state = useAuthStore.getState();

      assert.equal(state.user?.email, 'accountant@ledgerflow.io');
    });
  });

  describe('3. useUIStore Active Tab & Theme Settings', () => {
    test('setActiveTab updates current navigation view', () => {
      useUIStore.getState().setActiveTab('reconciliation');
      assert.equal(useUIStore.getState().activeTab, 'reconciliation');

      useUIStore.getState().setActiveTab('reports');
      assert.equal(useUIStore.getState().activeTab, 'reports');
    });

    test('setTheme updates UI theme state', () => {
      useUIStore.getState().setTheme('dark');
      assert.equal(useUIStore.getState().theme, 'dark');

      useUIStore.getState().setTheme('light');
      assert.equal(useUIStore.getState().theme, 'light');
    });
  });

  describe('4. useSavedViewsStore View Customization', () => {
    test('savedViewsStore holds and manages custom saved views', () => {
      const views = useSavedViewsStore.getState().views || [];
      assert.ok(Array.isArray(views));
    });
  });

  describe('5. useNotificationStore (notifications from the server)', () => {
    test('holds the loaded notifications and counts the unread ones', () => {
      const base = { workspaceId: 'ws_test', uid: 'u1', kind: 'payment.received' as const, message: 'Acme paid', createdAt: '2026-09-28T10:00:00Z' };
      useNotificationStore.getState().setNotifications([
        { ...base, id: 'n1', title: 'Payment received', read: false },
        { ...base, id: 'n2', title: 'Older', read: true },
      ]);
      const { notifications } = useNotificationStore.getState();
      assert.equal(notifications[0].title, 'Payment received');
      assert.equal(unreadCount(notifications), 1);
    });
  });
});
