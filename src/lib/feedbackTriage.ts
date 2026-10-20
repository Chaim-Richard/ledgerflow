import type { AppNotification } from '../types';

export type FeedbackTag = 'Bug' | 'UX' | 'Tax' | 'Reports' | 'Onboarding' | 'Question';

export const FEEDBACK_TAGS: readonly FeedbackTag[] = [
  'Bug',
  'UX',
  'Tax',
  'Reports',
  'Onboarding',
  'Question',
];

export function feedbackTagStorageKey(workspaceId: string | null | undefined): string {
  return `lf_feedback_triage_tags_v1:${workspaceId || 'default'}`;
}

export function loadFeedbackTags(workspaceId: string | null | undefined): Record<string, FeedbackTag[]> {
  try {
    const raw = localStorage.getItem(feedbackTagStorageKey(workspaceId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, FeedbackTag[]> = {};
    for (const [ticketId, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(val)) {
        result[ticketId] = val.filter((item): item is FeedbackTag =>
          typeof item === 'string' && (FEEDBACK_TAGS as readonly string[]).includes(item),
        );
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function toggleFeedbackTag(
  workspaceId: string | null | undefined,
  ticketId: string,
  tag: FeedbackTag,
): Record<string, FeedbackTag[]> {
  const current = loadFeedbackTags(workspaceId);
  const existing = current[ticketId] || [];
  const nextForTicket = existing.includes(tag)
    ? existing.filter(item => item !== tag)
    : [...existing, tag];
  const next = { ...current, [ticketId]: nextForTicket };
  try {
    localStorage.setItem(feedbackTagStorageKey(workspaceId), JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  return next;
}

export type NotificationGroupKey =
  | 'payment'
  | 'bank'
  | 'member'
  | 'email'
  | 'query'
  | 'document';

export interface NotificationGroup {
  key: NotificationGroupKey;
  label: string;
  unreadCount: number;
  items: AppNotification[];
}

const GROUP_LABELS: Record<NotificationGroupKey, string> = {
  payment: 'Payments & settlements',
  bank: 'Banking & feed health',
  member: 'Team & workspace access',
  email: 'Email delivery',
  query: 'Questions & record watches',
  document: 'Invoices, bills & documents',
};

const GROUP_ORDER: readonly NotificationGroupKey[] = [
  'payment',
  'document',
  'bank',
  'member',
  'email',
  'query',
];

export function classifyNotificationGroup(kind: string): NotificationGroupKey {
  if (kind.startsWith('payment')) return 'payment';
  if (kind.startsWith('bank')) return 'bank';
  if (kind.startsWith('member')) return 'member';
  if (kind.startsWith('email')) return 'email';
  if (kind.startsWith('query')) return 'query';
  return 'document';
}

/**
 * G-20: Groups notifications cleanly by kind family while preserving chronological order within each group.
 */
export function groupNotificationsByType(notifications: readonly AppNotification[]): NotificationGroup[] {
  const buckets = new Map<NotificationGroupKey, AppNotification[]>();
  for (const notice of notifications) {
    const key = classifyNotificationGroup(notice.kind);
    const list = buckets.get(key) ?? [];
    list.push(notice);
    buckets.set(key, list);
  }
  return GROUP_ORDER
    .filter(key => (buckets.get(key)?.length ?? 0) > 0)
    .map(key => {
      const items = buckets.get(key) ?? [];
      return {
        key,
        label: GROUP_LABELS[key],
        unreadCount: items.filter(item => !item.read).length,
        items,
      };
    });
}
