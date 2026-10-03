import { ListRow, MemberRole } from '../common/types';

export type MembershipRef = {
  list_id: string;
  role: MemberRole;
};

export type ListInsert = {
  actorId: string;
  listAction: string;
  memberAction: string;
  id: string;
  name: string;
  description: string;
  currency: string;
  createdById: string;
  shareToken: string;
};

export type ListUpdate = {
  actorId: string | null;
  action: string;
  listId: string;
  patch: Record<string, string>;
};

export type ListDelete = {
  actorId: string | null;
  action: string;
  listId: string;
};

export abstract class ListRepository {
  abstract membershipsForUser(userId: string): Promise<MembershipRef[]>;
  abstract findActiveByIds(ids: string[]): Promise<ListRow[]>;
  abstract countActiveItems(listIds: string[]): Promise<Map<string, number>>;
  abstract findActiveById(id: string): Promise<ListRow | null>;
  abstract findActiveByShareToken(token: string): Promise<ListRow | null>;
  abstract insert(input: ListInsert): Promise<ListRow>;
  abstract update(input: ListUpdate): Promise<ListRow>;
  abstract softDelete(input: ListDelete): Promise<void>;
  abstract touch(id: string): Promise<void>;
}
