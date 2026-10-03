import { ItemRow } from '../common/types';

export type ItemInsert = {
  actorId: string | null;
  action: string;
  id: string;
  listId: string;
  groceryTypeId: string | null;
  name: string;
  description: string;
  amount: string;
  price: number;
  checked: boolean;
};

export type ItemUpdate = {
  actorId: string | null;
  action: string;
  itemId: string;
  listId: string;
  patch: Record<string, string | number | boolean | null>;
};

export type ItemDelete = {
  actorId: string | null;
  action: string;
  itemId: string;
  listId: string;
};

export abstract class ItemRepository {
  abstract listActive(listId: string): Promise<ItemRow[]>;
  abstract findById(id: string): Promise<ItemRow | null>;
  abstract insert(input: ItemInsert): Promise<ItemRow>;
  abstract update(input: ItemUpdate): Promise<ItemRow>;
  abstract softDelete(input: ItemDelete): Promise<void>;
}
