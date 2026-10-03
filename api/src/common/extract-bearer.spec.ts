import { extractBearerToken } from './extract-bearer';

describe('extractBearerToken', () => {
  it('reads the token after Bearer', () => {
    expect(extractBearerToken('Bearer abc.def')).toBe('abc.def');
  });

  it('returns null when the header is missing', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('uses the fallback when the header is not a bearer token', () => {
    expect(extractBearerToken('Basic abc', 'socket-token')).toBe('socket-token');
  });
});
