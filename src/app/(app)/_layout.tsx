import { useCallback, useMemo } from 'react';
import { Tabs } from 'expo-router';
import { CalendarDays, LayoutDashboard, Menu, MessageCircle, MessageSquare, Sun } from 'lucide-react-native';
import { BootScreen } from '~/components/BootScreen';
import { AnimatedTabBar, type BottomTabBarProps, type TabIcon } from '~/components/navigation/AnimatedTabBar';
import { useAuth } from '~/features/auth/AuthProvider';
import { tabsFor } from '~/features/auth/roles';
import { useNotifications } from '~/features/notifications/NotificationsProvider';
import { useSmsInbox } from '~/features/sms/SmsInboxProvider';
import { useTheme } from '~/theme/ThemeProvider';

const ICONS: Record<string, TabIcon> = { today: Sun, calendar: CalendarDays, dashboard: LayoutDashboard, chat: MessageSquare, messages: MessageCircle, more: Menu };

/**
 * Bottom tabs by role (docs/MOBILE_APP_PROMPT.md "Screens"):
 * staff: Calendar · Dashboard · Chat · Messages · More — technician: Today · Calendar · Chat · Messages · More.
 * Rendered by the animated tab bar with unread badges for Chat (job threads) and Messages (texts).
 */
export default function AppLayout() {
  const auth = useAuth();
  const { colors } = useTheme();
  const { unreadChatByJob, unreadCount } = useNotifications();
  const { unreadTotal } = useSmsInbox();
  const chatUnread = useMemo(() => Array.from(unreadChatByJob.values()).reduce((a, b) => a + b, 0), [unreadChatByJob]);
  const badges = useMemo(() => ({ chat: chatUnread, messages: unreadTotal, more: Math.max(0, unreadCount - chatUnread) }), [chatUnread, unreadTotal, unreadCount]);
  const tabBar = useCallback((props: BottomTabBarProps) => <AnimatedTabBar {...props} icons={ICONS} badges={badges} />, [badges]);

  if (auth.profileError) return <BootScreen problem={auth.profileError} onRetry={() => void auth.refreshProfile()} onSignOut={() => void auth.signOut()} />;
  if (auth.profileLoading) return <BootScreen />;

  const tabs = tabsFor(auth);

  return (
    <Tabs tabBar={tabBar} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}>
      <Tabs.Screen name="today" options={{ title: 'Today', href: tabs.includes('today') ? undefined : null }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', href: tabs.includes('dashboard') ? undefined : null }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
