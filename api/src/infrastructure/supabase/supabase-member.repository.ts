import { Injectable } from '@nestjs/common';
import { MemberRole, MemberRow } from '../../common/types';
import { MemberRepository } from '../../persistence/member.repository';
import { PersistenceError } from '../../persistence/persistence.error';
import { maybe, one, rows } from './supabase-db';
import { SupabaseClientProvider } from './supabase-client.provider';

const MEMBER_COLUMNS = 'role, created_at, lists!inner(uuid), users!inner(uuid)';

type MemberRecord = {
  role: MemberRole;
  created_at: string;
  lists: { uuid: string } | { uuid: string }[];
  users: { uuid: string } | { uuid: string }[];
};

function toMember(row: MemberRecord): MemberRow {
  const list = one(row.lists);
  const user = one(row.users);
  if (!list || !user) {
    throw new PersistenceError('List not found');
  }
  return {
    list_id: list.uuid,
    user_id: user.uuid,
    role: row.role,
    created_at: row.created_at,
  };
}

@Injectable()
export class SupabaseMemberRepository extends MemberRepository {
  constructor(private readonly db: SupabaseClientProvider) {
    super();
  }

  async listActive(listId: string): Promise<MemberRow[]> {
    const data = rows<MemberRecord>(
      await this.db.client
        .from('list_members')
        .select(MEMBER_COLUMNS)
        .eq('lists.uuid', listId)
        .is('deleted_at', null),
    );
    return data.map(toMember);
  }

  async findActive(listId: string, userId: string): Promise<MemberRow | null> {
    const row = maybe<MemberRecord>(
      await this.db.client
        .from('list_members')
        .select(MEMBER_COLUMNS)
        .eq('lists.uuid', listId)
        .eq('users.uuid', userId)
        .is('deleted_at', null)
        .maybeSingle(),
    );
    return row ? toMember(row) : null;
  }
}
