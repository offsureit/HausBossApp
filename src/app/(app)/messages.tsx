import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageCircle, Search, Settings } from 'lucide-react-native';
import { NOT_IN_PLAN_TEXT } from '@/lib/plan';
import type { SmsListFilter } from '@/types';
import { ConversationRow } from '~/components/sms/ConversationRow';
import { Button, EmptyState, Screen, ScreenHeader, SegmentedControl, SkeletonCard, Text, TextField } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useSmsInbox } from '~/features/sms/SmsInboxProvider';
import { smsService } from '~/services/sms';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

/** Customer SMS inbox: Open / Resolved / All, search, rows → thread (web `SmsInbox`, stacked). */
export default function MessagesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const inbox = useSmsInbox();
  const [query, setQuery] = useState('');
  const rows = useMemo(() => inbox.conversations.filter((c) => smsService.matchesConversation(c, query)), [inbox.conversations, query]);

  if (!inbox.inPlan) {
    return (
      <Screen scroll>
        <ScreenHeader title="Messages" />
        <EmptyState icon={MessageCircle} title={NOT_IN_PLAN_TEXT.sms} message="Choose a package (Monthly, Annual or Lifetime) on the web to text customers from HausBoss." action={isAdmin ? <Button label="Billing" variant="outline" onPress={() => router.push('/settings/billing')} /> : undefined} />
      </Screen>
    );
  }

  const emptyHint = !inbox.configured ? 'No SMS number configured. Add your Telnyx number in Settings → General on the web.' : query ? 'No conversations match your search.' : inbox.filter === 'open' ? 'No open conversations.' : 'No conversations yet.';

  return (
    <Screen scroll refreshing={inbox.loading && inbox.conversations.length > 0} onRefresh={() => void inbox.refresh()} contentContainerStyle={styles.content}>
      <ScreenHeader title="Messages" subtitle={inbox.unreadTotal > 0 ? `${inbox.unreadTotal} unread` : 'Customer texts'} />
      <SegmentedControl<SmsListFilter> value={inbox.filter} segments={[{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }, { value: 'all', label: 'All' }]} onChange={inbox.setFilter} accessibilityLabel="Conversation filter" />
      <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Name or phone" autoCorrect={false} leading={<Search size={18} color={colors.mutedForeground} />} />
      {inbox.loading && inbox.conversations.length === 0 ? <View style={styles.list}><SkeletonCard /><SkeletonCard /></View>
        : rows.length === 0 ? (
          <EmptyState icon={inbox.configured ? MessageCircle : Settings} title={emptyHint} message={inbox.error ?? undefined} />
        ) : (
          <View>
            {rows.map((c) => <ConversationRow key={c.id} conversation={c} onPress={() => router.push({ pathname: '/messages/[id]', params: { id: c.id } })} />)}
            <Text variant="caption" color="mutedForeground" style={styles.count}>{rows.length} conversation{rows.length === 1 ? '' : 's'}</Text>
          </View>
        )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[3] },
  list: { gap: spacing[3] },
  count: { paddingTop: spacing[3] },
});
