/**
 * Session store — the mobile half of `POST /auth/*` (same `Session` and
 * `onAuthStateChange` contract as the web app's `src/api/session.ts`).
 *
 * Tokens live in the Keychain / Keystore (see `~/lib/secureStorage`); an
 * in-memory copy serves synchronous reads. Nothing here imports React Native,
 * so the module runs in plain Jest with the default in-memory storage.
 */

export interface SessionUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  user_metadata: Record<string, unknown>;
  created_at: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
  /** Unix seconds. */
  expires_at: number;
  user: SessionUser;
}

export type AuthChangeEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY';
export type AuthChangeCallback = (event: AuthChangeEvent, session: Session | null) => void;

export interface SessionStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const TOKENS_KEY = 'hb.session.tokens';
export const USER_KEY = 'hb.session.user';

function memoryStorage(): SessionStorage {
  const map = new Map<string, string>();
  return {
    get: async (k) => map.get(k) ?? null,
    set: async (k, v) => { map.set(k, v); },
    remove: async (k) => { map.delete(k); },
  };
}

let adapter: SessionStorage = memoryStorage();
let memorySession: Session | null = null;
let loaded = false;
const listeners = new Set<AuthChangeCallback>();

/** Installed once at app start with the secure (Keychain / Keystore) adapter. */
export function configureSessionStorage(storage: SessionStorage): void {
  adapter = storage;
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<Session>;
  return typeof s.access_token === 'string' && typeof s.refresh_token === 'string' && !!s.user && typeof s.user.id === 'string';
}

/** Read the persisted session once at boot. Emits `INITIAL_SESSION`. */
export async function loadSession(): Promise<Session | null> {
  let next: Session | null = null;
  try {
    const [tokensRaw, userRaw] = await Promise.all([adapter.get(TOKENS_KEY), adapter.get(USER_KEY)]);
    if (tokensRaw && userRaw) {
      const candidate = { ...(JSON.parse(tokensRaw) as object), user: JSON.parse(userRaw) as unknown };
      if (isSession(candidate)) next = candidate;
    }
  } catch {
    next = null;
  }
  memorySession = next;
  loaded = true;
  if (next) scheduleRefresh(next);
  emit('INITIAL_SESSION', next);
  return next;
}

export function isSessionLoaded(): boolean {
  return loaded;
}

export function getSession(): Session | null {
  return memorySession;
}

function persist(session: Session | null): void {
  const run = async () => {
    if (session) {
      const { user, ...tokens } = session;
      await adapter.set(TOKENS_KEY, JSON.stringify(tokens));
      await adapter.set(USER_KEY, JSON.stringify(user));
    } else {
      await adapter.remove(TOKENS_KEY);
      await adapter.remove(USER_KEY);
    }
  };
  run().catch((err) => console.warn('[session] persist failed', err));
}

function emit(event: AuthChangeEvent, session: Session | null): void {
  for (const cb of Array.from(listeners)) {
    try {
      cb(event, session);
    } catch (err) {
      console.error('[session] listener failed', err);
    }
  }
}

export function setSession(session: Session, event: AuthChangeEvent = 'SIGNED_IN'): void {
  memorySession = session;
  persist(session);
  scheduleRefresh(session);
  emit(event, session);
}

export function clearSession(event: AuthChangeEvent = 'SIGNED_OUT'): void {
  const had = memorySession;
  memorySession = null;
  persist(null);
  cancelRefresh();
  if (had || event === 'SIGNED_OUT') emit(event, null);
}

/** Replace the user part (e.g. after a profile/password update) without touching tokens. */
export function updateSessionUser(patch: Partial<SessionUser>): void {
  if (!memorySession) return;
  setSession({ ...memorySession, user: { ...memorySession.user, ...patch } }, 'USER_UPDATED');
}

export function isExpired(session: Session | null | undefined, skewSeconds = 30): boolean {
  if (!session) return true;
  const expiresAt = Number(session.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return false;
  return expiresAt - skewSeconds <= Math.floor(Date.now() / 1000);
}

/** Seconds until the access token expires (negative when already expired; Infinity when unknown). */
export function secondsToExpiry(session: Session | null | undefined): number {
  if (!session) return -1;
  const expiresAt = Number(session.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return Number.POSITIVE_INFINITY;
  return expiresAt - Math.floor(Date.now() / 1000);
}

/**
 * Subscribe to auth changes. Once the store has loaded, fires `INITIAL_SESSION`
 * asynchronously with the current session (listener-before-read pattern).
 */
export function onAuthStateChange(callback: AuthChangeCallback): () => void {
  listeners.add(callback);
  if (loaded) queueMicrotask(() => { if (listeners.has(callback)) callback('INITIAL_SESSION', memorySession); });
  return () => { listeners.delete(callback); };
}

// ---------------------------------------------------------------------------
// Proactive refresh (one minute before expiry)
// ---------------------------------------------------------------------------

type Refresher = () => Promise<Session | null>;
let refresher: Refresher | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Installed by the API client so the store can refresh without importing it (no cycle). */
export function setRefresher(fn: Refresher | null): void {
  refresher = fn;
  if (fn && memorySession) scheduleRefresh(memorySession);
}

function cancelRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
}

function scheduleRefresh(session: Session): void {
  cancelRefresh();
  if (!refresher) return;
  const expiresAt = Number(session.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return;
  const delayMs = Math.max(5_000, (expiresAt - 60) * 1000 - Date.now());
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refresher?.().catch(() => undefined);
  }, delayMs);
  (refreshTimer as unknown as { unref?: () => void }).unref?.();
}

/** Test helper. */
export function _resetSessionForTests(): void {
  listeners.clear();
  memorySession = null;
  loaded = false;
  cancelRefresh();
  refresher = null;
  adapter = memoryStorage();
}
