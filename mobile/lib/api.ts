import { resolveApiUrl } from './api-url';
import { AppSession, clearSession, loadSession, saveSession } from './session';
import { GroceryType, Profile, PublicItem, PublicList, PublicMember } from './types';

const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL);

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

export type AuthResult = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  profile: Profile;
};

async function readError(response: Response): Promise<string> {
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
  return message;
}

let refreshPromise: Promise<AppSession | null> | null = null;

async function refreshSession(): Promise<AppSession | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const current = await loadSession();
    if (!current) return null;
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh_token: current.refreshToken }),
    });
    if (!response.ok) {
      await clearSession();
      return null;
    }
    const body = (await response.json()) as AuthResult;
    const next: AppSession = {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      userId: body.profile.id,
    };
    await saveSession(next);
    return next;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const session = await loadSession();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');
  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && retry && session && !path.startsWith('/auth/')) {
    const next = await refreshSession();
    if (next) {
      return request<T>(path, init, false);
    }
  }

  if (!response.ok) {
    throw new Error(await readError(response));
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

export function sessionFromAuth(result: AuthResult): AppSession {
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    userId: result.profile.id,
  };
}

export const api = {
  url: API_URL,
  register: (email: string, password: string, displayName: string) =>
    request<AuthResult>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name: displayName }),
    }),
  login: (email: string, password: string) =>
    request<AuthResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: async () => {
    const session = await loadSession();
    if (!session) return;
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    if (!response.ok && response.status !== 204) {
      throw new Error(await readError(response));
    }
  },
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
