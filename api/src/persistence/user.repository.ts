import { UserRow } from '../common/types';

export type UserWithSecret = UserRow & {
  password_hash: string;
};

export type UserInsert = {
  actorId: string;
  userAction: string;
  profileAction: string;
  id: string;
  profileId: string;
  email: string;
  displayName: string;
  passwordHash: string;
};

export abstract class UserRepository {
  abstract findById(id: string): Promise<UserRow | null>;
  abstract findByIds(ids: string[]): Promise<UserRow[]>;
  abstract findActiveByEmail(email: string): Promise<UserWithSecret | null>;
  abstract insert(input: UserInsert): Promise<UserRow>;
}
