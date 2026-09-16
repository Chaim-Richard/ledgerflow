import React, { useState } from 'react';
import { useNotificationStore } from '../../stores/useNotificationStore';
import { useUIStore } from '../../stores/useUIStore';
import { Bell, CheckCheck, X, FileText, AlertTriangle, RefreshCw, FileCode, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationDrawer() {
  const { notifications, isDrawerOpen, setDrawerOpen, markAsRead, markAllAsRead } = useNotificationStore();
  const setActiveTab = useUIStore(s => s.setActiveTab);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  if (!isDrawerOpen) return null;

  const filteredNotifications = notifications.filter(n => filter === 'all' || !n.read);
  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (kind: string) => {
    if (kind.startsWith('invoice')) return <FileText size={16} className="text-indigo-500" />;
    if (kind.startsWith('recurring')) return <RefreshCw size={16} className="text-amber-500" />;
    if (kind.startsWith('document')) return <FileCode size={16} className="text-blue-500" />;
    return <ShieldCheck size={16} className="text-emerald-500" />;
  };

  const handleNotificationClick = (notif: any) => {
    markAsRead(notif.id);
    if (notif.linkTab) {
      setActiveTab(notif.linkTab);
      setDrawerOpen(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setDrawerOpen(false)}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-screen max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Notifications</h3>
                  <p className="text-xs text-slate-500">{unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="p-1.5 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <CheckCheck size={15} />
                    <span className="hidden sm:inline">Mark read</span>
                  </button>
                )}
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Sub-Header Tabs */}
            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  filter === 'unread' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredNotifications.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Bell size={36} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold">No notifications match this filter</p>
                </div>
              ) : (
                filteredNotifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      notif.read
                        ? 'bg-white border-slate-200 hover:border-slate-300 opacity-80'
                        : 'bg-indigo-50/40 border-indigo-200 hover:border-indigo-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-2xs border border-slate-100 shrink-0">
                        {getIcon(notif.kind)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{notif.title}</h4>
                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                          )}
                        </div>

                        <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{notif.message}</p>

                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                          <span>
                            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                          </span>
                          {notif.linkTab && (
                            <span className="text-indigo-600 font-bold flex items-center gap-0.5 hover:underline">
                              View <ArrowRight size={10} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
