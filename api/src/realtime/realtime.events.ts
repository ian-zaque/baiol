export const REALTIME_EVENTS = {
  listUpdated: 'list.updated',
  itemCreated: 'item.created',
  itemUpdated: 'item.updated',
  itemDeleted: 'item.deleted',
  membersChanged: 'members.changed',
} as const;

export type ListRealtimeEvent =
  | { type: typeof REALTIME_EVENTS.listUpdated; listId: string; list: unknown }
  | { type: typeof REALTIME_EVENTS.itemCreated; listId: string; item: unknown }
  | { type: typeof REALTIME_EVENTS.itemUpdated; listId: string; item: unknown }
  | {
      type: typeof REALTIME_EVENTS.itemDeleted;
      listId: string;
      itemId: string;
    }
  | {
      type: typeof REALTIME_EVENTS.membersChanged;
      listId: string;
      members: unknown;
    };
