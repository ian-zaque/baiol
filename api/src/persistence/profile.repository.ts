import { ProfileRow } from '../common/types';

export type ProfileWithSecret = ProfileRow & {
  password_hash: string;
};

export type ProfileInsert = {
  actorId: string;
  action: string;
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
};

export type ProfileDisplayNameUpdate = {
  actorId: string;
  action: string;
  id: string;
  displayName: string;
};

export abstract class ProfileRepository {
  abstract findById(id: string): Promise<ProfileRow | null>;
  abstract findByIds(ids: string[]): Promise<ProfileRow[]>;
  abstract findActiveByEmail(email: string): Promise<ProfileWithSecret | null>;
  abstract insert(input: ProfileInsert): Promise<ProfileRow>;
  abstract updateDisplayName(input: ProfileDisplayNameUpdate): Promise<ProfileRow>;
}
