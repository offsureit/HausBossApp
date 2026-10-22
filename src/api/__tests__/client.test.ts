import { _resetSessionForTests, getSession, loadSession, setSession, type Session } from '../session';
import { api, ApiError, configureApi, OFFLINE_MESSAGE, refreshSessionDetailed, setOnline, UNREACHABLE_MESSAGE } from '../client';

const now = () => Math.floor(Date.now() / 1000);
const session = (overrides: Partial<Session> = {}): Session => ({
  access_token: 'A1', refresh_token: 'R1', token_type: 'bearer', expires_in: 900, expires_at: now() + 900,
  user: { id: 'u1', email: 'x@y.z', email_confirmed_at: null, user_metadata: {}, created_at: '' },
  ...overrides,
});

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
let responder: (call: Call) => Response | Promise<Response>;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(async () => {
  _resetSessionForTests();
  configureApi({ baseUrl: 'http://api.test' });
  setOnline(true);
  calls = [];
  globalThis.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    return responder(call);
  }) as unknown as typeof fetch;
  await loadSession();
});

describe('api client', () => {
  it('sends the bearer token and parses JSON', async () => {
    setSession(session());
    responder = () => json(200, { ok: true });
    const out = await api.get<{ ok: boolean }>('/jobs');
    expect(out.ok).toBe(true);
    expect(calls[0].url).toBe('http://api.test/api/jobs');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer A1');
  });

  it('turns server errors into ApiError with the server message', async () => {
    responder = () => json(403, { statusCode: 403, message: 'This account is disabled', error: 'Forbidden' });
    await expect(api.post('/auth/signin', { email: 'a@b.c', password: 'x' }, { auth: false })).rejects.toMatchObject({ status: 403, message: 'This account is disabled' });
  });

  it('refreshes once on 401 and retries the original request', async () => {
    setSession(session());
    responder = (call) => {
      if (call.url.endsWith('/auth/refresh')) return json(200, session({ access_token: 'A2', refresh_token: 'R2' }));
      const auth = (call.init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer A2' ? json(200, [{ id: 'j1' }]) : json(401, { message: 'Unauthorized' });
    };
    const jobs = await api.get<{ id: string }[]>('/jobs');
    expect(jobs).toEqual([{ id: 'j1' }]);
    expect(calls.map((c) => c.url.replace('http://api.test/api', ''))).toEqual(['/jobs', '/auth/refresh', '/jobs']);
    expect(getSession()?.refresh_token).toBe('R2');
  });

  it('shares one refresh across concurrent 401s (single-flight)', async () => {
    setSession(session());
    let refreshes = 0;
    responder = (call) => {
      if (call.url.endsWith('/auth/refresh')) { refreshes += 1; return json(200, session({ access_token: 'A2', refresh_token: 'R2' })); }
      const auth = (call.init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer A2' ? json(200, { ok: true }) : json(401, {});
    };
    await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);
    expect(refreshes).toBe(1);
  });

  it('refreshes proactively before sending when the token is expired', async () => {
    setSession(session({ expires_at: now() - 5 }));
    responder = (call) => (call.url.endsWith('/auth/refresh') ? json(200, session({ access_token: 'A2', refresh_token: 'R2' })) : json(200, { ok: true }));
    await api.get('/jobs');
    expect(calls[0].url).toContain('/auth/refresh');
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe('Bearer A2');
  });

  it('clears the session when the refresh is rejected, keeps it on a network failure', async () => {
    setSession(session());
    responder = (call) => (call.url.endsWith('/auth/refresh') ? json(401, { message: 'invalid refresh token' }) : json(401, {}));
    await expect(api.get('/jobs')).rejects.toBeInstanceOf(ApiError);
    expect(getSession()).toBeNull();

    setSession(session());
    responder = (call) => { if (call.url.endsWith('/auth/refresh')) throw new TypeError('Network request failed'); return json(401, {}); };
    const out = await refreshSessionDetailed();
    expect(out).toEqual({ ok: false, reason: 'network' });
    expect(getSession()).not.toBeNull();
  });

  it('reports offline vs unreachable', async () => {
    responder = () => { throw new TypeError('Network request failed'); };
    await expect(api.get('/jobs', { auth: false })).rejects.toMatchObject({ code: 'network', message: UNREACHABLE_MESSAGE });
    setOnline(false);
    await expect(api.get('/jobs', { auth: false })).rejects.toMatchObject({ message: OFFLINE_MESSAGE });
  });
});
