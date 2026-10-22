import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { kv } from '~/lib/storage';
import { pushService, type PushStatus } from '~/services/push';

export interface PushState {
  status: PushStatus | 'pending';
  detail?: string;
  token: string | null;
  /** Ask again (after the user allowed notifications in Settings). */
  retry: () => Promise<void>;
}

/**
 * Registers this device for push while signed in and routes notification taps (foreground
 * listener + the cold-start response). `onOpen` receives the notification id so the provider can
 * mark it read. Nothing happens for signed-out users.
 */
export function usePush(userId: string | null, onOpen?: (notificationId: string | undefined) => void): PushState {
  const router = useRouter();
  const [status, setStatus] = useState<PushState['status']>('pending');
  const [detail, setDetail] = useState<string | undefined>();
  const [token, setToken] = useState<string | null>(null);
  const handled = useRef<string | null>(null);
  const openRef = useRef(onOpen);
  useEffect(() => { openRef.current = onOpen; }, [onOpen]);

  const register = useCallback(async () => {
    if (!userId) { setStatus('unregistered'); setToken(null); return; }
    const result = await pushService.getPushToken();
    setDetail(result.detail);
    if (!result.token) { setStatus(result.status); setToken(null); return; }
    const { error } = await pushService.registerDevice(result.token);
    if (error) { setStatus('error'); setDetail(error.message); return; }
    setToken(result.token);
    setStatus('registered');
  }, [userId]);

  useEffect(() => { void register(); }, [register]);

  const open = useCallback((response: Notifications.NotificationResponse | null) => {
    if (!response) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const data = pushService.parsePushData(response.notification.request.content.data);
    openRef.current?.(data.notificationId);
    const route = pushService.routeForPush(data);
    router.push(route.params ? { pathname: route.pathname, params: route.params } : { pathname: route.pathname });
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    // Cold start from a push tap: the response is kept until read.
    void Notifications.getLastNotificationResponseAsync().then((r) => { if (r && kv.getString('hb.push.lastResponse') !== r.notification.request.identifier) { kv.setString('hb.push.lastResponse', r.notification.request.identifier); open(r); } }).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [userId, open]);

  return { status, detail, token, retry: register };
}
