import { useLocalSearchParams } from 'expo-router';
import { SetPasswordScreen } from '~/components/auth/SetPasswordScreen';

/** `hausboss.app/reset-password?token=…` (deep link from the password-reset email). */
export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  return <SetPasswordScreen token={token} type="recovery" />;
}
