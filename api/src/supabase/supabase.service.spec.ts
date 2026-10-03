import { UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

describe('SupabaseService.getUserFromToken', () => {
  function service(result: { data: { user: { id?: string; email?: string } | null }; error: { message: string } | null }) {
    const instance = Object.create(SupabaseService.prototype) as SupabaseService;
    instance.client = {
      auth: { getUser: jest.fn().mockResolvedValue(result) },
    } as never;
    return instance;
  }

  it('returns the account id and email for a valid session', async () => {
    const instance = service({
      data: { user: { id: 'user-1', email: 'ada@example.com' } },
      error: null,
    });

    await expect(instance.getUserFromToken('access-token')).resolves.toEqual({
      id: 'user-1',
      email: 'ada@example.com',
    });
  });

  it('rejects an expired or incomplete session', async () => {
    const instance = service({ data: { user: null }, error: { message: 'expired' } });
    await expect(instance.getUserFromToken('bad')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
