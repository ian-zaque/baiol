import { SupabaseClient } from '@supabase/supabase-js';
import { PersistenceError } from '../../persistence/persistence.error';

type DbResult<T> = {
  data: T;
  error: { message: string } | null;
};

export function rows<T>(result: DbResult<T[] | null>): T[] {
  if (result.error) {
    throw new PersistenceError(result.error.message);
  }
  return result.data ?? [];
}

export function maybe<T>(result: DbResult<T | null>): T | null {
  if (result.error) {
    throw new PersistenceError(result.error.message);
  }
  return result.data ?? null;
}

export async function callAudit<T>(
  client: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error || data == null) {
    throw new PersistenceError(error?.message ?? 'Could not write audit log');
  }
  return data as T;
}

export function missingGrocerySchema(message: string): boolean {
  return message.includes('grocery_types') || message.includes('grocery_type_id');
}

export function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
