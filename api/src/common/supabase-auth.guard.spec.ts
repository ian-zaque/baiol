import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';

describe('SupabaseAuthGuard', () => {
  const getUserFromToken = jest.fn();
  const guard = new SupabaseAuthGuard({ getUserFromToken } as never);

  function context(authorization?: string) {
    const request: { headers: { authorization?: string }; user?: { id: string; email: string } } = {
      headers: { authorization },
    };
    return {
      request,
      context: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as ExecutionContext,
    };
  }

  beforeEach(() => {
    getUserFromToken.mockReset();
  });

  it('rejects a request with no bearer token', async () => {
    const { context: ctx } = context();
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getUserFromToken).not.toHaveBeenCalled();
  });

  it('attaches the Supabase user from a valid access token', async () => {
    getUserFromToken.mockResolvedValue({ id: 'user-1', email: 'ada@example.com' });
    const { request, context: ctx } = context('Bearer access-token');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(getUserFromToken).toHaveBeenCalledWith('access-token');
    expect(request.user).toEqual({ id: 'user-1', email: 'ada@example.com' });
  });
});
