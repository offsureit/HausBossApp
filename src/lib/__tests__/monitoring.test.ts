import * as Sentry from '@sentry/react-native';
import { monitoring, sanitizeBreadcrumb, sanitizeEvent, scrub } from '../monitoring';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  setContext: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  wrap: (c: unknown) => c,
  expoRouterIntegration: jest.fn(() => ({ name: 'ExpoRouter' })),
}));
jest.mock('expo', () => ({ isRunningInExpoGo: () => false }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0', android: { versionCode: 1 } } } }));

describe('monitoring (no PII)', () => {
  it('scrubs emails, phone numbers, bearer tokens and token query strings', () => {
    expect(scrub('call jane.doe@example.com or +1 (555) 010-2233 now')).toBe('call [email] or [phone] now');
    expect(scrub('Authorization: Bearer eyJhbGciOi.abc_def-123')).toBe('Authorization: Bearer [redacted]');
    expect(scrub('https://hausboss.app/reset-password?token=abc123&type=recovery')).toBe('https://hausboss.app/reset-password?token=[redacted]&type=recovery');
    expect(scrub('https://hausboss.app/storage/e98be78a-933d-451a-a3e6-07755cfaaf7d/38dde90c-e47e-4f7f-af4f-a56517d66f2c/1760000_kitchen.jpg')).toBe('https://hausboss.app/storage/e98be78a-933d-451a-a3e6-07755cfaaf7d/38dde90c-e47e-4f7f-af4f-a56517d66f2c/[file]');
  });

  it('keeps ids, dates and job numbers', () => {
    expect(scrub('job 38dde90c-e47e-4f7f-af4f-a56517d66f2c at 2026-10-22T02:10:05Z')).toBe('job 38dde90c-e47e-4f7f-af4f-a56517d66f2c at 2026-10-22T02:10:05Z');
    expect(scrub('GET /api/jobs 401')).toBe('GET /api/jobs 401');
  });

  it('beforeSend drops request headers / bodies and keeps only the user id', () => {
    const event = sanitizeEvent({
      message: 'failed for bob@acme.com',
      request: { url: 'https://hausboss.app/api/auth/exchange?token=secret', headers: { Authorization: 'Bearer x' }, data: { password: 'p' } },
      user: { id: 'u1', email: 'bob@acme.com', username: 'bob' },
      exception: { values: [{ type: 'Error', value: 'Customer +15550102233 not found' }] },
      breadcrumbs: [
        { category: 'console', message: 'debug bob@acme.com' },
        { category: 'fetch', data: { url: 'https://hausboss.app/api/messages?phone=%2B15550102233', method: 'GET', status_code: 200 } },
      ],
      extra: { token: 'abc', note: 'ring 555-010-2233' },
    } as unknown as Sentry.ErrorEvent);
    expect(event.request).toEqual({ url: 'https://hausboss.app/api/auth/exchange?token=[redacted]' });
    expect(event.user).toEqual({ id: 'u1' });
    expect(event.message).toBe('failed for [email]');
    expect(event.exception?.values?.[0]?.value).toBe('Customer [phone] not found');
    expect(event.breadcrumbs).toHaveLength(1);
    expect(event.breadcrumbs?.[0]?.category).toBe('fetch');
    expect(event.extra).toEqual({ token: '[redacted]', note: 'ring [phone]' });
  });

  it('console breadcrumbs are dropped, others scrubbed', () => {
    expect(sanitizeBreadcrumb({ category: 'console', message: 'x' })).toBeNull();
    expect(sanitizeBreadcrumb({ category: 'navigation', data: { to: '/messages/abc', from: 'tel:+15550102233' } })).toEqual({ category: 'navigation', data: { to: '/messages/abc', from: 'tel:[phone]' } });
  });

  it('initialises disabled without a DSN and sends the account id only', () => {
    monitoring.init();
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, sendDefaultPii: false, attachScreenshot: false, release: 'hausboss-mobile@1.0.0', dist: '1' }));
    monitoring.setUser('u1');
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'u1' });
    monitoring.setUser(null);
    expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
    monitoring.captureError('boom bob@acme.com');
    expect(Sentry.captureMessage).toHaveBeenCalledWith('boom [email]', { level: 'error' });
  });
});
