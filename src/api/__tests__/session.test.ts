import { _resetSessionForTests, clearSession, configureSessionStorage, getSession, isExpired, loadSession, onAuthStateChange, secondsToExpiry, setRefresher, setSession, TOKENS_KEY, USER_KEY, type Session, type SessionStorage } from '../session';

const now = () => Math.floor(Date.now() / 1000);

function session(overrides: Partial<Session> = {}): Session {
  return {
    access_token: 'access',
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: 900,
    expires_at: now() + 900,
    user: { id: 'u1', email: 'tech@example.com', email_confirmed_at: null, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
    ...overrides,
  };
}

function fakeStorage(seed: Record<string, string> = {}): SessionStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return { map, get: async (k) => map.get(k) ?? null, set: async (k, v) => { map.set(k, v); }, remove: async (k) => { map.delete(k); } };
}

beforeEach(() => _resetSessionForTests());

describe('session store', () => {
  it('loads a persisted session (tokens + user kept in separate keys) and emits INITIAL_SESSION', async () => {
    const s = session();
    const { user, ...tokens } = s;
    configureSessionStorage(fakeStorage({ [TOKENS_KEY]: JSON.stringify(tokens), [USER_KEY]: JSON.stringify(user) }));
    const events: string[] = [];
    onAuthStateChange((event) => events.push(event));
    const loaded = await loadSession();
    expect(loaded?.user.id).toBe('u1');
    expect(getSession()?.access_token).toBe('access');
    expect(events).toEqual(['INITIAL_SESSION']);
  });

  it('treats corrupt storage as signed out', async () => {
    configureSessionStorage(fakeStorage({ [TOKENS_KEY]: '{not json', [USER_KEY]: '{}' }));
    expect(await loadSession()).toBeNull();
  });

  it('persists on set and removes on clear', async () => {
    const store = fakeStorage();
    configureSessionStorage(store);
    await loadSession();
    setSession(session());
    await Promise.resolve();
    expect(store.map.has(TOKENS_KEY)).toBe(true);
    expect(JSON.parse(store.map.get(USER_KEY) ?? '{}').email).toBe('tech@example.com');
    clearSession();
    await new Promise((r) => setTimeout(r, 0));
    expect(store.map.size).toBe(0);
    expect(getSession()).toBeNull();
  });

  it('fires SIGNED_IN / TOKEN_REFRESHED / SIGNED_OUT in order', async () => {
    await loadSession();
    const events: string[] = [];
    onAuthStateChange((event) => events.push(event));
    await Promise.resolve();
    setSession(session());
    setSession(session({ access_token: 'access2' }), 'TOKEN_REFRESHED');
    clearSession();
    expect(events).toEqual(['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_OUT']);
  });

  it('knows when the access token is about to expire', () => {
    expect(isExpired(session({ expires_at: now() + 10 }))).toBe(true); // inside the 30 s skew
    expect(isExpired(session({ expires_at: now() + 120 }))).toBe(false);
    expect(isExpired(null)).toBe(true);
    expect(secondsToExpiry(session({ expires_at: now() + 100 }))).toBeGreaterThan(95);
  });

  it('schedules a proactive refresh one minute before expiry', async () => {
    jest.useFakeTimers();
    const refresher = jest.fn(async () => null);
    setRefresher(refresher);
    setSession(session({ expires_at: now() + 120 }));
    jest.advanceTimersByTime(59_000);
    expect(refresher).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2_000);
    expect(refresher).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
