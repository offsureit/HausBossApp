import { Redirect } from 'expo-router';
import { BootScreen } from '~/components/BootScreen';
import { useAuth } from '~/features/auth/AuthProvider';
import { homeTabFor } from '~/features/auth/roles';

/**
 * Launch router: signed out → login; technicians → Today; owners / managers → Calendar.
 * Waits for the profile (cached or fetched) so the first screen matches the role.
 */
export default function Index() {
  const auth = useAuth();
  if (auth.status === 'booting') return <BootScreen />;
  if (auth.status === 'signedOut') return <Redirect href="/login" />;
  if (auth.profileError) return <BootScreen problem={auth.profileError} onRetry={() => void auth.refreshProfile()} onSignOut={() => void auth.signOut()} />;
  if (auth.profileLoading || auth.roles.length === 0) return <BootScreen />;
  return <Redirect href={`/${homeTabFor(auth)}`} />;
}
