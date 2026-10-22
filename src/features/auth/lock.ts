import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/** Biometric unlock helpers (expo-local-authentication). Pure wrappers; the `LockProvider` owns the state. */

export interface BiometricAvailability {
  /** Hardware present and something enrolled (biometrics or, as a fallback, a device PIN). */
  available: boolean;
  biometrics: boolean;
  /** "Face ID", "Fingerprint", "Biometrics" or "Device passcode". */
  label: string;
}

export async function biometricAvailability(): Promise<BiometricAvailability> {
  try {
    const hardware = await LocalAuthentication.hasHardwareAsync();
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    const types = hardware ? await LocalAuthentication.supportedAuthenticationTypesAsync() : [];
    const biometrics = hardware && level === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG || level === LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK;
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const label = biometrics ? (face && Platform.OS === 'ios' ? 'Face ID' : face && !finger ? 'Face unlock' : finger ? 'Fingerprint' : 'Biometrics') : 'Device passcode';
    return { available: level !== LocalAuthentication.SecurityLevel.NONE, biometrics, label };
  } catch {
    return { available: false, biometrics: false, label: 'Biometrics' };
  }
}

/** Prompts; device PIN / passcode is allowed as the fallback. */
export async function authenticate(promptMessage = 'Unlock HausBoss'): Promise<{ ok: boolean; reason?: string }> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Cancel', disableDeviceFallback: false });
    if (result.success) return { ok: true };
    return { ok: false, reason: result.error };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
