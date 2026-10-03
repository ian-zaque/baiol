import { Injectable } from '@nestjs/common';
import { GroceryType } from '../../common/types';
import { GroceryTypeRepository } from '../../persistence/grocery-type.repository';
import { PersistenceError } from '../../persistence/persistence.error';
import { missingGrocerySchema } from './supabase-db';
import { SupabaseClientProvider } from './supabase-client.provider';

type GroceryRecord = {
  uuid: string;
  code: string;
  name: string;
  sort_order: number;
};

function toGroceryType(row: GroceryRecord): GroceryType {
  return {
    id: row.uuid,
    code: row.code,
    name: row.name,
    sort_order: row.sort_order,
  };
}

@Injectable()
export class SupabaseGroceryTypeRepository extends GroceryTypeRepository {
  constructor(private readonly db: SupabaseClientProvider) {
    super();
  }

  async listActive(): Promise<GroceryType[]> {
    const result = await this.db.client
      .from('grocery_types')
      .select('uuid, code, name, sort_order')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    if (result.error) {
      if (missingGrocerySchema(result.error.message)) {
        return [];
      }
      throw new PersistenceError(result.error.message);
    }
    return ((result.data ?? []) as GroceryRecord[]).map(toGroceryType);
  }

  async existsActive(id: string): Promise<boolean> {
    const result = await this.db.client
      .from('grocery_types')
      .select('uuid')
      .eq('uuid', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (result.error) {
      throw new PersistenceError(result.error.message);
    }
    return result.data != null;
  }
}
