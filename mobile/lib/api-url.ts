export function resolveApiUrl(raw: string | undefined): string {
  const value = (raw ?? 'http://localhost:3000').trim().replace(/\/$/, '');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
  return `https://${value}`;
}
