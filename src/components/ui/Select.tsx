import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { useTheme } from '~/theme/ThemeProvider';
import { fieldSurface, fontFamily, radius, spacing, touchTarget, withAlpha } from '~/theme/tokens';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Leading decoration (an identity colour dot, an icon). */
  leading?: ReactNode;
  description?: string;
}

export interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  error?: string | null;
  /** Extra content under the option list (e.g. "add a category"). */
  extra?: ReactNode;
}

/** Native-feeling picker: a field that opens the options in a bottom sheet. */
export function Select<T extends string>({ label, value, options, onChange, placeholder = 'Select', disabled, hint, error, extra }: SelectProps<T>) {
  const { colors, scheme } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={styles.wrap}>
      <Text variant="label" style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.field, fieldSurface(colors, scheme, { error: !!error, disabled: !!disabled }), disabled && { opacity: 0.8 }]}
      >
        {current?.leading ? <View style={styles.leading}>{current.leading}</View> : null}
        <Text variant="body" color={current ? 'foreground' : 'mutedForeground'} style={styles.value} numberOfLines={1}>{current?.label ?? placeholder}</Text>
        <ChevronDown size={18} color={colors.mutedForeground} />
      </Pressable>
      {error ? <Text variant="caption" color="destructive">{error}</Text> : hint ? <Text variant="caption" color="mutedForeground">{hint}</Text> : null}
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => { onChange(o.value); setOpen(false); }} style={[styles.option, selected && { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
              {o.leading ? <View style={styles.leading}>{o.leading}</View> : null}
              <View style={styles.optionText}>
                <Text variant={selected ? 'bodyMedium' : 'body'}>{o.label}</Text>
                {o.description ? <Text variant="caption" color="mutedForeground">{o.description}</Text> : null}
              </View>
              {selected ? <Check size={18} color={colors.accent} /> : null}
            </Pressable>
          );
        })}
        {extra}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18 },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: touchTarget + 8, borderRadius: radius.lg - 4, paddingHorizontal: spacing[4] },
  leading: { marginRight: spacing[1] },
  value: { flex: 1, minWidth: 0 },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: touchTarget + 4, paddingHorizontal: spacing[3], borderRadius: radius.md },
  optionText: { flex: 1, minWidth: 0 },
});
