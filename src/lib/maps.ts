import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { PROVIDER_GOOGLE } from 'react-native-maps';

interface MapsExtra { android?: boolean; ios?: boolean }
const extra = (Constants.expoConfig?.extra?.maps ?? {}) as MapsExtra;

/** A native Google Maps SDK key was configured at build time (app.config.ts, GOOGLE_MAPS_*_KEY). */
export const hasGoogleMapsKey = Platform.OS === 'android' ? !!extra.android : !!extra.ios;

/**
 * Android needs a Google Maps key or the map view crashes ("API key not found"); iOS can use Apple
 * Maps without one. `null` = no map can be shown on this build.
 */
export const mapProvider: typeof PROVIDER_GOOGLE | undefined | null = hasGoogleMapsKey ? PROVIDER_GOOGLE : Platform.OS === 'ios' ? undefined : null;
export const mapAvailable = mapProvider !== null;
