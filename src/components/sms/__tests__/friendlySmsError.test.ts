/* eslint-disable import/first */
jest.mock('~/components/ui', () => ({ Text: () => null }));
jest.mock('~/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: {} }) }));
import { friendlySmsError } from '~/components/sms/SmsBubble';

describe('friendlySmsError', () => {
  it('reduces a Telnyx JSON error to its detail', () => {
    const raw = 'Telnyx 400: {\n  "errors": [\n    { "code": "10004", "title": "Missing required parameter", "detail": "Invalid source number.", "meta": {} }\n  ]\n}';
    expect(friendlySmsError(raw)).toBe('Invalid source number');
  });
  it('falls back to the title, then to the first line', () => {
    expect(friendlySmsError('Telnyx 422: {"errors":[{"title":"Number blocked"}]}')).toBe('Number blocked');
    expect(friendlySmsError('Network request failed\nstack…')).toBe('Network request failed');
    // Stored errors can be cut off mid-JSON.
    expect(friendlySmsError('Telnyx 400: {\n "errors": [ { "code": "10004", "title": "Missing required parameter", "detail": "Invalid source number.", "meta": { "url": "https://dev')).toBe('Invalid source number');
  });
});
