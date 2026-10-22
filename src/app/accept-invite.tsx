import { useLocalSearchParams } from 'expo-router';
import { SetPasswordScreen } from '~/components/auth/SetPasswordScreen';

/** `hausboss.app/accept-invite?token=…` (deep link from the invite email). */
export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  return <SetPasswordScreen token={token} type="invite" />;
}
