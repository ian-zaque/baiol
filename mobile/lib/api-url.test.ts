import { resolveApiUrl } from '../lib/api-url';

describe('API address', () => {
  it('keeps a full URL and drops a trailing slash', () => {
    expect(resolveApiUrl('https://baiol-production.up.railway.app/')).toBe(
      'https://baiol-production.up.railway.app',
    );
  });

  it('adds https when the host has no scheme', () => {
    expect(resolveApiUrl('baiol-production.up.railway.app')).toBe(
      'https://baiol-production.up.railway.app',
    );
  });

  it('falls back to the local API', () => {
    expect(resolveApiUrl(undefined)).toBe('http://localhost:3000');
    expect(resolveApiUrl('  http://10.0.2.2:3000  ')).toBe('http://10.0.2.2:3000');
  });
});
