import { StyleSheet, View } from 'react-native';
import { format } from 'date-fns';
import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react-native';
import type { SmsMessage, SmsMessageStatus } from '@/types';
import { Text } from '~/components/ui';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';

const STATUS: Record<SmsMessageStatus, { label: string; icon: typeof Check; tone: 'muted' | 'success' | 'error' }> = {
  received: { label: 'Received', icon: Check, tone: 'muted' },
  queued: { label: 'Sending', icon: Clock, tone: 'muted' },
  sent: { label: 'Sent', icon: Check, tone: 'muted' },
  delivered: { label: 'Delivered', icon: CheckCheck, tone: 'success' },
  failed: { label: 'Failed', icon: AlertCircle, tone: 'error' },
  undelivered: { label: 'Not delivered', icon: AlertCircle, tone: 'error' },
};

/** One text message: inbound left / outbound right, with sender, time and delivery status. */
export function SmsBubble({ message: m }: { message: SmsMessage }) {
  const { colors } = useTheme();
  const outbound = m.direction === 'outbound';
  const meta = STATUS[m.status] ?? STATUS.queued;
  const Icon = meta.icon;
  const metaColor = outbound ? (meta.tone === 'error' ? '#fecaca' : withAlpha('#ffffff', 0.75)) : meta.tone === 'error' ? colors.destructive : meta.tone === 'success' ? colors.success : colors.mutedForeground;
  return (
    <View style={[styles.row, outbound && styles.rowOut]}>
      <View style={[styles.bubble, outbound ? { backgroundColor: colors.accent, borderBottomRightRadius: 4 } : { backgroundColor: colors.muted, borderBottomLeftRadius: 4 }]}>
        <Text variant="body" color={outbound ? 'accentForeground' : 'foreground'}>{m.body}</Text>
        <View style={styles.meta}>
          {outbound ? <Text variant="caption" color={metaColor}>{m.sender_name ?? 'Automated'} · </Text> : null}
          <Text variant="caption" color={metaColor}>{format(new Date(m.created_at), 'MMM d, h:mm a')}</Text>
          {outbound ? <><Text variant="caption" color={metaColor}> · </Text><Icon size={12} color={metaColor} /><Text variant="caption" color={metaColor}> {meta.label}</Text></> : null}
        </View>
        {m.error ? <View style={[styles.error, { backgroundColor: withAlpha(colors.destructive, 0.85) }]}><Text variant="caption" color="destructiveForeground">{m.error}</Text></View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-start' },
  rowOut: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: spacing[3], paddingVertical: spacing[2], gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  error: { borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
});
