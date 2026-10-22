import { useEffect, type ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { setOnline } from '~/api/client';
import { configureSessionStorage } from '~/api/session';
import { AuthProvider } from '~/features/auth/AuthProvider';
import { CompanyProvider } from '~/features/company/CompanyProvider';
import { NotificationsProvider } from '~/features/notifications/NotificationsProvider';
import { SmsInboxProvider } from '~/features/sms/SmsInboxProvider';
import { secureStorage } from '~/lib/secureStorage';
import { storage } from '~/lib/storage';
import { ThemeProvider } from '~/theme/ThemeProvider';

// Tokens go to the Keychain / Keystore from the first import.
configureSessionStorage(secureStorage);

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Server state. Cached in MMKV so the app opens populated (and works offline) — see `persister`. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, gcTime: WEEK_MS, networkMode: 'offlineFirst', refetchOnReconnect: true },
    mutations: { networkMode: 'offlineFirst' },
  },
});

export const QUERY_CACHE_KEY = 'hb.rq';

const persister = createSyncStoragePersister({
  key: QUERY_CACHE_KEY,
  throttleTime: 1_000,
  storage: {
    getItem: (key) => storage.getString(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); },
    removeItem: (key) => { storage.remove(key); },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        const online = !!state.isConnected && state.isInternetReachable !== false;
        setOnline(online);
        onlineManager.setOnline(online);
      }),
    [],
  );

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: WEEK_MS, buster: 'rq-v1' }}>
      <ThemeProvider>
        <AuthProvider>
          <CompanyProvider>
            <NotificationsProvider>
              <SmsInboxProvider>{children}</SmsInboxProvider>
            </NotificationsProvider>
          </CompanyProvider>
        </AuthProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
