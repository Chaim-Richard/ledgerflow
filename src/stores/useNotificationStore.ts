import { create } from 'zustand';
import { AppNotification, NotificationKind } from '../types';
import { useLedgerStore } from './useLedgerStore';
import { format, isBefore, addDays } from 'date-fns';

interface NotificationState {
  notifications: AppNotification[];
  isDrawerOpen: boolean;
  preferences: Record<string, boolean>;
  setDrawerOpen: (open: boolean) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notif: { kind: NotificationKind; title: string; message: string; workspaceId: string; linkTab?: string; metadata?: Record<string, any> }) => void;
  updatePreferences: (key: string, enabled: boolean) => void;
  runScheduledChecks: (workspaceId: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [
    {
      id: 'notif-welcome',
      workspaceId: 'default',
      kind: 'insight-ready',
      title: 'Ledger Audit Ready',
      message: 'Automated double-entry integrity check passed with 0 imbalance errors.',
      read: false,
      createdAt: new Date().toISOString(),
      linkTab: 'data-health'
    }
  ],
  isDrawerOpen: false,
  preferences: {
    'invoice-overdue': true,
    'invoice-paid': true,
    'recurring-invoice-upcoming': true,
    'recurring-series-failed': true,
    'document-processed': true,
    'insight-ready': true
  },

  setDrawerOpen: (open) => set({ isDrawerOpen: open }),

  markAsRead: (id) => set(state => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
  })),

  markAllAsRead: () => set(state => ({
    notifications: state.notifications.map(n => ({ ...n, read: true }))
  })),

  addNotification: (notif) => {
    const prefs = get().preferences;
    if (prefs[notif.kind] === false) return;

    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      read: false,
      ...notif
    };

    set(state => ({
      notifications: [newNotif, ...state.notifications]
    }));
  },

  updatePreferences: (key, enabled) => set(state => ({
    preferences: { ...state.preferences, [key]: enabled }
  })),

  runScheduledChecks: (workspaceId) => {
    const { invoices, recurring } = useLedgerStore.getState();
    const existing = get().notifications;
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    // Check overdue invoices
    (invoices || []).forEach(inv => {
      const invTotal = inv.amountCents || 0;
      if (inv.status !== 'paid' && inv.dueDate && inv.dueDate < todayStr) {
        const notifId = `notif-overdue-${inv.id}-${inv.dueDate}`;
        if (!existing.some(n => n.id === notifId)) {
          get().addNotification({
            kind: 'invoice-overdue',
            title: `Invoice ${inv.number} Overdue`,
            message: `Invoice #${inv.number} was due on ${inv.dueDate}. Balance: $${((invTotal - (inv.amountPaidCents || 0)) / 100).toFixed(2)}`,
            workspaceId,
            linkTab: 'sales',
            metadata: { invoiceId: inv.id }
          });
        }
      }
    });

    // Check upcoming recurring transactions
    (recurring || []).forEach((rule: any) => {
      if (rule.nextRunDate) {
        const nextDate = new Date(rule.nextRunDate);
        const inThreeDays = addDays(today, 3);
        if (isBefore(nextDate, inThreeDays) && nextDate >= today) {
          const notifId = `notif-recurring-${rule.id}-${rule.nextRunDate}`;
          if (!existing.some(n => n.id === notifId)) {
            get().addNotification({
              kind: 'recurring-invoice-upcoming',
              title: `Upcoming Recurring ${rule.name || rule.number || rule.id}`,
              message: `Scheduled to execute on ${rule.nextRunDate} for $${((rule.amountCents || 0) / 100).toFixed(2)}.`,
              workspaceId,
              linkTab: 'transactions',
              metadata: { ruleId: rule.id }
            });
          }
        }
      }

      if (rule.lastErrorCode || rule.status === 'failed') {
        const notifId = `notif-recurring-err-${rule.id}-${rule.lastRunDate || 'err'}`;
        if (!existing.some(n => n.id === notifId)) {
          get().addNotification({
            kind: 'recurring-series-paused',
            title: `Recurring Execution Failure: ${rule.name || rule.id}`,
            message: `Rule failed execution with code: ${rule.lastErrorCode || 'FAILED'}`,
            workspaceId,
            linkTab: 'transactions',
            metadata: { ruleId: rule.id }
          });
        }
      }
    });
  }
}));
