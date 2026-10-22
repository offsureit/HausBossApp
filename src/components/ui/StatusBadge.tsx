import { StyleSheet, View } from 'react-native';
import { jobStatusLabel, normalizeJobStatus } from '@/utils/jobStatus';
import { Text } from './Text';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, statusBadge, statusColors } from '~/theme/tokens';

/** The job status pill — same labels and colours as the web `StatusBadge`. */
export function StatusBadge({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const { scheme } = useTheme();
  const key = normalizeJobStatus(status);
  const palette = statusBadge[key][scheme];
  return (
    <View accessibilityLabel={`Status: ${jobStatusLabel(key)}`} style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }, size === 'sm' && styles.small]}>
      <View style={[styles.dot, { backgroundColor: statusColors[key] }]} />
      <Text variant="caption" color={palette.fg} style={styles.label}>{jobStatusLabel(key)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing[2], paddingVertical: 3, alignSelf: 'flex-start' },
  small: { paddingVertical: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontFamily: 'Inter_500Medium' },
});
