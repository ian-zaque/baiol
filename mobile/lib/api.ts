import { supabase } from './supabase';
import { GroceryType, Profile, PublicItem, PublicList, PublicMember } from './types';

function apiUrl() {
  const raw = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').trim().replace(/\/$/, '');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

const API_URL = apiUrl();

type ApiErrorBody = {
  message?: string | string[];
  error?: string;
};

type ItemBody = {
  name?: string;
  description?: string;
  amount?: string;
  price?: number;
  grocery_type_id?: string | null;
  checked?: boolean;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as ApiErrorBody;
      if (Array.isArray(body.message)) {
        message = body.message.join(', ');
      } else if (body.message) {
        message = body.message;
      } else if (body.error) {
        message = body.error;
      }
    } catch {
      // keep default message
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export type ShareLink = {
  token: string;
  app_link: string;
  web_link: string;
};

export const api = {
  url: API_URL,
  groceryTypes: () => request<GroceryType[]>('/grocery-types'),
  sync: () => request<{ profile: Profile }>('/me/sync', { method: 'POST' }),
  me: () => request<Profile>('/me'),
  updateMe: (display_name: string) =>
    request<Profile>('/me', {
      method: 'PATCH',
      body: JSON.stringify({ display_name }),
    }),
  lists: () => request<PublicList[]>('/lists'),
  list: (id: string) => request<PublicList>(`/lists/${id}`),
  createList: (body: { name: string; description?: string; currency?: string }) =>
    request<PublicList>('/lists', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateList: (id: string, body: { name?: string; description?: string; currency?: string }) =>
    request<PublicList>(`/lists/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteList: (id: string) =>
    request<{ ok: boolean }>(`/lists/${id}`, { method: 'DELETE' }),
  members: (listId: string) => request<PublicMember[]>(`/lists/${listId}/members`),
  shareLink: (listId: string) => request<ShareLink>(`/lists/${listId}/share`),
  rotateShareLink: (listId: string) =>
    request<ShareLink>(`/lists/${listId}/share/rotate`, { method: 'POST' }),
  createItem: (listId: string, body: ItemBody & { name: string }) =>
    request<PublicItem>(`/lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateItem: (listId: string, itemId: string, body: ItemBody) =>
    request<PublicItem>(`/lists/${listId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteItem: (listId: string, itemId: string) =>
    request<{ ok: boolean }>(`/lists/${listId}/items/${itemId}`, {
      method: 'DELETE',
    }),
  sharedList: (token: string) => request<PublicList>(`/shared/${token}`),
  updateSharedList: (token: string, body: { name?: string; description?: string }) =>
    request<PublicList>(`/shared/${token}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  createSharedItem: (token: string, body: ItemBody & { name: string }) =>
    request<PublicItem>(`/shared/${token}/items`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSharedItem: (token: string, itemId: string, body: ItemBody) =>
    request<PublicItem>(`/shared/${token}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteSharedItem: (token: string, itemId: string) =>
    request<{ ok: boolean }>(`/shared/${token}/items/${itemId}`, {
      method: 'DELETE',
    }),
};
