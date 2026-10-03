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

  it('trims a full URL and requires a value', () => {
    expect(resolveApiUrl('  http://10.0.2.2:3000  ')).toBe('http://10.0.2.2:3000');
    expect(() => resolveApiUrl(undefined)).toThrow('EXPO_PUBLIC_API_URL is required');
    expect(() => resolveApiUrl('   ')).toThrow('EXPO_PUBLIC_API_URL is required');
  });
});
