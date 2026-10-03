import { Injectable } from '@nestjs/common';
import { ListRow, MemberRole } from '../../common/types';
import {
  ListDelete,
  ListInsert,
  ListRepository,
  ListUpdate,
  MembershipRef,
} from '../../persistence/list.repository';
import { PersistenceError } from '../../persistence/persistence.error';
import { callAudit, maybe, one, rows } from './supabase-db';
import { SupabaseClientProvider } from './supabase-client.provider';

const LIST_COLUMNS =
  'uuid, name, description, currency, share_token, created_at, updated_at, deleted_at, users!created_by_id(uuid)';

type ListRecord = {
  uuid: string;
  name: string;
  description: string;
  currency: string | null;
  share_token: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  users: { uuid: string } | { uuid: string }[] | null;
};

function toList(row: ListRecord): ListRow {
  const owner = one(row.users);
  if (!owner) {
    throw new PersistenceError('User not found');
  }
  return {
    id: row.uuid,
    name: row.name,
    description: row.description,
    currency: row.currency,
    created_by_id: owner.uuid,
    share_token: row.share_token,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

@Injectable()
export class SupabaseListRepository extends ListRepository {
  constructor(private readonly db: SupabaseClientProvider) {
    super();
  }

  async membershipsForUser(userId: string): Promise<MembershipRef[]> {
    const data = rows<{ role: MemberRole; lists: { uuid: string } | { uuid: string }[] }>(
      await this.db.client
        .from('list_members')
        .select('role, lists!inner(uuid), users!inner(uuid)')
        .eq('users.uuid', userId)
        .is('deleted_at', null),
    );
    return data.map((row) => {
      const list = one(row.lists);
      if (!list) {
        throw new PersistenceError('List not found');
      }
      return { list_id: list.uuid, role: row.role };
    });
  }

  async findActiveByIds(ids: string[]): Promise<ListRow[]> {
    if (ids.length === 0) {
      return [];
    }
    const data = rows<ListRecord>(
      await this.db.client
        .from('lists')
        .select(LIST_COLUMNS)
        .in('uuid', ids)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false }),
    );
    return data.map(toList);
  }

  async countActiveItems(listIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (listIds.length === 0) {
      return counts;
    }
    const data = rows<{ lists: { uuid: string } | { uuid: string }[] }>(
      await this.db.client
        .from('items')
        .select('lists!inner(uuid)')
        .in('lists.uuid', listIds)
        .is('deleted_at', null),
    );
    for (const item of data) {
      const list = one(item.lists);
      if (!list) {
        continue;
      }
      counts.set(list.uuid, (counts.get(list.uuid) ?? 0) + 1);
    }
    return counts;
  }

  async findActiveById(id: string): Promise<ListRow | null> {
    const row = maybe<ListRecord>(
      await this.db.client
        .from('lists')
        .select(LIST_COLUMNS)
        .eq('uuid', id)
        .is('deleted_at', null)
        .maybeSingle(),
    );
    return row ? toList(row) : null;
  }

  async findActiveByShareToken(token: string): Promise<ListRow | null> {
    const row = maybe<ListRecord>(
      await this.db.client
        .from('lists')
        .select(LIST_COLUMNS)
        .eq('share_token', token)
        .is('deleted_at', null)
        .maybeSingle(),
    );
    return row ? toList(row) : null;
  }

  insert(input: ListInsert): Promise<ListRow> {
    return callAudit<ListRow>(this.db.client, 'apply_list_insert', {
      p_actor_uuid: input.actorId,
      p_list_action: input.listAction,
      p_member_action: input.memberAction,
      p_list_uuid: input.id,
      p_name: input.name,
      p_description: input.description,
      p_currency: input.currency,
      p_created_by_uuid: input.createdById,
      p_share_token: input.shareToken,
    });
  }

  update(input: ListUpdate): Promise<ListRow> {
    return callAudit<ListRow>(this.db.client, 'apply_list_update', {
      p_actor_uuid: input.actorId,
      p_action: input.action,
      p_list_uuid: input.listId,
      p_patch: input.patch,
    });
  }

  async softDelete(input: ListDelete): Promise<void> {
    await callAudit(this.db.client, 'apply_list_soft_delete', {
      p_actor_uuid: input.actorId,
      p_action: input.action,
      p_list_uuid: input.listId,
    });
  }

  async touch(id: string): Promise<void> {
    const result = await this.db.client
      .from('lists')
      .update({ updated_at: new Date().toISOString() })
      .eq('uuid', id);
    if (result.error) {
      throw new PersistenceError(result.error.message);
    }
  }
}
