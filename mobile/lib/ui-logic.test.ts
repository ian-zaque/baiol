import { coverMid, midColor } from '../constants/Colors';
import { formatPrice, maskPrice, parsePrice } from '../lib/money';
import { sortItemsByChecked } from '../lib/item-order';
import { PublicItem } from '../lib/types';

function item(name: string, checked?: boolean): PublicItem {
  return {
    id: name,
    name,
    description: '',
    amount: '',
    price: 1,
    checked,
  };
}

describe('cover color', () => {
  it('averages the lightest and darkest hex colors', () => {
    expect(midColor('#FFFFFF', '#000000')).toBe('#808080');
    expect(midColor('#3EC6F5', '#0A4F9C')).toBe('#248bc9');
  });

  it('picks a stable mid color for a list id', () => {
    expect(coverMid('list-1')).toBe(coverMid('list-1'));
    expect(coverMid('list-1')).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('money', () => {
  it('masks and parses a Brazilian price', () => {
    expect(maskPrice('1234', 'BRL')).toBe('R$ 12,34');
    expect(parsePrice('R$ 12,34', 'BRL')).toBe(12.34);
    expect(formatPrice(12.34, 'BRL')).toBe('R$ 12,34');
  });

  it('uses whole units for yen', () => {
    expect(maskPrice('1200', 'JPY')).toBe('¥ 1,200');
    expect(parsePrice('¥ 1,200', 'JPY')).toBe(1200);
  });
});

describe('item order', () => {
  it('keeps unchecked items above checked ones', () => {
    const ordered = sortItemsByChecked([
      item('Rice', true),
      item('Milk', false),
      item('Eggs'),
    ]);
    expect(ordered.map((entry) => entry.name)).toEqual(['Milk', 'Eggs', 'Rice']);
  });
});
