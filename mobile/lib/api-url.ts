export function resolveApiUrl(raw: string | undefined): string {
  const value = raw?.trim().replace(/\/$/, '') ?? '';
  if (!value) {
    throw new Error('EXPO_PUBLIC_API_URL is required');
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
  return `https://${value}`;
}
