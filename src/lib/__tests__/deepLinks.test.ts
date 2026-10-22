import { parseLink, resolveSystemPath } from '~/lib/deepLinks';

const JOB = '38dde90c-1111-2222-3333-444444444444';

describe('deep links', () => {
  it('parses scheme, host, path and query', () => {
    expect(parseLink('https://hausboss.app/accept-invite?token=abc%20def&type=invite#x')).toEqual({ scheme: 'https', host: 'hausboss.app', path: '/accept-invite', query: { token: 'abc def', type: 'invite' } });
    expect(parseLink('hausboss://job/123')).toEqual({ scheme: 'hausboss', host: 'job', path: '/123', query: {} });
    expect(parseLink('/estimate/x')).toEqual({ scheme: null, host: null, path: '/estimate/x', query: {} });
  });

  it('maps universal links onto app routes', () => {
    expect(resolveSystemPath('https://hausboss.app/estimate/0f8b1a2c-0000-0000-0000-000000000000')).toBe('/public-estimate/0f8b1a2c-0000-0000-0000-000000000000');
    expect(resolveSystemPath('https://www.hausboss.app/accept-invite?token=t1&type=invite')).toBe('/accept-invite?token=t1');
    expect(resolveSystemPath('https://hausboss.app/reset-password?token=r%2F1&type=recovery')).toBe('/reset-password?token=r%2F1');
    expect(resolveSystemPath(`https://hausboss.app/job/${JOB}`)).toBe(`/job/${JOB}`);
    expect(resolveSystemPath(`https://hausboss.app/messages/${JOB}`)).toBe(`/messages/${JOB}`);
    expect(resolveSystemPath('https://hausboss.app/')).toBe('/');
  });

  it('leaves unknown hosts, the dev-client URL and app-scheme routes alone', () => {
    expect(resolveSystemPath('https://evil.example/estimate/abc')).toBeNull();
    expect(resolveSystemPath('hausboss://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8083')).toBeNull();
    expect(resolveSystemPath(`hausboss://job/${JOB}`)).toBe(`/job/${JOB}`); // already an app route (host = first segment)
    expect(resolveSystemPath('https://hausboss.app/settings')).toBeNull();
    expect(resolveSystemPath('https://hausboss.app/job/not-a-uuid')).toBeNull();
  });
});
