import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { auditUpdate } from '../common/audit';
import { AuthUser } from '../common/auth-user';
import { ProfileRow, displayNameOf } from '../common/types';
import { ListsService } from '../lists/lists.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly lists: ListsService,
  ) {}

  async sync(user: AuthUser) {
    const profile = await this.lists.ensureProfile(user);
    return {
      profile: this.toPublic(profile),
    };
  }

  async get(user: AuthUser) {
    const profile = await this.lists.ensureProfile(user);
    return this.toPublic(profile);
  }

  async update(user: AuthUser, dto: UpdateProfileDto) {
    const current = await this.lists.ensureProfile(user);
    const displayName = dto.display_name?.trim() || user.email.split('@')[0];
    if ((current.display_name ?? '') === displayName) {
      return this.toPublic(current);
    }

    const actor = { id: user.id, name: displayNameOf(current) };
    const { data, error } = await this.supabase.client.rpc('apply_profile_update', {
      p_actor_id: actor.id,
      p_action: auditUpdate(actor, 'profile', user.id, [
        { field: 'display_name', from: current.display_name, to: displayName },
      ]),
      p_id: user.id,
      p_patch: { display_name: displayName },
    });

    if (error || data == null) {
      const message = error?.message ?? 'Could not update profile';
      if (message.toLowerCase().includes('not found')) {
        throw new NotFoundException(message);
      }
      throw new InternalServerErrorException(message);
    }
    return this.toPublic(data as ProfileRow);
  }

  private toPublic(profile: ProfileRow) {
    return {
      id: profile.id,
      email: profile.email,
      display_name: displayNameOf(profile),
      created_at: profile.created_at,
    };
  }
}
