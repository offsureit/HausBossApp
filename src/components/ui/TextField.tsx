import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { Text } from './Text';
import { useTheme } from '~/theme/ThemeProvider';
import { fieldSurface, fontFamily, radius, spacing, touchTarget } from '~/theme/tokens';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
  leading?: ReactNode;
  /** Password fields get a show / hide toggle. */
  secure?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export function TextField({ label, error, hint, leading, secure = false, style, editable = true, ref, ...rest }: TextFieldProps) {
  const { colors, scheme } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);

  return (
    <View style={styles.wrap}>
      <Text variant="label" color={focused ? 'accent' : 'foreground'} style={styles.label}>{label}</Text>
      <View style={[styles.box, fieldSurface(colors, scheme, { focused, error: !!error }), !editable && { opacity: 0.6 }]}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.mutedForeground}
          selectionColor={colors.accent}
          editable={editable}
          {...rest}
          secureTextEntry={secure ? hidden : rest.secureTextEntry}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={[styles.input, { color: colors.foreground }, style]}
        />
        {secure ? (
          <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'} onPress={() => setHidden((h) => !h)} hitSlop={8} style={styles.toggle}>
            {hidden ? <Eye size={20} color={colors.mutedForeground} /> : <EyeOff size={20} color={colors.mutedForeground} />}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text variant="caption" color="destructive" accessibilityLiveRegion="polite">{error}</Text> : hint ? <Text variant="caption" color="mutedForeground">{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18 },
  box: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg - 4, minHeight: touchTarget + 8, paddingHorizontal: spacing[4] },
  leading: { marginRight: spacing[2] },
  input: { flex: 1, fontFamily: fontFamily.regular, fontSize: 16, paddingVertical: spacing[3], minHeight: touchTarget },
  toggle: { padding: spacing[1] },
});
