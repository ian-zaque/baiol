import { Injectable } from '@nestjs/common';
import { ProfileRow } from '../../common/types';
import {
  ProfileDisplayNameUpdate,
  ProfileInsert,
  ProfileRepository,
  ProfileWithSecret,
} from '../../persistence/profile.repository';
import { callAudit, maybe, rows } from './supabase-db';
import { SupabaseClientProvider } from './supabase-client.provider';

const PROFILE_COLUMNS = 'id, email, display_name, created_at';

@Injectable()
export class SupabaseProfileRepository extends ProfileRepository {
  constructor(private readonly db: SupabaseClientProvider) {
    super();
  }

  async findById(id: string): Promise<ProfileRow | null> {
    return maybe(
      await this.db.client
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle(),
    );
  }

  async findByIds(ids: string[]): Promise<ProfileRow[]> {
    if (ids.length === 0) {
      return [];
    }
    return rows(
      await this.db.client
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .in('id', ids)
        .is('deleted_at', null),
    );
  }

  async findActiveByEmail(email: string): Promise<ProfileWithSecret | null> {
    return maybe(
      await this.db.client
        .from('profiles')
        .select(`${PROFILE_COLUMNS}, password_hash`)
        .eq('email', email)
        .is('deleted_at', null)
        .maybeSingle(),
    );
  }

  insert(input: ProfileInsert): Promise<ProfileRow> {
    return callAudit<ProfileRow>(this.db.client, 'apply_profile_insert', {
      p_actor_id: input.actorId,
      p_action: input.action,
      p_id: input.id,
      p_email: input.email,
      p_display_name: input.displayName,
      p_password_hash: input.passwordHash,
    });
  }

  updateDisplayName(input: ProfileDisplayNameUpdate): Promise<ProfileRow> {
    return callAudit<ProfileRow>(this.db.client, 'apply_profile_update', {
      p_actor_id: input.actorId,
      p_action: input.action,
      p_id: input.id,
      p_patch: { display_name: input.displayName },
    });
  }
}
