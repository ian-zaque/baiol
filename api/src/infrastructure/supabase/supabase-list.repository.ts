import { Injectable } from '@nestjs/common';
import { ListRow } from '../../common/types';
import {
  ListDelete,
  ListInsert,
  ListRepository,
  ListUpdate,
  MembershipRef,
} from '../../persistence/list.repository';
import { PersistenceError } from '../../persistence/persistence.error';
import { callAudit, maybe, rows } from './supabase-db';
import { SupabaseClientProvider } from './supabase-client.provider';

@Injectable()
export class SupabaseListRepository extends ListRepository {
  constructor(private readonly db: SupabaseClientProvider) {
    super();
  }

  async membershipsForUser(userId: string): Promise<MembershipRef[]> {
    const data = rows(
      await this.db.client
        .from('list_members')
        .select('list_id, role')
        .eq('user_id', userId)
        .is('deleted_at', null),
    );
    return data as MembershipRef[];
  }

  async findActiveByIds(ids: string[]): Promise<ListRow[]> {
    if (ids.length === 0) {
      return [];
    }
    return rows(
      await this.db.client
        .from('lists')
        .select('*')
        .in('id', ids)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false }),
    );
  }

  async countActiveItems(listIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (listIds.length === 0) {
      return counts;
    }
    const data = rows<{ list_id: string }>(
      await this.db.client
        .from('items')
        .select('list_id')
        .in('list_id', listIds)
        .is('deleted_at', null),
    );
    for (const item of data) {
      counts.set(item.list_id, (counts.get(item.list_id) ?? 0) + 1);
    }
    return counts;
  }

  async findActiveById(id: string): Promise<ListRow | null> {
    return maybe(
      await this.db.client
        .from('lists')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle(),
    );
  }

  async findActiveByShareToken(token: string): Promise<ListRow | null> {
    return maybe(
      await this.db.client
        .from('lists')
        .select('*')
        .eq('share_token', token)
        .is('deleted_at', null)
        .maybeSingle(),
    );
  }

  insert(input: ListInsert): Promise<ListRow> {
    return callAudit<ListRow>(this.db.client, 'apply_list_insert', {
      p_actor_id: input.actorId,
      p_list_action: input.listAction,
      p_member_action: input.memberAction,
      p_id: input.id,
      p_name: input.name,
      p_description: input.description,
      p_currency: input.currency,
      p_created_by_id: input.createdById,
      p_share_token: input.shareToken,
    });
  }

  update(input: ListUpdate): Promise<ListRow> {
    return callAudit<ListRow>(this.db.client, 'apply_list_update', {
      p_actor_id: input.actorId,
      p_action: input.action,
      p_list_id: input.listId,
      p_patch: input.patch,
    });
  }

  async softDelete(input: ListDelete): Promise<void> {
    await callAudit(this.db.client, 'apply_list_soft_delete', {
      p_actor_id: input.actorId,
      p_action: input.action,
      p_list_id: input.listId,
    });
  }

  async touch(id: string): Promise<void> {
    const result = await this.db.client
      .from('lists')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);
    if (result.error) {
      throw new PersistenceError(result.error.message);
    }
  }
}
