import { StyleSheet, View } from 'react-native';
import { formatDistanceToNowStrict } from 'date-fns';
import { Ban, UserCheck } from 'lucide-react-native';
import type { SmsConversation } from '@/types';
import { PressableScale, Text } from '~/components/ui';
import { smsService } from '~/services/sms';
import { useTheme } from '~/theme/ThemeProvider';
import { fontFamily, radius, spacing, withAlpha } from '~/theme/tokens';

const DIVISION_LABEL: Record<string, string> = { residential: 'Residential', commercial: 'Commercial' };

/** One inbox row: title, time, unread badge, last message preview, assignment / opt-out / resolved chips. */
export function ConversationRow({ conversation: c, onPress }: { conversation: SmsConversation; onPress: () => void }) {
  const { colors } = useTheme();
  const title = smsService.conversationTitle(c);
  const unread = c.status === 'open' && c.unread_count > 0;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`${title}${unread ? `, ${c.unread_count} unread` : ''}`} onPress={onPress} scaleTo={0.985} style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.head}>
        <Text variant={unread ? 'bodyMedium' : 'body'} style={[styles.grow, unread && { fontFamily: fontFamily.semibold }]} numberOfLines={1}>{title}</Text>
        {c.last_message_at ? <Text variant="caption" color="mutedForeground">{formatDistanceToNowStrict(new Date(c.last_message_at))}</Text> : null}
        {unread ? <View style={[styles.badge, { backgroundColor: colors.accent }]}><Text variant="caption" color="accentForeground">{c.unread_count}</Text></View> : null}
      </View>
      <Text variant="small" color={unread ? 'foreground' : 'mutedForeground'} numberOfLines={2}>
        {c.last_direction === 'outbound' ? <Text variant="small" color="mutedForeground">You: </Text> : null}
        {c.last_message_preview ?? 'No messages yet'}
      </Text>
      {c.assigned_name || c.sms_opted_out || c.status === 'resolved' || c.division ? (
        <View style={styles.chips}>
          {c.division ? <Chip label={DIVISION_LABEL[c.division] ?? c.division} color={colors.mutedForeground} /> : null}
          {c.assigned_name ? <Chip label={c.assigned_name} color={colors.accent} icon={<UserCheck size={12} color={colors.accent} />} /> : null}
          {c.sms_opted_out ? <Chip label="Opted out" color={colors.destructive} icon={<Ban size={12} color={colors.destructive} />} /> : null}
          {c.status === 'resolved' ? <Chip label="Resolved" color={colors.mutedForeground} /> : null}
        </View>
      ) : null}
    </PressableScale>
  );
}

function Chip({ label, color, icon }: { label: string; color: string; icon?: React.ReactNode }) {
  return <View style={[styles.chip, { backgroundColor: withAlpha(color, 0.12) }]}>{icon}<Text variant="caption" color={color}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing[3], gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  grow: { flex: 1, minWidth: 0 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
});
