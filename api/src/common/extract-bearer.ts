export function extractBearerToken(
  authorization?: string,
  fallback?: string,
): string | null {
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim() || null;
  }
  if (fallback?.trim()) {
    return fallback.trim();
  }
  return null;
}
