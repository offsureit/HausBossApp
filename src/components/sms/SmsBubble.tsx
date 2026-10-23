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

/**
 * A short, readable reason from a provider error. Telnyx answers `Telnyx 400: {"errors":[{"title","detail"}]}`;
 * the JSON is reduced to its detail (or title). Anything else keeps its first line, capped.
 */
export function friendlySmsError(raw: string): string {
  const start = raw.indexOf('{');
  if (start >= 0) {
    try {
      const body = JSON.parse(raw.slice(start)) as { errors?: { title?: string; detail?: string }[] };
      const first = body.errors?.[0];
      const text = (first?.detail || first?.title || '').trim();
      if (text) return text.replace(/\.$/, '');
    } catch { /* cut-off JSON: read the fields directly */ }
    const field = /"detail"\s*:\s*"([^"]+)"/.exec(raw) ?? /"title"\s*:\s*"([^"]+)"/.exec(raw);
    if (field) return field[1].trim().replace(/\.$/, '');
  }
  const line = raw.split('\n')[0].replace(/[{:\s]+$/, '').trim();
  return line.length > 120 ? `${line.slice(0, 117)}…` : line || 'Unknown error';
}

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
        {m.error ? (
          <View style={[styles.error, { backgroundColor: outbound ? 'rgba(0,0,0,0.2)' : withAlpha(colors.destructive, 0.12) }]} accessibilityLabel={`Not delivered: ${friendlySmsError(m.error)}`}>
            <AlertCircle size={13} color={outbound ? '#fecaca' : colors.destructive} />
            <Text variant="caption" color={outbound ? '#fee2e2' : 'destructive'} style={styles.errorText}>Not delivered: {friendlySmsError(m.error)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-start' },
  rowOut: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderRadius: radius.md, paddingHorizontal: spacing[2], paddingVertical: 6, marginTop: 6 },
  errorText: { flex: 1, fontFamily: 'Inter_500Medium' },
});
