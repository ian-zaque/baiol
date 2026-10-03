import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Socket } from 'socket.io-client';
import { useAuth } from './auth-context';
import { getGuestIdentity } from './guest';
import { connectRealtime } from './socket';
import { PresenceUser, PublicItem, PublicList, PublicMember } from './types';

export function useListRealtime(options: {
  listId?: string;
  shareToken?: string;
}) {
  const { listId, shareToken } = options;
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);

  useEffect(() => {
    if (!listId) {
      setPresence([]);
      return;
    }

    if (!shareToken && !session?.access_token) {
      setPresence([]);
      return;
    }

    let cancelled = false;
    let socket: Socket | undefined;
    const cacheKey = shareToken ? ['shared', shareToken] : ['list', listId];

    const applyList = (updater: (list: PublicList) => PublicList) => {
      queryClient.setQueryData<PublicList>(cacheKey, (current) =>
        current ? updater(current) : current,
      );
      void queryClient.invalidateQueries({ queryKey: ['lists'] });
    };

    const bind = (next: Socket) => {
      const join = () => {
        next.emit('join_list', { listId });
      };
      // Server emits ready only after auth finishes. Joining on connect races that.
      next.on('ready', join);

      next.on('presence', (payload: { listId: string; users: PresenceUser[] }) => {
        if (payload.listId === listId) {
          setPresence(payload.users ?? []);
        }
      });

      next.on('item.created', (payload: { listId: string; item: PublicItem }) => {
        if (payload.listId !== listId) return;
        applyList((list) => ({
          ...list,
          items: list.items.some((item) => item.id === payload.item.id)
            ? list.items
            : [...list.items, payload.item],
        }));
      });

      next.on('item.updated', (payload: { listId: string; item: PublicItem }) => {
        if (payload.listId !== listId) return;
        applyList((list) => ({
          ...list,
          items: list.items.map((item) =>
            item.id === payload.item.id ? payload.item : item,
          ),
        }));
      });

      next.on('item.deleted', (payload: { listId: string; itemId: string }) => {
        if (payload.listId !== listId) return;
        applyList((list) => ({
          ...list,
          items: list.items.filter((item) => item.id !== payload.itemId),
        }));
      });

      next.on(
        'list.updated',
        (payload: {
          listId: string;
          list: Partial<PublicList> & { deleted_at?: string | null };
        }) => {
          if (payload.listId !== listId) return;
          if (payload.list.deleted_at) {
            void queryClient.invalidateQueries({ queryKey: ['lists'] });
            return;
          }
          applyList((list) => ({ ...list, ...payload.list, items: list.items }));
        },
      );

      next.on(
        'members.changed',
        (payload: { listId: string; members: PublicMember[] }) => {
          if (payload.listId !== listId) return;
          applyList((list) => ({ ...list, members: payload.members }));
        },
      );
    };

    void (async () => {
      const auth = shareToken
        ? { shareToken, ...(await getGuestIdentity()) }
        : { token: session?.access_token };
      if (cancelled) return;
      setSelfId(
        'guestId' in auth ? auth.guestId : (session?.user.id ?? null),
      );
      socket = connectRealtime(auth);
      if (cancelled) {
        socket.disconnect();
        return;
      }
      bind(socket);
      socket.connect();
    })();

    return () => {
      cancelled = true;
      if (socket) {
        socket.emit('leave_list', { listId });
        socket.removeAllListeners();
        socket.disconnect();
      }
    };
  }, [listId, queryClient, session?.access_token, shareToken]);

  return { presence, selfId };
}
