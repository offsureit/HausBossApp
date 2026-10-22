import * as SecureStore from 'expo-secure-store';
import type { SessionStorage } from '~/api/session';

// AFTER_FIRST_UNLOCK: background tasks (location reports) can still read the tokens while the phone is locked.
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

/** Keychain / Keystore backed storage for the session tokens. */
export const secureStorage: SessionStorage = {
  get: (key) => SecureStore.getItemAsync(key, options),
  set: (key, value) => SecureStore.setItemAsync(key, value, options),
  remove: (key) => SecureStore.deleteItemAsync(key, options),
};
