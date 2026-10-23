/* eslint-disable import/first */
// Driving time for On my way comes from the server (Google Routes / OpenStreetMap) — never a straight line.
const mockPost = jest.fn();
jest.mock('~/api/client', () => ({ api: { post: (...a: unknown[]) => mockPost(...a) } }));
jest.mock('~/api/realtime', () => ({ broadcast: jest.fn(), onBroadcast: jest.fn(), subscribe: jest.fn() }));
jest.mock('~/lib/storage', () => ({ kv: { getString: () => null, setString: () => undefined, getJSON: () => null, setJSON: () => undefined } }));
const mockGranted = { value: true };
jest.mock('expo-location', () => ({
  Accuracy: { High: 6, Balanced: 3 },
  getForegroundPermissionsAsync: async () => ({ granted: mockGranted.value, status: mockGranted.value ? 'granted' : 'denied', canAskAgain: false }),
  requestForegroundPermissionsAsync: async () => ({ granted: mockGranted.value, status: mockGranted.value ? 'granted' : 'denied', canAskAgain: false }),
  getCurrentPositionAsync: async () => ({ coords: { latitude: 30.27, longitude: -97.74, accuracy: 5 }, timestamp: 0 }),
  geocodeAsync: async () => [{ latitude: 30.31, longitude: -97.94 }],
}));

import { estimateTravel, formatEta } from '~/services/locations';

describe('estimateTravel', () => {
  beforeEach(() => { mockPost.mockReset(); mockGranted.value = true; });

  it('asks the server for the road route, sending the geocoded point along', async () => {
    mockPost.mockResolvedValueOnce({ estimate: { distanceKm: 26.1, etaMinutes: 25, source: 'osrm' } });
    expect(await estimateTravel('Bee Cave, TX')).toEqual({ distanceKm: 26.1, etaMinutes: 25, source: 'osrm' });
    expect(mockPost).toHaveBeenCalledWith('/travel/estimate', { origin: { latitude: 30.27, longitude: -97.74 }, address: 'Bee Cave, TX', destination: { latitude: 30.31, longitude: -97.94 } });
  });

  it('returns null (no guess) when there is no route, the call fails or location is off', async () => {
    mockPost.mockResolvedValueOnce({ estimate: null });
    expect(await estimateTravel('Nowhere 1')).toBeNull();
    mockPost.mockRejectedValueOnce(new Error('offline'));
    expect(await estimateTravel('Nowhere 2')).toBeNull();
    mockGranted.value = false;
    expect(await estimateTravel('Nowhere 3')).toBeNull();
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it('formats long drives in hours', () => {
    expect(formatEta(25)).toBe('25 min');
    expect(formatEta(65)).toBe('1 h 5 min');
  });
});
