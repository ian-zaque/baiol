import { Injectable } from '@nestjs/common';
import { ITEM_SELECT, ItemRow } from '../../common/types';
import { ItemDelete, ItemInsert, ItemRepository, ItemUpdate } from '../../persistence/item.repository';
import { PersistenceError } from '../../persistence/persistence.error';
import { callAudit, maybe, missingGrocerySchema, rows } from './supabase-db';
import { SupabaseClientProvider } from './supabase-client.provider';

@Injectable()
export class SupabaseItemRepository extends ItemRepository {
  constructor(private readonly db: SupabaseClientProvider) {
    super();
  }

  async listActive(listId: string): Promise<ItemRow[]> {
    const embedded = await this.db.client
      .from('items')
      .select(ITEM_SELECT)
      .eq('list_id', listId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (!embedded.error) {
      return (embedded.data ?? []) as ItemRow[];
    }
    if (!missingGrocerySchema(embedded.error.message)) {
      throw new PersistenceError(embedded.error.message);
    }
    return rows(
      await this.db.client
        .from('items')
        .select('*')
        .eq('list_id', listId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
    );
  }

  async findById(id: string): Promise<ItemRow | null> {
    const embedded = await this.db.client.from('items').select(ITEM_SELECT).eq('id', id).maybeSingle();
    if (!embedded.error) {
      return (embedded.data as ItemRow | null) ?? null;
    }
    if (!missingGrocerySchema(embedded.error.message)) {
      throw new PersistenceError(embedded.error.message);
    }
    return maybe(await this.db.client.from('items').select('*').eq('id', id).maybeSingle());
  }

  insert(input: ItemInsert): Promise<ItemRow> {
    return callAudit<ItemRow>(this.db.client, 'apply_item_insert', {
      p_actor_id: input.actorId,
      p_action: input.action,
      p_id: input.id,
      p_list_id: input.listId,
      p_grocery_type_id: input.groceryTypeId,
      p_name: input.name,
      p_description: input.description,
      p_amount: input.amount,
      p_price: input.price,
      p_checked: input.checked,
    });
  }

  update(input: ItemUpdate): Promise<ItemRow> {
    return callAudit<ItemRow>(this.db.client, 'apply_item_update', {
      p_actor_id: input.actorId,
      p_action: input.action,
      p_item_id: input.itemId,
      p_list_id: input.listId,
      p_patch: input.patch,
    });
  }

  async softDelete(input: ItemDelete): Promise<void> {
    await callAudit(this.db.client, 'apply_item_soft_delete', {
      p_actor_id: input.actorId,
      p_action: input.action,
      p_item_id: input.itemId,
      p_list_id: input.listId,
    });
  }
}
