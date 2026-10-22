import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, StyleSheet, View, type TextInput } from 'react-native';
import { router } from 'expo-router';
import { AlertCircle, CheckCircle2, KeyRound, Lock } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import { Button, Screen, ScreenHeader, Text, TextField } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { haptics } from '~/lib/haptics';
import { useMotion } from '~/motion';
import { authService } from '~/services/auth';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';

export interface SetPasswordScreenProps {
  /** One-time token from the email link (`?token=`). */
  token: string | undefined;
  type: 'invite' | 'recovery';
}

type State = { kind: 'checking' } | { kind: 'ready'; email: string | null } | { kind: 'invalid'; message: string } | { kind: 'done' };

/**
 * Accept-invite / reset-password (deep links `hausboss.app/accept-invite?token=`, `/reset-password?token=`):
 * exchanges the link token for a session (`POST /auth/exchange`), then sets the password
 * (`POST /auth/password`, no current password needed on an `otp` session) — the web `AcceptInvite` / `ResetPassword` flow.
 */
export function SetPasswordScreen({ token, type }: SetPasswordScreenProps) {
  const auth = useAuth();
  const { colors } = useTheme();
  const { enterUp, enterFade } = useMotion();
  const [state, setState] = useState<State>({ kind: 'checking' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);
  const invite = type === 'invite';

  useEffect(() => {
    let cancelled = false;
    if (!token) { setState({ kind: 'invalid', message: `This ${invite ? 'invite' : 'reset'} link is missing its token. Open the link from the email again.` }); return; }
    void authService.exchangeToken(token, type).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err || !data) setState({ kind: 'invalid', message: err?.message ?? 'This link is invalid or has expired.' });
      else setState({ kind: 'ready', email: data.user.email ?? null });
    });
    return () => { cancelled = true; };
  }, [token, type, invite]);

  const submit = async () => {
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    const { error: err } = await authService.updatePassword(password, confirm);
    setBusy(false);
    if (err) { setError(err.message); haptics.error(); return; }
    haptics.success();
    setState({ kind: 'done' });
    await auth.refreshProfile();
    setTimeout(() => router.replace('/'), 600);
  };

  const canSubmit = password.length >= 8 && confirm.length > 0 && !busy;

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={invite ? 'Join your team' : 'Choose a new password'} subtitle={state.kind === 'ready' && state.email ? state.email : undefined} large={false} />
      {state.kind === 'checking' ? (
        <Text variant="small" color="mutedForeground">Checking your link…</Text>
      ) : state.kind === 'invalid' ? (
        <Animated.View entering={enterFade()} style={[styles.error, { backgroundColor: withAlpha(colors.destructive, 0.1), borderColor: withAlpha(colors.destructive, 0.4) }]}>
          <AlertCircle size={18} color={colors.destructive} />
          <View style={styles.errorText}>
            <Text variant="small" color="destructive">{state.message}</Text>
            <Button label={invite ? 'Back to sign in' : 'Request a new link'} variant="outline" onPress={() => router.replace(invite ? '/login' : '/forgot-password')} />
          </View>
        </Animated.View>
      ) : state.kind === 'done' ? (
        <Animated.View entering={enterFade()} style={styles.done}>
          <CheckCircle2 size={40} color={colors.success} />
          <Text variant="heading" align="center">{invite ? 'Welcome aboard!' : 'Password updated'}</Text>
          <Text variant="small" color="mutedForeground" align="center">Opening your jobs…</Text>
        </Animated.View>
      ) : (
        <View style={styles.form}>
          <Animated.View entering={enterUp(0)}>
            <Text variant="small" color="mutedForeground">{invite ? 'Set a password to finish joining. At least 8 characters.' : 'At least 8 characters. Other devices will be signed out.'}</Text>
          </Animated.View>
          <Animated.View entering={enterUp(1)}>
            <TextField label="New password" value={password} onChangeText={setPassword} secure autoComplete="new-password" textContentType="newPassword" returnKeyType="next" onSubmitEditing={() => confirmRef.current?.focus()} leading={<Lock size={18} color={colors.mutedForeground} />} editable={!busy} />
          </Animated.View>
          <Animated.View entering={enterUp(2)}>
            <TextField ref={confirmRef} label="Confirm password" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={() => { if (canSubmit) void submit(); }} leading={<KeyRound size={18} color={colors.mutedForeground} />} editable={!busy} />
          </Animated.View>
          {error ? (
            <Animated.View entering={enterFade()} style={[styles.error, { backgroundColor: withAlpha(colors.destructive, 0.1), borderColor: withAlpha(colors.destructive, 0.4) }]} accessibilityLiveRegion="assertive">
              <AlertCircle size={18} color={colors.destructive} />
              <Text variant="small" color="destructive" style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}
          <Animated.View entering={enterUp(3)}>
            <Button label={invite ? 'Set password & join' : 'Update password'} size="lg" fullWidth loading={busy} disabled={!canSubmit} onPress={() => void submit()} />
          </Animated.View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing[4] },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], padding: spacing[3], borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  errorText: { flex: 1, gap: spacing[2] },
  done: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[8] },
});
