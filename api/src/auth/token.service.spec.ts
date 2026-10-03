import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';

describe('TokenService', () => {
  const config = {
    getOrThrow: (key: string) => {
      if (key === 'AUTH_JWT_SECRET') return 'test-secret-that-is-long-enough';
      if (key === 'AUTH_ACCESS_TTL_SECONDS') return '900';
      if (key === 'AUTH_REFRESH_TTL_SECONDS') return '3600';
      throw new Error(key);
    },
  } as ConfigService;

  const tokens = new TokenService(config);

  it('signs a token that verifies to the same user', async () => {
    const token = await tokens.sign({ id: 'user-1', email: 'ada@example.com' });
    await expect(tokens.verify(token)).resolves.toEqual({
      id: 'user-1',
      email: 'ada@example.com',
    });
  });

  it('rejects a token signed with another secret', async () => {
    const other = new TokenService({
      getOrThrow: (key: string) => {
        if (key === 'AUTH_JWT_SECRET') return 'a-different-secret-value-here';
        if (key === 'AUTH_ACCESS_TTL_SECONDS') return '900';
        return '3600';
      },
    } as ConfigService);
    const token = await other.sign({ id: 'user-1', email: 'ada@example.com' });
    await expect(tokens.verify(token)).rejects.toThrow('Invalid or expired session');
  });
});
