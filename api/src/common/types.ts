export type MemberRole = 'owner' | 'editor';

export type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
};

export type ListRow = {
  id: string;
  name: string;
  description: string;
  currency: string | null;
  created_by_id: string;
  share_token: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type GroceryType = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
};

export type ItemRow = {
  id: string;
  list_id: string;
  grocery_type_id: string | null;
  name: string;
  description: string;
  amount: string;
  price: number | string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  grocery_types?: GroceryType | GroceryType[] | null;
};

export type MemberRow = {
  list_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
};

export type InviteRow = {
  id: string;
  list_id: string;
  email: string;
  token: string;
  invited_by_id: string;
  status: 'pending' | 'accepted' | 'revoked';
  expires_at: string;
  created_at: string;
};

export type PublicItem = {
  id: string;
  name: string;
  description: string;
  amount: string;
  price: number;
  grocery_type: GroceryType | null;
};

export type PublicList = {
  id: string;
  name: string;
  description: string;
  currency: string;
  items: PublicItem[];
  created_by_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PublicMember = {
  user_id: string;
  email: string;
  display_name: string;
  role: MemberRole;
};

export const ITEM_SELECT = '*, grocery_types(id, code, name, sort_order)';

function groceryTypeOf(row: ItemRow): GroceryType | null {
  const value = row.grocery_types;
  if (!value) return null;
  const type = Array.isArray(value) ? value[0] : value;
  if (!type) return null;
  return {
    id: type.id,
    code: type.code,
    name: type.name,
    sort_order: type.sort_order,
  };
}

export function toPublicItem(row: ItemRow): PublicItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    amount: row.amount ?? '',
    price: Number(row.price ?? 0),
    grocery_type: groceryTypeOf(row),
  };
}

export function toPublicList(row: ListRow, items: ItemRow[] = []): PublicList {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    currency: row.currency?.trim() || 'BRL',
    items: items.map(toPublicItem),
    created_by_id: row.created_by_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

export function displayNameOf(profile: {
  display_name: string | null;
  email: string;
}): string {
  return profile.display_name?.trim() || profile.email.split('@')[0];
}
