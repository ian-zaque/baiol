export type SessionRow = {
  id: string;
  profile_id: string;
  expires_at: string;
};

export type SessionInsert = {
  profileId: string;
  tokenHash: string;
  expiresAt: Date;
};

export abstract class SessionRepository {
  abstract insert(input: SessionInsert): Promise<SessionRow>;
  abstract findActiveByTokenHash(tokenHash: string): Promise<SessionRow | null>;
  abstract revoke(id: string): Promise<void>;
}
