import { UserRow } from '../common/types';

export type ProfileDisplayNameUpdate = {
  actorId: string;
  action: string;
  id: string;
  displayName: string;
};

export abstract class ProfileRepository {
  abstract updateDisplayName(input: ProfileDisplayNameUpdate): Promise<UserRow>;
}
