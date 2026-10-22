import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import { HouseMark } from '~/components/BrandLogo';
import { Button, Text } from '~/components/ui';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { brand, spacing } from '~/theme/tokens';

export interface BootScreenProps {
  /** A boot error (profile could not be loaded): branded error state with Retry, never a blank screen. */
  problem?: string | null;
  onRetry?: () => void;
  onSignOut?: () => void;
}

/** Pixel-matches the native splash (white, the logo's house mark centred) so the hand-off is invisible. */
export function BootScreen({ problem, onRetry, onSignOut }: BootScreenProps) {
  const { colors } = useTheme();
  const { enterFade } = useMotion();
  return (
    <View style={[styles.root, { backgroundColor: '#ffffff' }]}>
      <HouseMark size={200} />
      {problem ? (
        <Animated.View entering={enterFade()} style={styles.problem}>
          <AlertCircle size={28} color={colors.warning} />
          <Text variant="heading" color={brand.navy} align="center">We could not load your profile</Text>
          <Text variant="small" color="#566376" align="center">{problem}</Text>
          <View style={styles.actions}>
            {onRetry ? <Button label="Try again" onPress={onRetry} /> : null}
            {onSignOut ? <Button label="Sign out" variant="ghost" onPress={onSignOut} /> : null}
          </View>
        </Animated.View>
      ) : (
        <Animated.View entering={enterFade(400)} style={styles.spinner}>
          <ActivityIndicator color={brand.navy} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  spinner: { position: 'absolute', bottom: spacing[12] },
  problem: { position: 'absolute', bottom: spacing[12], left: spacing[6], right: spacing[6], alignItems: 'center', gap: spacing[2] },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
});
