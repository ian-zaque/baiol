import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { hashPassword } from './password';
import { TokenService } from './token.service';
import { UserRepository } from '../persistence/user.repository';
import { SessionRepository } from '../persistence/session.repository';

const profile = {
  id: 'user-1',
  email: 'ada@example.com',
  display_name: 'Ada',
  created_at: '2026-01-01T00:00:00.000Z',
  password_hash: '',
};

describe('AuthService', () => {
  const users = {
    findById: jest.fn(),
    findByIds: jest.fn(),
    findActiveByEmail: jest.fn(),
    insert: jest.fn(),
  };
  const sessions = {
    insert: jest.fn(),
    findActiveByTokenHash: jest.fn(),
    revoke: jest.fn(),
  };
  const tokens = {
    accessTtlSeconds: 900,
    refreshTtlSeconds: 3600,
    sign: jest.fn().mockResolvedValue('access-token'),
  };

  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    tokens.sign.mockResolvedValue('access-token');
    sessions.insert.mockResolvedValue({
      id: 'session-1',
      user_id: profile.id,
      expires_at: '2026-02-01T00:00:00.000Z',
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: users },
        { provide: SessionRepository, useValue: sessions },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('registers a new account and returns a session', async () => {
    users.findActiveByEmail.mockResolvedValue(null);
    users.insert.mockImplementation(async (input: { id: string; email: string; displayName: string }) => ({
      id: input.id,
      email: input.email,
      display_name: input.displayName,
      created_at: profile.created_at,
    }));

    const result = await service.register({
      email: 'Ada@Example.com',
      password: 'secret1',
      displayName: 'Ada',
    });

    expect(users.insert).toHaveBeenCalledTimes(1);
    expect(users.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        displayName: 'Ada',
        userAction: expect.stringMatching(/created the user/),
        profileAction: expect.stringMatching(/created the profile/),
      }),
    );
    const stored = users.insert.mock.calls[0][0] as {
      id: string;
      profileId: string;
      passwordHash: string;
      userAction: string;
      profileAction: string;
    };
    expect(stored.id).not.toBe(stored.profileId);
    expect(stored.userAction).toContain(stored.id);
    expect(stored.profileAction).toContain(stored.profileId);
    expect(stored.passwordHash).not.toContain('secret1');
    expect(result.access_token).toBe('access-token');
    expect(result.refresh_token).toEqual(expect.any(String));
    expect(result.profile.email).toBe('ada@example.com');
    expect(sessions.insert).toHaveBeenCalled();
  });

  it('rejects a duplicate email', async () => {
    users.findActiveByEmail.mockResolvedValue(profile);

    await expect(
      service.register({ email: 'ada@example.com', password: 'secret1', displayName: 'Ada' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(users.insert).not.toHaveBeenCalled();
  });

  it('logs in with a matching password', async () => {
    users.findActiveByEmail.mockResolvedValue({
      ...profile,
      password_hash: await hashPassword('secret1'),
    });

    const result = await service.login({ email: 'ada@example.com', password: 'secret1' });

    expect(result.profile.id).toBe(profile.id);
    expect(sessions.insert).toHaveBeenCalled();
  });

  it('rejects a wrong password', async () => {
    users.findActiveByEmail.mockResolvedValue({
      ...profile,
      password_hash: await hashPassword('secret1'),
    });

    await expect(
      service.login({ email: 'ada@example.com', password: 'nope' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates the refresh token', async () => {
    sessions.findActiveByTokenHash.mockResolvedValue({
      id: 'session-1',
      user_id: profile.id,
      expires_at: '2099-01-01T00:00:00.000Z',
    });
    users.findById.mockResolvedValue(profile);
    sessions.revoke.mockResolvedValue(undefined);

    const result = await service.refresh('old-refresh');

    expect(sessions.revoke).toHaveBeenCalledWith('session-1');
    expect(sessions.insert).toHaveBeenCalled();
    expect(result.refresh_token).not.toBe('old-refresh');
  });

  it('revokes a session on logout', async () => {
    sessions.findActiveByTokenHash.mockResolvedValue({
      id: 'session-1',
      user_id: profile.id,
      expires_at: '2099-01-01T00:00:00.000Z',
    });
    sessions.revoke.mockResolvedValue(undefined);

    await service.logout('refresh-token');

    expect(sessions.revoke).toHaveBeenCalledWith('session-1');
  });
});
