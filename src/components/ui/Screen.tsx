import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

export interface ScreenProps {
  children: ReactNode;
  /** Scrollable content with optional pull-to-refresh. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, 'children' | 'refreshControl' | 'contentContainerStyle'>;
}

/** Safe-area aware page background. Tab screens leave the bottom edge to the tab bar. */
export function Screen({ children, scroll = false, refreshing = false, onRefresh, edges = ['top', 'left', 'right'], padded = true, style, contentContainerStyle, scrollProps }: ScreenProps) {
  const { colors } = useTheme();
  const inner = padded ? styles.padded : null;
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }, style]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          {...scrollProps}
          contentContainerStyle={[inner, styles.scrollContent, contentContainerStyle]}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.card} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, inner, contentContainerStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  /** Larger greeting style (tab roots). */
  large?: boolean;
}

export function ScreenHeader({ title, subtitle, right, large = true }: ScreenHeaderProps) {
  return (
    <View style={styles.header} accessibilityRole="header">
      <View style={styles.headerText}>
        <Text variant={large ? 'display' : 'title'} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text variant="small" color="mutedForeground">{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { paddingHorizontal: spacing[4] },
  scrollContent: { paddingTop: spacing[2], paddingBottom: spacing[8], gap: spacing[4] },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[3], paddingVertical: spacing[2] },
  headerText: { flex: 1, minWidth: 0, gap: spacing[1] },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
