import { Injectable } from '@nestjs/common';
import { UserRow } from '../../common/types';
import { UserInsert, UserRepository, UserWithSecret } from '../../persistence/user.repository';
import { callAudit, maybe, one, rows } from './supabase-db';
import { SupabaseClientProvider } from './supabase-client.provider';

const ACCOUNT_COLUMNS = 'uuid, email, created_at, profiles!inner(display_name)';

type AccountRecord = {
  uuid: string;
  email: string;
  created_at: string;
  password_hash?: string;
  profiles: { display_name: string | null } | { display_name: string | null }[];
};

function toUser(row: AccountRecord): UserRow {
  return {
    id: row.uuid,
    email: row.email,
    display_name: one(row.profiles)?.display_name ?? null,
    created_at: row.created_at,
  };
}

@Injectable()
export class SupabaseUserRepository extends UserRepository {
  constructor(private readonly db: SupabaseClientProvider) {
    super();
  }

  async findById(id: string): Promise<UserRow | null> {
    const row = maybe<AccountRecord>(
      await this.db.client
        .from('users')
        .select(ACCOUNT_COLUMNS)
        .eq('uuid', id)
        .is('deleted_at', null)
        .maybeSingle(),
    );
    return row ? toUser(row) : null;
  }

  async findByIds(ids: string[]): Promise<UserRow[]> {
    if (ids.length === 0) {
      return [];
    }
    const data = rows<AccountRecord>(
      await this.db.client
        .from('users')
        .select(ACCOUNT_COLUMNS)
        .in('uuid', ids)
        .is('deleted_at', null),
    );
    return data.map(toUser);
  }

  async findActiveByEmail(email: string): Promise<UserWithSecret | null> {
    const row = maybe<AccountRecord>(
      await this.db.client
        .from('users')
        .select(`${ACCOUNT_COLUMNS}, password_hash`)
        .eq('email', email)
        .is('deleted_at', null)
        .maybeSingle(),
    );
    if (!row || row.password_hash == null) {
      return null;
    }
    return { ...toUser(row), password_hash: row.password_hash };
  }

  insert(input: UserInsert): Promise<UserRow> {
    return callAudit<UserRow>(this.db.client, 'apply_user_insert', {
      p_actor_uuid: input.actorId,
      p_user_action: input.userAction,
      p_profile_action: input.profileAction,
      p_user_uuid: input.id,
      p_profile_uuid: input.profileId,
      p_email: input.email,
      p_display_name: input.displayName,
      p_password_hash: input.passwordHash,
    });
  }
}
