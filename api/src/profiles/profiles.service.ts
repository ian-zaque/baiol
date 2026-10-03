import { Injectable } from '@nestjs/common';
import { auditUpdate } from '../common/audit';
import { AuthUser } from '../common/auth-user';
import { fromPersistence } from '../common/map-persistence-error';
import { ProfileRow, displayNameOf } from '../common/types';
import { ListsService } from '../lists/lists.service';
import { ProfileRepository } from '../persistence/profile.repository';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly profiles: ProfileRepository,
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
    const updated = await fromPersistence(
      this.profiles.updateDisplayName({
        actorId: actor.id,
        action: auditUpdate(actor, 'profile', user.id, [
          { field: 'display_name', from: current.display_name, to: displayName },
        ]),
        id: user.id,
        displayName,
      }),
    );
    return this.toPublic(updated);
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
