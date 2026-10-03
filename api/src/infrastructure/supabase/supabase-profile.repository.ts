import { Injectable } from '@nestjs/common';
import { UserRow } from '../../common/types';
import { ProfileDisplayNameUpdate, ProfileRepository } from '../../persistence/profile.repository';
import { callAudit } from './supabase-db';
import { SupabaseClientProvider } from './supabase-client.provider';

@Injectable()
export class SupabaseProfileRepository extends ProfileRepository {
  constructor(private readonly db: SupabaseClientProvider) {
    super();
  }

  updateDisplayName(input: ProfileDisplayNameUpdate): Promise<UserRow> {
    return callAudit<UserRow>(this.db.client, 'apply_profile_update', {
      p_actor_uuid: input.actorId,
      p_action: input.action,
      p_user_uuid: input.id,
      p_display_name: input.displayName,
    });
  }
}
