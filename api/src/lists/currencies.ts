export const CURRENCY_CODES = [
  'BRL',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CNY',
  'INR',
  'CAD',
  'AUD',
  'NZD',
  'CHF',
  'MXN',
  'ARS',
  'CLP',
  'COP',
  'PEN',
  'UYU',
  'BOB',
  'PYG',
  'KRW',
  'ZAR',
  'TRY',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'RUB',
  'AED',
  'SAR',
  'ILS',
  'HKD',
  'SGD',
  'THB',
  'PHP',
  'IDR',
  'VND',
  'EGP',
  'NGN',
] as const;

export const DEFAULT_CURRENCY = 'BRL';

export function resolveCurrency(value?: string): string {
  const code = value?.trim().toUpperCase();
  if (!code) return DEFAULT_CURRENCY;
  return (CURRENCY_CODES as readonly string[]).includes(code) ? code : DEFAULT_CURRENCY;
}
