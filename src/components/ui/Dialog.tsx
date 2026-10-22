import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { Button, type ButtonVariant } from './Button';
import { Text } from './Text';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  onConfirm?: () => void | Promise<void>;
  cancelLabel?: string;
  busy?: boolean;
}

/** Centered confirmation dialog (sign out, delete media, …). */
export function Dialog({ open, onClose, title, description, children, confirmLabel = 'Confirm', confirmVariant = 'primary', onConfirm, cancelLabel = 'Cancel', busy = false }: DialogProps) {
  const { colors } = useTheme();
  const { reduced, duration } = useMotion();
  if (!open) return null;
  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(duration.fast)} exiting={FadeOut.duration(duration.fast)} style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <Animated.View entering={reduced ? FadeIn.duration(duration.fast) : ZoomIn.duration(duration.base)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityViewIsModal>
          <Text variant="title">{title}</Text>
          {description ? <Text variant="small" color="mutedForeground">{description}</Text> : null}
          {children ? <View style={styles.body}>{children}</View> : null}
          <View style={styles.actions}>
            <Button label={cancelLabel} variant="ghost" onPress={onClose} disabled={busy} />
            {onConfirm ? <Button label={confirmLabel} variant={confirmVariant} onPress={() => void onConfirm()} loading={busy} /> : null}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  card: { width: '100%', maxWidth: 420, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: spacing[5], gap: spacing[2] },
  body: { marginTop: spacing[2] },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[3] },
});
