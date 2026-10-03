export type MoneyCurrency = {
  code: string;
  name: string;
  symbol: string;
  decimal: string;
  thousands: string;
  fractionDigits: 0 | 2;
};

export const DEFAULT_CURRENCY_CODE = 'BRL';

export const CURRENCIES: MoneyCurrency[] = [
  { code: 'BRL', name: 'Brazilian real', symbol: 'R$', decimal: ',', thousands: '.', fractionDigits: 2 },
  { code: 'USD', name: 'US dollar', symbol: '$', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimal: ',', thousands: '.', fractionDigits: 2 },
  { code: 'GBP', name: 'British pound', symbol: '£', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'JPY', name: 'Japanese yen', symbol: '¥', decimal: '.', thousands: ',', fractionDigits: 0 },
  { code: 'CNY', name: 'Chinese yuan', symbol: 'CN¥', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'INR', name: 'Indian rupee', symbol: '₹', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'CAD', name: 'Canadian dollar', symbol: 'CA$', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'AUD', name: 'Australian dollar', symbol: 'A$', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'NZD', name: 'New Zealand dollar', symbol: 'NZ$', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'CHF', name: 'Swiss franc', symbol: 'CHF', decimal: '.', thousands: "'", fractionDigits: 2 },
  { code: 'MXN', name: 'Mexican peso', symbol: 'MX$', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'ARS', name: 'Argentine peso', symbol: 'AR$', decimal: ',', thousands: '.', fractionDigits: 2 },
  { code: 'CLP', name: 'Chilean peso', symbol: 'CLP$', decimal: ',', thousands: '.', fractionDigits: 0 },
  { code: 'COP', name: 'Colombian peso', symbol: 'COL$', decimal: ',', thousands: '.', fractionDigits: 0 },
  { code: 'PEN', name: 'Peruvian sol', symbol: 'S/', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'UYU', name: 'Uruguayan peso', symbol: '$U', decimal: ',', thousands: '.', fractionDigits: 2 },
  { code: 'BOB', name: 'Bolivian boliviano', symbol: 'Bs', decimal: ',', thousands: '.', fractionDigits: 2 },
  { code: 'PYG', name: 'Paraguayan guaraní', symbol: '₲', decimal: ',', thousands: '.', fractionDigits: 0 },
  { code: 'KRW', name: 'South Korean won', symbol: '₩', decimal: '.', thousands: ',', fractionDigits: 0 },
  { code: 'ZAR', name: 'South African rand', symbol: 'R', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'TRY', name: 'Turkish lira', symbol: '₺', decimal: ',', thousands: '.', fractionDigits: 2 },
  { code: 'SEK', name: 'Swedish krona', symbol: 'kr', decimal: ',', thousands: ' ', fractionDigits: 2 },
  { code: 'NOK', name: 'Norwegian krone', symbol: 'nkr', decimal: ',', thousands: ' ', fractionDigits: 2 },
  { code: 'DKK', name: 'Danish krone', symbol: 'dkr', decimal: ',', thousands: '.', fractionDigits: 2 },
  { code: 'PLN', name: 'Polish złoty', symbol: 'zł', decimal: ',', thousands: ' ', fractionDigits: 2 },
  { code: 'RUB', name: 'Russian ruble', symbol: '₽', decimal: ',', thousands: ' ', fractionDigits: 2 },
  { code: 'AED', name: 'UAE dirham', symbol: 'AED', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'SAR', name: 'Saudi riyal', symbol: 'SAR', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'ILS', name: 'Israeli shekel', symbol: '₪', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'HKD', name: 'Hong Kong dollar', symbol: 'HK$', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'SGD', name: 'Singapore dollar', symbol: 'S$', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'THB', name: 'Thai baht', symbol: '฿', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'PHP', name: 'Philippine peso', symbol: '₱', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'IDR', name: 'Indonesian rupiah', symbol: 'Rp', decimal: ',', thousands: '.', fractionDigits: 0 },
  { code: 'VND', name: 'Vietnamese đồng', symbol: '₫', decimal: ',', thousands: '.', fractionDigits: 0 },
  { code: 'EGP', name: 'Egyptian pound', symbol: 'E£', decimal: '.', thousands: ',', fractionDigits: 2 },
  { code: 'NGN', name: 'Nigerian naira', symbol: '₦', decimal: '.', thousands: ',', fractionDigits: 2 },
];

export const CURRENCY_CODES = CURRENCIES.map((currency) => currency.code);

export function currencyOf(code?: string | null): MoneyCurrency {
  const normalized = code?.trim().toUpperCase();
  return CURRENCIES.find((currency) => currency.code === normalized) ?? CURRENCIES[0];
}

function digitsOnly(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return (digits || '0').slice(0, 12);
}

function groupThousands(whole: string, separator: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/** Currency mask. With cents, 1234 becomes 12.34 in that currency's format. */
export function maskPrice(value: string, code?: string | null): string {
  const currency = currencyOf(code);
  const digits = digitsOnly(value);
  if (currency.fractionDigits === 0) {
    return `${currency.symbol} ${groupThousands(digits, currency.thousands)}`;
  }
  const padded = digits.padStart(currency.fractionDigits + 1, '0');
  const whole = groupThousands(padded.slice(0, -currency.fractionDigits), currency.thousands);
  const fraction = padded.slice(-currency.fractionDigits);
  return `${currency.symbol} ${whole}${currency.decimal}${fraction}`;
}

export function parsePrice(masked: string, code?: string | null): number {
  const currency = currencyOf(code);
  const amount = Number(digitsOnly(masked));
  if (!Number.isFinite(amount)) return 0;
  return amount / 10 ** currency.fractionDigits;
}

export function formatPrice(value: number, code?: string | null): string {
  const currency = currencyOf(code);
  const units = Math.round(Math.abs(Number(value) || 0) * 10 ** currency.fractionDigits);
  return maskPrice(String(units), currency.code);
}
