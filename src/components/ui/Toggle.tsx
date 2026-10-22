import { Platform, Switch, type SwitchProps } from 'react-native';
import { useTheme } from '~/theme/ThemeProvider';

/**
 * Themed on/off switch: brand-blue track with a white thumb when on, muted track with a light
 * thumb when off, in both colour schemes. Wraps RN's Switch so Android does not fall back to the
 * system's teal thumb next to a blue track.
 */
export function Toggle({ value, disabled, ...rest }: SwitchProps) {
  const { colors, scheme } = useTheme();
  const offTrack = scheme === 'dark' ? colors.muted : colors.border;
  const thumb = value ? '#ffffff' : scheme === 'dark' ? colors.mutedForeground : '#f8fafc';
  return (
    <Switch
      value={value}
      disabled={disabled}
      trackColor={{ true: colors.accent, false: offTrack }}
      thumbColor={Platform.OS === 'android' ? thumb : undefined}
      ios_backgroundColor={offTrack}
      style={disabled ? { opacity: 0.5 } : undefined}
      {...rest}
    />
  );
}
