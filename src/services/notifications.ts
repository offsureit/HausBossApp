import { api } from '~/api/client';
import { subscribe as subscribeChannel } from '~/api/realtime';
import { fromApi, fromApiMap, ok, type ServiceResult } from '@/services/types';
import type { AppNotification, RealtimeChange, Unsubscribe } from '@/types';

/** In-app notifications (`/notifications*`): rows come from database triggers; the client reads the 50 newest. */

export const NOTIFICATIONS_PAGE_SIZE = 50;

export async function listRecent(): Promise<ServiceResult<AppNotification[]>> {
  return fromApiMap(() => api.get<AppNotification[]>('/notifications', { query: { limit: NOTIFICATIONS_PAGE_SIZE } }), (rows) => (rows ?? []).slice(0, NOTIFICATIONS_PAGE_SIZE), 'Failed to load notifications');
}

export async function markRead(notificationId: string): Promise<ServiceResult<{ id: string }>> {
  const result = await fromApi(() => api.post<unknown>(`/notifications/${encodeURIComponent(notificationId)}/read`), 'Failed to mark notification as read');
  return result.error ? { data: null, error: result.error } : ok({ id: notificationId });
}

export async function markAllRead(): Promise<ServiceResult<{ ok: true }>> {
  const result = await fromApi(() => api.post<unknown>('/notifications/read-all'), 'Failed to mark notifications as read');
  return result.error ? { data: null, error: result.error } : ok({ ok: true });
}

export function unreadCount(items: readonly AppNotification[]): number {
  return items.reduce((n, item) => (item.read_at ? n : n + 1), 0);
}

/** Channel `notifications-<userId>`: INSERT + UPDATE for the recipient. */
export function subscribe(userId: string, onChange: (change: RealtimeChange<AppNotification>) => void): Unsubscribe {
  return subscribeChannel<AppNotification>(`notifications-${userId}`, (change) => {
    if (change.eventType === 'DELETE') return;
    onChange(change);
  });
}

export const notificationsService = { listRecent, markRead, markAllRead, unreadCount, subscribe, NOTIFICATIONS_PAGE_SIZE };
