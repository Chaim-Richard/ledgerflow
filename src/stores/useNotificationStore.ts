import { create } from 'zustand';
import type { AppNotification } from '../types';

/**
 * The signed-in person's notifications for the current workspace. They are created by the
 * server and loaded live by useNotificationFeed (mounted in the header); marking them read
 * writes to the database (src/hooks/useNotificationFeed.ts).
 */
interface NotificationState {
  notifications: AppNotification[];
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  setNotifications: (notifications: AppNotification[]) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  isDrawerOpen: false,
  setDrawerOpen: (open) => set({ isDrawerOpen: open }),
  setNotifications: (notifications) => set({ notifications }),
}));

export function unreadCount(notifications: AppNotification[]): number {
  return notifications.filter(n => !n.read).length;
}
