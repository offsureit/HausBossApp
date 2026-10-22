import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Send } from 'lucide-react-native';
import { IconButton, Text } from '~/components/ui';
import { SMS_MAX_LENGTH } from '~/services/sms';
import { useTheme } from '~/theme/ThemeProvider';
import { fontFamily, radius, spacing } from '~/theme/tokens';

export interface SmsComposerProps {
  onSend: (body: string) => Promise<boolean>;
  /** When set, the composer is disabled and this text is shown instead of the counter. */
  disabledReason?: string | null;
}

/** Text input + send, 1600 characters max (web `SmsComposer`). */
export function SmsComposer({ onSend, disabledReason }: SmsComposerProps) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const disabled = !!disabledReason || sending;
  const trimmed = text.trim();
  const canSend = !disabled && trimmed.length > 0 && trimmed.length <= SMS_MAX_LENGTH;
  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    const ok = await onSend(trimmed);
    setSending(false);
    if (ok) setText('');
  };
  return (
    <View style={[styles.wrap, { borderTopColor: colors.border, backgroundColor: colors.background }]} accessibilityLabel="Send text message">
      <View style={styles.row}>
        <TextInput
          accessibilityLabel="Message"
          value={text}
          onChangeText={setText}
          placeholder={disabledReason ?? 'Type a text message…'}
          placeholderTextColor={colors.mutedForeground}
          editable={!disabled}
          multiline
          maxLength={SMS_MAX_LENGTH}
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]}
        />
        <IconButton icon={Send} label="Send" tone="accent" variant="filled" onPress={() => void submit()} disabled={!canSend} />
      </View>
      <Text variant="caption" color="mutedForeground">{disabledReason ?? `${trimmed.length}/${SMS_MAX_LENGTH}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[2], gap: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  input: { flex: 1, minHeight: 44, maxHeight: 140, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontFamily: fontFamily.regular, fontSize: 16 },
});
