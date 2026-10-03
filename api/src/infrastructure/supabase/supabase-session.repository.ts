import { Injectable } from '@nestjs/common';
import { PersistenceError } from '../../persistence/persistence.error';
import { SessionInsert, SessionRepository, SessionRow } from '../../persistence/session.repository';
import { maybe } from './supabase-db';
import { SupabaseClientProvider } from './supabase-client.provider';

@Injectable()
export class SupabaseSessionRepository extends SessionRepository {
  constructor(private readonly db: SupabaseClientProvider) {
    super();
  }

  async insert(input: SessionInsert): Promise<SessionRow> {
    const result = await this.db.client
      .from('sessions')
      .insert({
        profile_id: input.profileId,
        token_hash: input.tokenHash,
        expires_at: input.expiresAt.toISOString(),
      })
      .select('id, profile_id, expires_at')
      .single();
    if (result.error || result.data == null) {
      throw new PersistenceError(result.error?.message ?? 'Could not store session');
    }
    return result.data as SessionRow;
  }

  async findActiveByTokenHash(tokenHash: string): Promise<SessionRow | null> {
    return maybe(
      await this.db.client
        .from('sessions')
        .select('id, profile_id, expires_at')
        .eq('token_hash', tokenHash)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle(),
    );
  }

  async revoke(id: string): Promise<void> {
    const result = await this.db.client
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id);
    if (result.error) {
      throw new PersistenceError(result.error.message);
    }
  }
}
