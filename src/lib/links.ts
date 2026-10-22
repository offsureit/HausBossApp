import { Linking, Platform } from 'react-native';
import { toast } from '~/features/toast/store';

async function open(url: string, failure: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    toast.error(failure);
  }
}

export const links = {
  call: (phone: string) => open(`tel:${phone.replace(/[^\d+]/g, '')}`, 'Could not start a call on this device'),
  sms: (phone: string) => open(`sms:${phone.replace(/[^\d+]/g, '')}`, 'Could not open Messages'),
  email: (address: string) => open(`mailto:${address}`, 'Could not open Mail'),
  /** Turn-by-turn directions in the platform's maps app (Apple Maps on iOS, Google Maps on Android). */
  navigate: (address: string) => {
    const q = encodeURIComponent(address);
    return open(Platform.OS === 'ios' ? `maps://?daddr=${q}` : `google.navigation:q=${q}`, 'Could not open the maps app').catch(() => open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, 'Could not open the maps app'));
  },
  /** Show a point on a map. */
  showPoint: (lat: number, lng: number) => open(Platform.OS === 'ios' ? `maps://?ll=${lat},${lng}&q=${lat},${lng}` : `geo:${lat},${lng}?q=${lat},${lng}`, 'Could not open the maps app'),
  url: (url: string) => open(url, 'Could not open the link'),
};
