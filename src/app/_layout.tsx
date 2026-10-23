import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { OfflineBanner } from '~/components/OfflineBanner';
import { StackHeader, type StackHeaderProps } from '~/components/navigation/StackHeader';
import { ToastHost } from '~/components/ui';
import { AppProviders } from '~/features/app/AppProviders';
import { useAuth } from '~/features/auth/AuthProvider';
import { LockProvider } from '~/features/auth/LockProvider';
import { useOfflineQueueSync } from '~/features/offline/useOfflineQueue';
import { monitoring } from '~/lib/monitoring';
import '~/services/backgroundLocation'; // defines the background location task at module scope (also for headless starts)
import { useTheme } from '~/theme/ThemeProvider';
import { fontFamily } from '~/theme/tokens';

// Crash / performance monitoring first (disabled without EXPO_PUBLIC_SENTRY_DSN), then the splash
// stays up until fonts + the stored session are ready (hard cap 1.5 s).
monitoring.init();
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

const BOOT_DEADLINE_MS = 1_500;

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProviders>
        <LockProvider>
          <RootNavigator fontsReady={fontsLoaded || !!fontError} />
          <ToastHost />
        </LockProvider>
      </AppProviders>
    </GestureHandlerRootView>
  );
}

export default monitoring.wrap(RootLayout);

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const auth = useAuth();
  const { colors, scheme } = useTheme();
  const [deadline, setDeadline] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDeadline(true), BOOT_DEADLINE_MS);
    return () => clearTimeout(t);
  }, []);

  const ready = (fontsReady && auth.status !== 'booting') || deadline;
  useEffect(() => { if (ready) SplashScreen.hide(); }, [ready]);
  useOfflineQueueSync(auth.status === 'signedIn');

  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: colors.accent, background: colors.background, card: colors.card, text: colors.foreground, border: colors.border, notification: colors.accent },
      fonts: {
        regular: { fontFamily: fontFamily.regular, fontWeight: '400' as const },
        medium: { fontFamily: fontFamily.medium, fontWeight: '500' as const },
        bold: { fontFamily: fontFamily.bold, fontWeight: '700' as const },
        heavy: { fontFamily: fontFamily.bold, fontWeight: '700' as const },
      },
    };
  }, [scheme, colors]);

  if (!ready) return null;
  const signedIn = auth.status === 'signedIn';

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, header: (props) => <StackHeader {...(props as unknown as StackHeaderProps)} />, contentStyle: { backgroundColor: colors.background }, headerTitleStyle: { fontFamily: fontFamily.semibold }, headerBackButtonDisplayMode: 'minimal', headerTintColor: colors.accent, headerStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        {/* Deep-link targets that work signed in or out */}
        <Stack.Screen name="accept-invite" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="public-estimate/[token]" options={{ headerShown: true, title: 'Estimate' }} />
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn} redirectTo="/login">
          <Stack.Screen name="(app)" />
          {/* Job details brings its own gradient card, so its header stays light. */}
          <Stack.Screen name="job/[id]" options={{ headerShown: true, title: 'Job', header: (props) => <StackHeader {...(props as unknown as StackHeaderProps)} variant="plain" /> }} />
          <Stack.Screen name="job/new" options={{ headerShown: true, title: 'New job', presentation: 'modal' }} />
          <Stack.Screen name="estimate/[id]" options={{ headerShown: true, title: 'Estimate' }} />
          <Stack.Screen name="chat/[jobId]" options={{ headerShown: true, title: 'Chat' }} />
          <Stack.Screen name="messages/[id]" options={{ headerShown: true, title: 'Conversation' }} />
          <Stack.Screen name="customers/index" options={{ headerShown: true, title: 'Customers' }} />
          <Stack.Screen name="customers/new" options={{ headerShown: true, title: 'New customer', presentation: 'modal' }} />
          <Stack.Screen name="customers/[id]/index" options={{ headerShown: true, title: 'Customer' }} />
          <Stack.Screen name="customers/[id]/edit" options={{ headerShown: true, title: 'Edit customer', presentation: 'modal' }} />
          <Stack.Screen name="search" options={{ headerShown: true, title: 'Search', presentation: 'modal' }} />
          <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
          <Stack.Screen name="settings/products" options={{ headerShown: true, title: 'Products & services' }} />
          <Stack.Screen name="settings/inventory" options={{ headerShown: true, title: 'Truck stock' }} />
          <Stack.Screen name="settings/categories" options={{ headerShown: true, title: 'Job categories' }} />
          <Stack.Screen name="settings/team" options={{ headerShown: true, title: 'Team' }} />
          <Stack.Screen name="settings/leads" options={{ headerShown: true, title: 'Leads' }} />
          <Stack.Screen name="settings/billing" options={{ headerShown: true, title: 'Billing' }} />
          <Stack.Screen name="settings/security" options={{ headerShown: true, title: 'Security & permissions' }} />
        </Stack.Protected>
      </Stack>
      {signedIn ? <OfflineBanner /> : null}
      </View>
    </NavigationThemeProvider>
  );
}
