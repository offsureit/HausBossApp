import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { ChevronLeft, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackdrop, HERO_TEXT_MUTED, PressableScale, Text, useLightStatusBar } from '~/components/ui';
import { useTheme } from '~/theme/ThemeProvider';
import { elevation, radius, spacing } from '~/theme/tokens';

/** The props expo-router's Stack hands to a custom `header` (React Navigation's NativeStackHeaderProps, trimmed). */
export interface StackHeaderProps {
  navigation: { goBack: () => void; canGoBack: () => boolean };
  options: { title?: string; presentation?: string; headerRight?: (props: { tintColor?: string; canGoBack: boolean }) => ReactNode };
  back?: { title?: string } | undefined;
}

/**
 * Header for every pushed screen. `gradient` (default): the brand gradient with a frosted round back
 * button and white title, rounded bottom corners — the same family as the tab heroes. `plain`: the page
 * colour with a floating round back button, for screens that bring their own gradient (job details).
 * Modals get a close (×) button instead of the back chevron.
 */
export function StackHeader({ navigation, options, back, variant = 'gradient', subtitle }: StackHeaderProps & { variant?: 'gradient' | 'plain'; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const gradient = variant === 'gradient';
  const modal = options.presentation === 'modal' && Platform.OS === 'ios';
  const tint = gradient ? '#ffffff' : colors.foreground;
  const canGoBack = !!back || navigation.canGoBack();
  const BackIcon = options.presentation === 'modal' ? X : ChevronLeft;
  return gradient ? <GradientStatusBar>{bar()}</GradientStatusBar> : bar();

  function bar() {
    return (
    <View style={[styles.bar, { paddingTop: (modal ? spacing[3] : insets.top) + spacing[2], backgroundColor: gradient ? 'transparent' : colors.background }]}>
      {gradient ? <GradientBackdrop rounded={0} watermark={false} /> : null}
      <View style={styles.row}>
        {canGoBack ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={options.presentation === 'modal' ? 'Close' : back?.title ? `Back to ${back.title}` : 'Back'}
            onPress={() => navigation.goBack()}
            style={[styles.back, gradient ? styles.backGlass : [{ backgroundColor: colors.card, borderColor: colors.border }, elevation(1, scheme)]]}
          >
            <BackIcon size={22} color={tint} />
          </PressableScale>
        ) : <View style={styles.back} />}
        <View style={styles.title}>
          <Text variant="heading" color={tint} numberOfLines={1} accessibilityRole="header">{options.title ?? ''}</Text>
          {subtitle ? <Text variant="caption" color={gradient ? HERO_TEXT_MUTED : 'mutedForeground'} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <View style={styles.right}>{options.headerRight?.({ tintColor: tint, canGoBack }) ?? null}</View>
      </View>
    </View>
    );
  }
}

/** Light status-bar icons over the gradient while this screen is focused. */
function GradientStatusBar({ children }: { children: ReactNode }) {
  useLightStatusBar();
  return <>{children}</>;
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: spacing[4], paddingBottom: spacing[3], borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 44 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  backGlass: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)' },
  title: { flex: 1, minWidth: 0, alignItems: 'center' },
  right: { minWidth: 40, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
});
