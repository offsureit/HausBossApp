import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View, type AppStateStatus } from 'react-native';
import { BlurView } from 'expo-blur';
import { Fingerprint, LogOut, ScanFace } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { onAuthStateChange } from '~/api/session';
import { HouseMark, LOGO_NAVY } from '~/components/BrandLogo';
import { Button, Dialog, Text } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { authenticate, biometricAvailability, type BiometricAvailability } from '~/features/auth/lock';
import { useSettings } from '~/features/settings/store';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import { kv } from '~/lib/storage';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';
import { spacing } from '~/theme/tokens';

/** Lock again after this long in the background. */
export const LOCK_AFTER_MS = 30_000;
const OFFERED_KEY = 'hb.lock.offered';

export interface LockContextValue {
  locked: boolean;
  availability: BiometricAvailability | null;
  lockNow: () => void;
  /** Re-reads what the phone offers (after the user enrolled a fingerprint / PIN). */
  refreshAvailability: () => Promise<void>;
  /** Turn the lock on (after a successful prompt) or off. */
  setEnabled: (on: boolean) => Promise<boolean>;
}

const LockContext = createContext<LockContextValue | undefined>(undefined);

/**
 * Biometric lock (brief "Face ID / fingerprint unlock"): when enabled, the app opens behind a
 * blurred privacy cover with the OS prompt on cold start and after 30 s in the background; the
 * cover also hides content in the app switcher. Offered once after the first sign-in on a phone
 * with biometrics enrolled.
 */
export function LockProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const enabled = useSettings((s) => s.biometricLock);
  const setBiometricLock = useSettings((s) => s.setBiometricLock);
  const signedIn = auth.status === 'signedIn';
  const [availability, setAvailability] = useState<BiometricAvailability | null>(null);
  const [locked, setLocked] = useState(() => enabled && signedIn);
  const [covered, setCovered] = useState(false);
  const [offer, setOffer] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const leftAt = useRef<number | null>(null);
  const appState = useRef<AppStateStatus>((AppState.currentState ?? 'active') as AppStateStatus);

  const refreshAvailability = useCallback(async () => { setAvailability(await biometricAvailability()); }, []);
  useEffect(() => { void refreshAvailability(); }, [refreshAvailability]);

  // Cold start: the session is restored after mount, so lock when the restored session first appears
  // (an interactive sign-in is not a cold start — the user just typed their password).
  const bootLock = useRef(true);
  useEffect(() => {
    if (auth.status === 'booting') return;
    if (bootLock.current) { bootLock.current = false; if (auth.status === 'signedIn' && enabled) setLocked(true); }
  }, [auth.status, enabled]);
  useEffect(() => { if (!signedIn) { setLocked(false); setCovered(false); } }, [signedIn]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appState.current;
      appState.current = next;
      if (!signedIn) return;
      if (next === 'background' || next === 'inactive') {
        if (prev === 'active') { leftAt.current = Date.now(); if (enabled) setCovered(true); }
      } else if (next === 'active') {
        void refreshAvailability();
        if (enabled && leftAt.current !== null && Date.now() - leftAt.current >= LOCK_AFTER_MS) setLocked(true);
        else setCovered(false);
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled, signedIn, refreshAvailability]);

  // Offer the lock once, right after an interactive sign-in.
  useEffect(() => onAuthStateChange((event) => {
    if (event !== 'SIGNED_IN' || kv.getString(OFFERED_KEY) === '1') return;
    void biometricAvailability().then((a) => { setAvailability(a); if (a.biometrics) { kv.setString(OFFERED_KEY, '1'); setOffer(true); } });
  }), []);

  const unlock = useCallback(async () => {
    if (prompting) return;
    setPrompting(true);
    const result = await authenticate(`Unlock HausBaus`);
    setPrompting(false);
    if (result.ok) { haptics.success(); setLocked(false); setCovered(false); }
    else haptics.error();
  }, [prompting]);

  // Prompt as soon as the lock screen shows (and the app is in front).
  useEffect(() => { if (locked && appState.current === 'active') void unlock(); }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  const setEnabled = useCallback(async (on: boolean) => {
    if (on) {
      const a = availability ?? (await biometricAvailability());
      if (!a.available) { toast.error('Set up Face ID, fingerprint or a device passcode first'); return false; }
      const result = await authenticate('Confirm to turn on app lock');
      if (!result.ok) return false;
    }
    setBiometricLock(on);
    kv.setString(OFFERED_KEY, '1');
    return true;
  }, [availability, setBiometricLock]);

  const lockNow = useCallback(() => { if (enabled && signedIn) setLocked(true); }, [enabled, signedIn]);

  const value = useMemo<LockContextValue>(() => ({ locked, availability, lockNow, setEnabled, refreshAvailability }), [locked, availability, lockNow, setEnabled, refreshAvailability]);
  const label = availability?.label ?? 'Biometrics';

  return (
    <LockContext.Provider value={value}>
      {children}
      {signedIn && (locked || covered) ? <PrivacyCover locked={locked} label={label} prompting={prompting} onUnlock={() => void unlock()} onSignOut={() => void auth.signOut()} /> : null}
      <Dialog
        open={offer}
        onClose={() => setOffer(false)}
        title={`Unlock with ${label}?`}
        description={`Next time, open HausBaus with ${label} instead of your password. You can change this under More → Security.`}
        confirmLabel="Turn on"
        cancelLabel="Not now"
        onConfirm={async () => { const ok = await setEnabled(true); setOffer(false); if (ok) toast.success(`${label} unlock is on`); }}
      />
    </LockContext.Provider>
  );
}

function PrivacyCover({ locked, label, prompting, onUnlock, onSignOut }: { locked: boolean; label: string; prompting: boolean; onUnlock: () => void; onSignOut: () => void }) {
  const { colors, scheme } = useTheme();
  const { duration } = useMotion();
  const Icon = label === 'Face ID' || label === 'Face unlock' ? ScanFace : Fingerprint;
  return (
    <Animated.View entering={FadeIn.duration(duration.fast)} exiting={FadeOut.duration(duration.base)} style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      {/* iOS: native blur. Android: BlurView needs a blurTarget (not worth the plumbing), so a near-opaque wash hides the content instead. */}
      {Platform.OS === 'ios' ? <BlurView intensity={90} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
      <View style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: Platform.OS === 'ios' ? (scheme === 'dark' ? 'rgba(11,31,74,0.55)' : 'rgba(255,255,255,0.55)') : (scheme === 'dark' ? '#0f1524' : '#f1f5f9') }]}>
        <HouseMark size={96} primary={scheme === 'dark' ? '#ffffff' : LOGO_NAVY} />
        {locked ? (
          <View style={styles.actions}>
            <Text variant="heading" align="center">Locked</Text>
            <Text variant="small" color="mutedForeground" align="center">Use {label} to continue.</Text>
            <Button label={`Unlock with ${label}`} size="lg" icon={<Icon size={20} color={colors.accentForeground} />} loading={prompting} onPress={onUnlock} />
            <Button label="Sign out" variant="ghost" icon={<LogOut size={16} color={colors.mutedForeground} />} onPress={onSignOut} />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function useLock(): LockContextValue {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used within LockProvider');
  return ctx;
}

const styles = StyleSheet.create({
  cover: { alignItems: 'center', justifyContent: 'center', gap: spacing[6], padding: spacing[6] },
  actions: { alignItems: 'center', gap: spacing[3], width: '100%', maxWidth: 360 },
});
