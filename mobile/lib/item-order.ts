import { PublicItem } from './types';

export function sortItemsByChecked(items: PublicItem[]) {
  return [...items].sort((a, b) => Number(Boolean(a.checked)) - Number(Boolean(b.checked)));
}
