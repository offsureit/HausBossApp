import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { refreshSession } from '~/api/client';
import { getSession, loadSession, onAuthStateChange, secondsToExpiry, type Session } from '~/api/session';
import { monitoring } from '~/lib/monitoring';
import { kv } from '~/lib/storage';
import { authService, type SignInInput, type User } from '~/services/auth';
import { backgroundLocation } from '~/services/backgroundLocation';
import { offlineQueue } from '~/services/offlineQueue';
import { pushService } from '~/services/push';
import { deriveRoleFlags } from './roles';
import type { ServiceResult } from '@/services/types';
import type { AppRole, Profile, UserProfileBundle } from '@/types';

export type AuthStatus = 'booting' | 'signedOut' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  isAuthenticated: boolean;
  /** True until the profile + roles are known for this session (from the cache or the network). */
  profileLoading: boolean;
  /** Set when the signed-in user has no usable profile so the UI can explain instead of hanging. */
  profileError: string | null;
  hasRole: (role: AppRole) => boolean;
  isStaff: boolean;
  isContractor: boolean;
  isAdmin: boolean;
  signIn: (input: SignInInput) => Promise<ServiceResult<Session>>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<ServiceResult<true>>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const profileCacheKey = (userId: string) => `hb.profile.${userId}`;
const TRANSIENT = new Set(['network', 'timeout', 'offline', 'aborted']);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [booted, setBooted] = useState(false);
  const [session, setSessionState] = useState<Session | null>(null);
  const [bundle, setBundle] = useState<UserProfileBundle | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  /** Single-flight. Network failures keep the cached profile (offline boot); real errors surface. */
  const loadProfile = useCallback((userId: string): Promise<void> => {
    if (inflight.current) return inflight.current;
    const run = (async () => {
      setProfileLoading(true);
      const { data, error } = await authService.fetchUserProfile();
      if (data) {
        setBundle(data);
        setProfileError(null);
        kv.setJSON(profileCacheKey(userId), data);
      } else if (error) {
        const cached = kv.getJSON<UserProfileBundle>(profileCacheKey(userId));
        if (cached && TRANSIENT.has(error.code ?? '')) {
          setBundle(cached);
          setProfileError(null);
        } else {
          if (!cached) setBundle(null);
          setProfileError(error.message);
        }
      }
      setProfileLoading(false);
    })().finally(() => { inflight.current = null; });
    inflight.current = run;
    return run;
  }, []);

  const resetUserState = useCallback(() => {
    setBundle(null);
    setProfileError(null);
    setProfileLoading(false);
    queryClient.clear();
    kv.removePrefix('hb.profile.');
    kv.removePrefix('hb.company.');
    kv.remove('hb.rq');
    offlineQueue.clearQueue(); // another account must not replay this user's queued changes
    void backgroundLocation.stopBackgroundTracking();
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;
    // Listener registered BEFORE the first read (same pattern as the web AuthContext).
    const unsubscribe = onAuthStateChange((event, next) => {
      if (cancelled) return;
      setSessionState(next);
      if (event === 'INITIAL_SESSION') return; // the boot path below handles it
      if (next?.user) {
        if (event === 'SIGNED_IN') {
          const cached = kv.getJSON<UserProfileBundle>(profileCacheKey(next.user.id));
          setBundle(cached);
          setProfileError(null);
          void loadProfile(next.user.id);
        }
      } else {
        resetUserState();
      }
    });

    (async () => {
      const current = await loadSession();
      if (cancelled) return;
      if (current?.user) {
        const cached = kv.getJSON<UserProfileBundle>(profileCacheKey(current.user.id));
        if (cached) setBundle(cached);
        setBooted(true);
        void loadProfile(current.user.id);
      } else {
        setBooted(true);
      }
    })();

    return () => { cancelled = true; unsubscribe(); };
  }, [loadProfile, resetUserState]);

  // Crash reports carry the account id only (no email / name) so a crash can be tied to a user.
  useEffect(() => { monitoring.setUser(session?.user?.id ?? null); }, [session?.user?.id]);

  // Coming back to the foreground with a token about to expire: refresh now, before the first request.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const current = getSession();
      if (current && secondsToExpiry(current) < 120) void refreshSession();
    });
    return () => sub.remove();
  }, []);

  const signIn = useCallback((input: SignInInput) => authService.signIn(input), []);
  const signOut = useCallback(async () => {
    await pushService.unregisterCurrent().catch(() => undefined); // needs the token, so before the session goes
    await authService.signOut();
  }, []);
  const refreshProfile = useCallback(async () => {
    const current = getSession();
    if (current?.user) await loadProfile(current.user.id);
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(() => {
    const roles = bundle?.roles ?? [];
    const hasRole = (role: AppRole) => roles.includes(role);
    const { isStaff, isContractor, isAdmin } = deriveRoleFlags(roles);
    const status: AuthStatus = !booted ? 'booting' : session?.user ? 'signedIn' : 'signedOut';
    return {
      status,
      user: session?.user ?? null,
      session,
      profile: bundle?.profile ?? null,
      roles,
      isAuthenticated: status === 'signedIn',
      profileLoading: status === 'signedIn' && !bundle && !profileError && profileLoading,
      profileError,
      hasRole,
      isStaff,
      isContractor,
      isAdmin,
      signIn,
      signOut,
      resetPassword: authService.resetPassword,
      refreshProfile,
    };
  }, [booted, session, bundle, profileLoading, profileError, signIn, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
