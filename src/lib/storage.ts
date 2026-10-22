import { createMMKV } from 'react-native-mmkv';

/** Fast synchronous key-value store for caches, preferences and the offline queue (not for tokens). */
export const storage = createMMKV({ id: 'hausboss' });

export const kv = {
  getString(key: string): string | null {
    return storage.getString(key) ?? null;
  },
  setString(key: string, value: string): void {
    storage.set(key, value);
  },
  getJSON<T>(key: string): T | null {
    const raw = storage.getString(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setJSON(key: string, value: unknown): void {
    storage.set(key, JSON.stringify(value));
  },
  remove(key: string): void {
    storage.remove(key);
  },
  /** Removes every key with the prefix (e.g. a signed-out user's caches). */
  removePrefix(prefix: string): void {
    for (const key of storage.getAllKeys()) if (key.startsWith(prefix)) storage.remove(key);
  },
};
