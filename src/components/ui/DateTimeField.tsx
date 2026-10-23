import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { CalendarDays, Clock, X } from 'lucide-react-native';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { useTheme } from '~/theme/ThemeProvider';
import { fieldSurface, fontFamily, radius, spacing, touchTarget } from '~/theme/tokens';

export interface DateTimeFieldProps {
  label: string;
  mode: 'date' | 'time';
  value: Date | null;
  onChange: (value: Date | null) => void;
  placeholder?: string;
  minimumDate?: Date;
  /** Time step in minutes (15 = the §15 scheduling increment). */
  minuteInterval?: 1 | 5 | 10 | 15 | 30;
  clearable?: boolean;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
}

function snap(date: Date, interval: number): Date {
  const d = new Date(date);
  d.setMinutes(Math.round(d.getMinutes() / interval) * interval, 0, 0);
  return d;
}

/** Native date / time picker field: Android opens the system dialog, iOS shows a spinner in a sheet. */
export function DateTimeField({ label, mode, value, onChange, placeholder, minimumDate, minuteInterval = 15, clearable = true, error, hint, disabled }: DateTimeFieldProps) {
  const { colors, scheme } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? snap(new Date(), minuteInterval));
  const Icon = mode === 'date' ? CalendarDays : Clock;
  const text = value ? (mode === 'date' ? format(value, value.getFullYear() === new Date().getFullYear() ? 'EEE MMM d' : 'MMM d, yyyy') : format(value, 'h:mm a')) : (placeholder ?? (mode === 'date' ? 'Pick a date' : 'Pick a time'));

  const openPicker = () => {
    const current = value ?? snap(new Date(), minuteInterval);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode,
        minimumDate,
        is24Hour: false,
        minuteInterval: mode === 'time' ? minuteInterval : undefined,
        onChange: (event: DateTimePickerEvent, date?: Date) => { if (event.type === 'set' && date) onChange(mode === 'time' ? snap(date, minuteInterval) : date); },
      });
    } else {
      setDraft(current);
      setIosOpen(true);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text variant="label" style={styles.label}>{label}</Text>
      {/* The clear button sits inside the field, so two fields fit side by side without wrapping. */}
      <View style={[styles.field, fieldSurface(colors, scheme, { error: !!error, disabled: !!disabled })]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${text}`} disabled={disabled} onPress={openPicker} style={styles.press}>
          <Icon size={16} color={colors.accent} />
          <Text variant="body" color={value ? 'foreground' : 'mutedForeground'} style={styles.value} numberOfLines={1}>{text}</Text>
        </Pressable>
        {clearable && value && !disabled ? <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label}`} onPress={() => onChange(null)} hitSlop={8} style={[styles.clear, { backgroundColor: colors.muted }]}><X size={14} color={colors.mutedForeground} /></Pressable> : null}
      </View>
      {error ? <Text variant="caption" color="destructive">{error}</Text> : hint ? <Text variant="caption" color="mutedForeground">{hint}</Text> : null}
      {Platform.OS === 'ios' ? (
        <Sheet open={iosOpen} onClose={() => setIosOpen(false)} title={label} footer={<Button label="Done" size="lg" fullWidth onPress={() => { onChange(mode === 'time' ? snap(draft, minuteInterval) : draft); setIosOpen(false); }} />}>
          <DateTimePicker value={draft} mode={mode} display="spinner" minimumDate={minimumDate} minuteInterval={mode === 'time' ? minuteInterval : undefined} themeVariant={scheme} onChange={(_, d) => { if (d) setDraft(d); }} />
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  field: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: touchTarget + 8, borderRadius: radius.lg - 4, paddingLeft: spacing[3], paddingRight: spacing[2] },
  value: { flex: 1, minWidth: 0 },
  clear: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  press: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'stretch' },
});
