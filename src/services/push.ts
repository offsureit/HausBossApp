import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { api, apiFetch } from '~/api/client';
import { isConnected } from '~/api/realtime';
import { kv } from '~/lib/storage';
import { fromApi, ok, type ServiceResult } from '@/services/types';

/**
 * Push registration (`POST/DELETE /notifications/devices`, docs/API.md) and the tap → screen
 * mapping. The server sends one Expo push per in-app notification with
 * `data: { notificationId, type, jobId?, conversationId? }`.
 *
 * An Expo push token needs the EAS project id (`extra.eas.projectId`, written by `eas init`) and,
 * on a device, FCM (Android) / APNs (iOS) credentials on the EAS project. Without them the status
 * is `no-project` / `error` and in-app (socket) notifications keep working — nothing is faked.
 */

export const PUSH_TOKEN_KEY = 'hb.push.token';
export const ANDROID_CHANNEL = 'default';

export type PushStatus = 'registered' | 'denied' | 'no-project' | 'unsupported' | 'error' | 'unregistered';

export interface PushData { notificationId?: string; type?: string; jobId?: string; conversationId?: string }

// Foreground: the realtime socket already toasts new notifications, so only show the system banner
// when the socket is down (otherwise the user would see two). The list / badge always update.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: !isConnected(), shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
});

export function projectId(): string | null {
  const fromConfig = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  const fromEas = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return fromConfig ?? fromEas ?? null;
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, { name: 'HausBaus', importance: AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250], lightColor: '#1a5cff' });
}

export async function getPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  return current.status === 'denied' && !current.canAskAgain ? 'denied' : 'undetermined';
}

export async function requestPermission(): Promise<'granted' | 'denied'> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted ? 'granted' : 'denied';
}

export interface PushTokenResult { token: string | null; status: PushStatus; detail?: string }

/** Permission → Android channel → Expo token (needs the EAS project id). Never throws. */
export async function getPushToken(): Promise<PushTokenResult> {
  if (!Device.isDevice && Platform.OS === 'ios') return { token: null, status: 'unsupported', detail: 'Push needs a physical iPhone' };
  if ((await requestPermission()) !== 'granted') return { token: null, status: 'denied' };
  await ensureAndroidChannel().catch(() => undefined);
  const id = projectId();
  if (!id) return { token: null, status: 'no-project', detail: 'No EAS project id in app config (run eas init)' };
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    return { token: data, status: 'registered' };
  } catch (err) {
    return { token: null, status: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}

export interface RegisteredDevice { id: string; platform: 'ios' | 'android'; device_id: string | null; device_name: string | null; app_version: string | null; created_at: string; last_seen_at: string }

export async function registerDevice(token: string): Promise<ServiceResult<RegisteredDevice>> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const result = await fromApi(() => api.post<RegisteredDevice>('/notifications/devices', {
    token, platform, device_id: Constants.sessionId ?? null, device_name: Device.modelName ?? null, app_version: Constants.expoConfig?.version ?? null,
  }), 'Could not register this device for push');
  if (!result.error) kv.setString(PUSH_TOKEN_KEY, token);
  return result;
}

export async function unregisterDevice(token: string): Promise<ServiceResult<{ removed: number }>> {
  const result = await fromApi(() => apiFetch<{ removed: number }>('/notifications/devices', { method: 'DELETE', body: { token }, timeoutMs: 8_000 }), 'Could not unregister this device');
  if (!result.error) kv.remove(PUSH_TOKEN_KEY);
  return result.error ? { data: null, error: result.error } : ok(result.data ?? { removed: 0 });
}

/** Sign-out helper: removes the token stored by the last successful registration. */
export async function unregisterCurrent(): Promise<void> {
  const token = kv.getString(PUSH_TOKEN_KEY);
  if (token) await unregisterDevice(token);
}

export function parsePushData(raw: unknown): PushData {
  if (!raw || typeof raw !== 'object') return {};
  const d = raw as Record<string, unknown>;
  const s = (k: string) => (typeof d[k] === 'string' && d[k] ? (d[k] as string) : undefined);
  return { notificationId: s('notificationId'), type: s('type'), jobId: s('jobId'), conversationId: s('conversationId') };
}

export type PushRoute = { pathname: '/job/[id]'; params: { id: string; tab?: 'chat' } } | { pathname: '/messages/[id]'; params: { id: string } } | { pathname: '/notifications'; params?: undefined };

/** Where a tapped push opens: the SMS thread, the job (chat tab for chat messages), else the notification centre. */
export function routeForPush(data: PushData): PushRoute {
  if (data.conversationId) return { pathname: '/messages/[id]', params: { id: data.conversationId } };
  if (data.jobId) return { pathname: '/job/[id]', params: data.type === 'chat_message' ? { id: data.jobId, tab: 'chat' } : { id: data.jobId } };
  return { pathname: '/notifications' };
}

export async function setBadge(count: number): Promise<void> {
  try { await Notifications.setBadgeCountAsync(Math.max(0, count)); } catch { /* unsupported */ }
}

export const pushService = { getPushToken, getPermission, requestPermission, registerDevice, unregisterDevice, unregisterCurrent, parsePushData, routeForPush, projectId, setBadge, PUSH_TOKEN_KEY };
