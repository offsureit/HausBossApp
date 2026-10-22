import { useRef, useState, type ComponentRef } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput } from 'react-native';
import { Link, router } from 'expo-router';
import { AlertCircle, Lock, Mail } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '~/components/BrandLogo';
import { Button, Text, TextField } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { haptics } from '~/lib/haptics';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';
import { API_URL } from '~/lib/env';

export default function LoginScreen() {
  const auth = useAuth();
  const { colors } = useTheme();
  const { reduced, duration, enterUp, enterFade } = useMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  const submit = async () => {
    if (busy) return;
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    const { error: err } = await auth.signIn({ email, password });
    setBusy(false);
    if (err) {
      setError(err.message);
      setErrorCode(err.code ?? null);
      haptics.error();
      if (!reduced) shake.set(withSequence(withTiming(-10, { duration: duration.instant / 2 }), withTiming(10, { duration: duration.instant / 2 }), withTiming(-6, { duration: duration.instant / 2 }), withTiming(0, { duration: duration.instant / 2 })));
      return;
    }
    haptics.success();
    router.replace('/');
  };

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bounces={false}>
          <Animated.View entering={enterFade()} style={styles.logo}>
            <BrandLogo height={64} />
            <Text variant="small" color="mutedForeground" align="center">Field-service job & crew management</Text>
          </Animated.View>

          <Animated.View style={[styles.form, shakeStyle]}>
            <Animated.View entering={enterUp(0)}>
              <Text variant="title">Sign in</Text>
            </Animated.View>
            <Animated.View entering={enterUp(1)}>
              <TextField
                label="Email"
                testID="login-email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                leading={<Mail size={18} color={colors.mutedForeground} />}
                editable={!busy}
              />
            </Animated.View>
            <Animated.View entering={enterUp(2)}>
              <TextField
                ref={passwordRef}
                label="Password"
                testID="login-password"
                value={password}
                onChangeText={setPassword}
                secure
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => { if (canSubmit) void submit(); }}
                leading={<Lock size={18} color={colors.mutedForeground} />}
                editable={!busy}
              />
            </Animated.View>

            {error ? (
              <Animated.View entering={enterFade()} style={[styles.error, { backgroundColor: withAlpha(colors.destructive, 0.1), borderColor: withAlpha(colors.destructive, 0.4) }]} accessibilityLiveRegion="assertive">
                <AlertCircle size={18} color={colors.destructive} />
                <View style={styles.errorText}>
                  <Text variant="small" color="destructive">{error}</Text>
                  {errorCode === 'email_not_confirmed' ? <Text variant="caption" color="mutedForeground">Confirm your email from the link we sent, then sign in again.</Text> : null}
                </View>
              </Animated.View>
            ) : null}

            <Animated.View entering={enterUp(3)} style={styles.actions}>
              <Button testID="login-submit" label="Sign in" size="lg" fullWidth loading={busy} disabled={!canSubmit} onPress={() => void submit()} />
              <Link href="/forgot-password" asChild>
                <Button label="Forgot password?" variant="ghost" />
              </Link>
            </Animated.View>
          </Animated.View>

          <Animated.View entering={enterFade(300)} style={styles.footer}>
            <Text variant="caption" color="mutedForeground" align="center">New companies sign up on the web at hausboss.app.</Text>
            {API_URL !== 'https://hausboss.app' ? <Text variant="caption" color="warning" align="center">Server: {API_URL}</Text> : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing[6], paddingVertical: spacing[8], justifyContent: 'center', gap: spacing[8] },
  logo: { alignItems: 'center', gap: spacing[2] },
  form: { gap: spacing[4] },
  actions: { gap: spacing[2], alignItems: 'center' },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], padding: spacing[3], borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  errorText: { flex: 1, gap: spacing[1] },
  footer: { gap: spacing[1] },
});
