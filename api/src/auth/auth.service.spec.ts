import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { hashPassword } from './password';
import { TokenService } from './token.service';
import { ProfileRepository } from '../persistence/profile.repository';
import { SessionRepository } from '../persistence/session.repository';

const profile = {
  id: 'user-1',
  email: 'ada@example.com',
  display_name: 'Ada',
  created_at: '2026-01-01T00:00:00.000Z',
  password_hash: '',
};

describe('AuthService', () => {
  const profiles = {
    findById: jest.fn(),
    findByIds: jest.fn(),
    findActiveByEmail: jest.fn(),
    insert: jest.fn(),
    updateDisplayName: jest.fn(),
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
      profile_id: profile.id,
      expires_at: '2026-02-01T00:00:00.000Z',
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: ProfileRepository, useValue: profiles },
        { provide: SessionRepository, useValue: sessions },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('registers a new account and returns a session', async () => {
    profiles.findActiveByEmail.mockResolvedValue(null);
    profiles.insert.mockImplementation(async (input: { id: string; email: string; displayName: string }) => ({
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

    expect(profiles.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        displayName: 'Ada',
      }),
    );
    const stored = profiles.insert.mock.calls[0][0] as { passwordHash: string };
    expect(stored.passwordHash).not.toContain('secret1');
    expect(result.access_token).toBe('access-token');
    expect(result.refresh_token).toEqual(expect.any(String));
    expect(result.profile.email).toBe('ada@example.com');
    expect(sessions.insert).toHaveBeenCalled();
  });

  it('rejects a duplicate email', async () => {
    profiles.findActiveByEmail.mockResolvedValue(profile);

    await expect(
      service.register({ email: 'ada@example.com', password: 'secret1', displayName: 'Ada' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(profiles.insert).not.toHaveBeenCalled();
  });

  it('logs in with a matching password', async () => {
    profiles.findActiveByEmail.mockResolvedValue({
      ...profile,
      password_hash: await hashPassword('secret1'),
    });

    const result = await service.login({ email: 'ada@example.com', password: 'secret1' });

    expect(result.profile.id).toBe(profile.id);
    expect(sessions.insert).toHaveBeenCalled();
  });

  it('rejects a wrong password', async () => {
    profiles.findActiveByEmail.mockResolvedValue({
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
      profile_id: profile.id,
      expires_at: '2099-01-01T00:00:00.000Z',
    });
    profiles.findById.mockResolvedValue(profile);
    sessions.revoke.mockResolvedValue(undefined);

    const result = await service.refresh('old-refresh');

    expect(sessions.revoke).toHaveBeenCalledWith('session-1');
    expect(sessions.insert).toHaveBeenCalled();
    expect(result.refresh_token).not.toBe('old-refresh');
  });

  it('revokes a session on logout', async () => {
    sessions.findActiveByTokenHash.mockResolvedValue({
      id: 'session-1',
      profile_id: profile.id,
      expires_at: '2099-01-01T00:00:00.000Z',
    });
    sessions.revoke.mockResolvedValue(undefined);

    await service.logout('refresh-token');

    expect(sessions.revoke).toHaveBeenCalledWith('session-1');
  });
});
