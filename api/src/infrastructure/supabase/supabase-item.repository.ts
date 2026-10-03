import { Injectable } from '@nestjs/common';
import { GroceryType, ItemRow } from '../../common/types';
import { ItemDelete, ItemInsert, ItemRepository, ItemUpdate } from '../../persistence/item.repository';
import { PersistenceError } from '../../persistence/persistence.error';
import { callAudit, maybe, missingGrocerySchema, one, rows } from './supabase-db';
import { SupabaseClientProvider } from './supabase-client.provider';

const ITEM_COLUMNS =
  'uuid, name, description, amount, price, checked, created_at, updated_at, deleted_at';
const ITEM_SELECT = `${ITEM_COLUMNS}, lists!inner(uuid), grocery_types(uuid, code, name, sort_order)`;
const ITEM_SELECT_WITHOUT_TYPE = `${ITEM_COLUMNS}, lists!inner(uuid)`;

type GroceryEmbed = {
  uuid: string;
  code: string;
  name: string;
  sort_order: number;
};

type ItemRecord = {
  uuid: string;
  name: string;
  description: string;
  amount: string;
  price: number | string;
  checked?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  lists: { uuid: string } | { uuid: string }[];
  grocery_types?: GroceryEmbed | GroceryEmbed[] | null;
};

function toItem(row: ItemRecord): ItemRow {
  const list = one(row.lists);
  if (!list) {
    throw new PersistenceError('List not found');
  }
  const type = one(row.grocery_types);
  const groceryType: GroceryType | null = type
    ? { id: type.uuid, code: type.code, name: type.name, sort_order: type.sort_order }
    : null;
  return {
    id: row.uuid,
    list_id: list.uuid,
    grocery_type_id: groceryType?.id ?? null,
    name: row.name,
    description: row.description,
    amount: row.amount,
    price: row.price,
    checked: row.checked,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    grocery_types: groceryType,
  };
}

@Injectable()
export class SupabaseItemRepository extends ItemRepository {
  constructor(private readonly db: SupabaseClientProvider) {
    super();
  }

  async listActive(listId: string): Promise<ItemRow[]> {
    const embedded = await this.db.client
      .from('items')
      .select(ITEM_SELECT)
      .eq('lists.uuid', listId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (!embedded.error) {
      return ((embedded.data ?? []) as ItemRecord[]).map(toItem);
    }
    if (!missingGrocerySchema(embedded.error.message)) {
      throw new PersistenceError(embedded.error.message);
    }
    const data = rows<ItemRecord>(
      await this.db.client
        .from('items')
        .select(ITEM_SELECT_WITHOUT_TYPE)
        .eq('lists.uuid', listId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
    );
    return data.map(toItem);
  }

  async findById(id: string): Promise<ItemRow | null> {
    const embedded = await this.db.client.from('items').select(ITEM_SELECT).eq('uuid', id).maybeSingle();
    if (!embedded.error) {
      return embedded.data ? toItem(embedded.data as ItemRecord) : null;
    }
    if (!missingGrocerySchema(embedded.error.message)) {
      throw new PersistenceError(embedded.error.message);
    }
    const row = maybe<ItemRecord>(
      await this.db.client.from('items').select(ITEM_SELECT_WITHOUT_TYPE).eq('uuid', id).maybeSingle(),
    );
    return row ? toItem(row) : null;
  }

  insert(input: ItemInsert): Promise<ItemRow> {
    return callAudit<ItemRow>(this.db.client, 'apply_item_insert', {
      p_actor_uuid: input.actorId,
      p_action: input.action,
      p_item_uuid: input.id,
      p_list_uuid: input.listId,
      p_grocery_type_uuid: input.groceryTypeId,
      p_name: input.name,
      p_description: input.description,
      p_amount: input.amount,
      p_price: input.price,
      p_checked: input.checked,
    });
  }

  update(input: ItemUpdate): Promise<ItemRow> {
    return callAudit<ItemRow>(this.db.client, 'apply_item_update', {
      p_actor_uuid: input.actorId,
      p_action: input.action,
      p_item_uuid: input.itemId,
      p_list_uuid: input.listId,
      p_patch: input.patch,
    });
  }

  async softDelete(input: ItemDelete): Promise<void> {
    await callAudit(this.db.client, 'apply_item_soft_delete', {
      p_actor_uuid: input.actorId,
      p_action: input.action,
      p_item_uuid: input.itemId,
      p_list_uuid: input.listId,
    });
  }
}
