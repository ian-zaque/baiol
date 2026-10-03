export type GroceryType = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
};

export type PublicItem = {
  id: string;
  name: string;
  description: string;
  amount: string;
  price: number;
  checked?: boolean;
  grocery_type?: GroceryType | null;
};

export type PublicMember = {
  user_id: string;
  email: string;
  display_name: string;
  role: 'owner' | 'editor';
};

export type PublicList = {
  id: string;
  name: string;
  description: string;
  currency?: string;
  items: PublicItem[];
  created_by_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  item_count?: number;
  role?: 'owner' | 'editor';
  members?: PublicMember[];
};

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
};

export type PresenceUser = {
  id: string;
  email: string;
  display_name: string;
};
