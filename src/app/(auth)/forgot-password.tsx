import { useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CheckCircle2, Mail } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import { Button, HeroHeader, Screen, Text, TextField } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { haptics } from '~/lib/haptics';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

export default function ForgotPasswordScreen() {
  const auth = useAuth();
  const { colors } = useTheme();
  const { enterUp, enterFade } = useMotion();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    const { error: err } = await auth.resetPassword(email);
    setBusy(false);
    if (err) { setError(err.message); haptics.error(); return; }
    haptics.success();
    setSent(true);
  };

  return (
    <Screen scroll hero edges={['left', 'right', 'bottom']}>
      <HeroHeader eyebrow="HausBoss" title="Reset password" subtitle="We'll email you a link that works once and expires after an hour." />
      {sent ? (
        <Animated.View entering={enterFade()} style={styles.done}>
          <CheckCircle2 size={40} color={colors.success} />
          <Text variant="heading" align="center">Check your email</Text>
          <Text variant="small" color="mutedForeground" align="center">If an account exists for {email.trim()}, a reset link is on its way. Open it on this phone or the web.</Text>
          <Button label="Back to sign in" onPress={() => router.back()} />
        </Animated.View>
      ) : (
        <View style={styles.form}>
          <Animated.View entering={enterUp(0)}>
            <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" returnKeyType="send" onSubmitEditing={() => void submit()} error={error} leading={<Mail size={18} color={colors.mutedForeground} />} editable={!busy} />
          </Animated.View>
          <Animated.View entering={enterUp(1)} style={styles.actions}>
            <Button label="Send reset link" size="lg" fullWidth loading={busy} disabled={!email.trim() || busy} onPress={() => void submit()} />
            <Button label="Back" variant="ghost" onPress={() => router.back()} />
          </Animated.View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing[4] },
  actions: { gap: spacing[2], alignItems: 'center' },
  done: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
});
