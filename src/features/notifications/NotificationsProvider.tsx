import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '~/features/auth/AuthProvider';
import { useSettings } from '~/features/settings/store';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import { notificationsService } from '~/services/notifications';
import { pushService } from '~/services/push';
import type { AppNotification } from '@/types';
import { usePush, type PushState } from './usePush';

export interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  /** Unread chat messages per job (for the Chat tab and thread badges). */
  unreadChatByJob: Map<string, number>;
  loading: boolean;
  error: string | null;
  /** Push registration state for this device (More → Notifications). */
  push: PushState;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

/**
 * The user's in-app notifications (`GET /notifications` + `notifications-<userId>`), like the web
 * `NotificationsContext`: unread count, chat badges, toast + haptic on arrival (per the device prefs).
 * Also owns push registration and the app-icon badge (Phase 4).
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const userId = status === 'signedIn' ? user?.id ?? null : null;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) { setNotifications([]); return; }
    setLoading(true);
    const { data, error: err } = await notificationsService.listRecent();
    setError(err?.message ?? null);
    if (data) setNotifications(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    return notificationsService.subscribe(userId, (change) => {
      const n = change.new;
      if (!n) return;
      if (change.eventType === 'INSERT') {
        setNotifications((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev].slice(0, notificationsService.NOTIFICATIONS_PAGE_SIZE)));
        const prefs = useSettings.getState().notifications;
        if (prefs.haptic) haptics.soft();
        if (prefs.toast) toast.info(n.title, { description: n.body ?? undefined, action: n.job_id ? { label: 'Open', onPress: () => router.push({ pathname: '/job/[id]', params: { id: n.job_id as string, ...(n.type === 'chat_message' ? { tab: 'chat' } : {}) } }) } : undefined });
      } else if (change.eventType === 'UPDATE') {
        setNotifications((prev) => prev.map((p) => (p.id === n.id ? n : p)));
      }
    });
  }, [userId, router]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)));
    const { error: err } = await notificationsService.markRead(id);
    if (err) toast.error(err.message);
  }, []);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    const { error: err } = await notificationsService.markAllRead();
    if (err) toast.error(err.message);
  }, []);

  // A tapped push opens its target and marks the in-app row read.
  const push = usePush(userId, (notificationId) => { if (notificationId) void markRead(notificationId); });

  const unreadCount = notificationsService.unreadCount(notifications);
  useEffect(() => { if (userId) void pushService.setBadge(unreadCount); }, [userId, unreadCount]);

  const value = useMemo<NotificationsContextValue>(() => {
    const unreadChatByJob = new Map<string, number>();
    notifications.filter((n) => n.type === 'chat_message' && !n.read_at && n.job_id).forEach((n) => unreadChatByJob.set(n.job_id as string, (unreadChatByJob.get(n.job_id as string) ?? 0) + 1));
    return { notifications, unreadCount, unreadChatByJob, loading, error, push, refresh, markRead, markAllRead };
  }, [notifications, unreadCount, loading, error, push, refresh, markRead, markAllRead]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
