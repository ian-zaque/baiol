import { Injectable, NotFoundException } from '@nestjs/common';
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
    await this.lists.ensureProfile(user);
    const { data, error } = await this.supabase.client
      .from('profiles')
      .update({
        display_name: dto.display_name?.trim() || user.email.split('@')[0],
      })
      .eq('id', user.id)
      .select('*')
      .single();

    if (error || !data) {
      throw new NotFoundException('Profile not found');
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
