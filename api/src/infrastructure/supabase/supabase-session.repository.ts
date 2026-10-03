import { Injectable } from '@nestjs/common';
import { PersistenceError } from '../../persistence/persistence.error';
import { SessionInsert, SessionRepository, SessionRow } from '../../persistence/session.repository';
import { maybe, one } from './supabase-db';
import { SupabaseClientProvider } from './supabase-client.provider';

type SessionRecord = {
  uuid: string;
  expires_at: string;
  users: { uuid: string } | { uuid: string }[];
};

function toSession(row: SessionRecord): SessionRow {
  const user = one(row.users);
  if (!user) {
    throw new PersistenceError('User not found');
  }
  return {
    id: row.uuid,
    user_id: user.uuid,
    expires_at: row.expires_at,
  };
}

@Injectable()
export class SupabaseSessionRepository extends SessionRepository {
  constructor(private readonly db: SupabaseClientProvider) {
    super();
  }

  async insert(input: SessionInsert): Promise<SessionRow> {
    const user = maybe<{ id: number | string }>(
      await this.db.client
        .from('users')
        .select('id')
        .eq('uuid', input.userId)
        .is('deleted_at', null)
        .maybeSingle(),
    );
    if (!user) {
      throw new PersistenceError('User not found');
    }

    const result = await this.db.client
      .from('sessions')
      .insert({
        user_id: user.id,
        token_hash: input.tokenHash,
        expires_at: input.expiresAt.toISOString(),
      })
      .select('uuid, expires_at, users!user_id(uuid)')
      .single();
    if (result.error || result.data == null) {
      throw new PersistenceError(result.error?.message ?? 'Could not store session');
    }
    return toSession(result.data as SessionRecord);
  }

  async findActiveByTokenHash(tokenHash: string): Promise<SessionRow | null> {
    const row = maybe<SessionRecord>(
      await this.db.client
        .from('sessions')
        .select('uuid, expires_at, users!inner(uuid)')
        .eq('token_hash', tokenHash)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle(),
    );
    return row ? toSession(row) : null;
  }

  async revoke(id: string): Promise<void> {
    const result = await this.db.client
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('uuid', id);
    if (result.error) {
      throw new PersistenceError(result.error.message);
    }
  }
}
