import { create } from 'zustand';
import { kv } from '~/lib/storage';

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'hb.settings';

export interface NotificationPrefs {
  /** Haptic tap when a notification arrives (the web plays a chime). */
  haptic: boolean;
  /** In-app toast for new notifications. */
  toast: boolean;
}

interface Persisted {
  themeMode: ThemeMode;
  notifications: NotificationPrefs;
  /** Face ID / fingerprint before the app is shown (cold start and after 30 s in the background). */
  biometricLock: boolean;
}

interface SettingsState extends Persisted {
  setThemeMode: (mode: ThemeMode) => void;
  setNotificationPrefs: (next: Partial<NotificationPrefs>) => void;
  setBiometricLock: (on: boolean) => void;
}

const defaults: Persisted = { themeMode: 'system', notifications: { haptic: true, toast: true }, biometricLock: false };

function load(): Persisted {
  const saved = kv.getJSON<Partial<Persisted>>(KEY);
  const themeMode = saved?.themeMode === 'light' || saved?.themeMode === 'dark' ? saved.themeMode : 'system';
  return { themeMode, notifications: { ...defaults.notifications, ...(saved?.notifications ?? {}) }, biometricLock: saved?.biometricLock === true };
}

function persist(state: Persisted): void {
  kv.setJSON(KEY, { themeMode: state.themeMode, notifications: state.notifications, biometricLock: state.biometricLock });
}

/** Small device preferences (appearance, notification behaviour, biometric lock); persisted in MMKV, read synchronously at boot. */
export const useSettings = create<SettingsState>((set, get) => ({
  ...load(),
  setThemeMode: (themeMode) => { set({ themeMode }); persist(get()); },
  setNotificationPrefs: (next) => { set({ notifications: { ...get().notifications, ...next } }); persist(get()); },
  setBiometricLock: (biometricLock) => { set({ biometricLock }); persist(get()); },
}));
