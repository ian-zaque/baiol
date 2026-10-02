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
  created_by_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ItemRow = {
  id: string;
  list_id: string;
  name: string;
  description: string;
  amount: string;
  price: number | string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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
};

export type PublicList = {
  id: string;
  name: string;
  description: string;
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

export function toPublicItem(row: ItemRow): PublicItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    amount: row.amount ?? '',
    price: Number(row.price ?? 0),
  };
}

export function toPublicList(row: ListRow, items: ItemRow[] = []): PublicList {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
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
