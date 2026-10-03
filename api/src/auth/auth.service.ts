import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { auditCreate } from '../common/audit';
import { fromPersistence } from '../common/map-persistence-error';
import { UserRow, displayNameOf } from '../common/types';
import { PersistenceError } from '../persistence/persistence.error';
import { SessionRepository } from '../persistence/session.repository';
import { UserRepository } from '../persistence/user.repository';
import { hashPassword, verifyPassword } from './password';
import { TokenService } from './token.service';

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  profile: {
    id: string;
    email: string;
    display_name: string;
    created_at: string;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenService,
  ) {}

  async register(input: { email: string; password: string; displayName: string }): Promise<AuthResponse> {
    const email = normalizeEmail(input.email);
    const password = input.password;
    if (password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }
    const displayName = input.displayName.trim() || email.split('@')[0];
    const existing = await fromPersistence(this.users.findActiveByEmail(email));
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const id = randomUUID();
    const profileId = randomUUID();
    const actor = { id, name: displayName };
    let account: UserRow;
    try {
      account = await this.users.insert({
        actorId: id,
        userAction: auditCreate(actor, 'user', id),
        profileAction: auditCreate(actor, 'profile', profileId),
        id,
        profileId,
        email,
        displayName,
        passwordHash: await hashPassword(password),
      });
    } catch (error) {
      if (error instanceof PersistenceError && /duplicate|unique/i.test(error.message)) {
        throw new ConflictException('An account with this email already exists');
      }
      await fromPersistence(Promise.reject(error));
      throw error;
    }

    return this.issue(account);
  }

  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const email = normalizeEmail(input.email);
    const account = await fromPersistence(this.users.findActiveByEmail(email));
    if (!account || !(await verifyPassword(input.password, account.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issue(account);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const session = await fromPersistence(
      this.sessions.findActiveByTokenHash(hashToken(refreshToken)),
    );
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }
    const account = await fromPersistence(this.users.findById(session.user_id));
    if (!account) {
      throw new UnauthorizedException('Invalid or expired session');
    }
    await fromPersistence(this.sessions.revoke(session.id));
    return this.issue(account);
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await fromPersistence(
      this.sessions.findActiveByTokenHash(hashToken(refreshToken)),
    );
    if (session) {
      await fromPersistence(this.sessions.revoke(session.id));
    }
  }

  private async issue(account: UserRow): Promise<AuthResponse> {
    const refreshToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.tokens.refreshTtlSeconds * 1000);
    await fromPersistence(
      this.sessions.insert({
        userId: account.id,
        tokenHash: hashToken(refreshToken),
        expiresAt,
      }),
    );
    return {
      access_token: await this.tokens.sign({ id: account.id, email: account.email }),
      refresh_token: refreshToken,
      expires_in: this.tokens.accessTtlSeconds,
      profile: {
        id: account.id,
        email: account.email,
        display_name: displayNameOf(account),
        created_at: account.created_at,
      },
    };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
