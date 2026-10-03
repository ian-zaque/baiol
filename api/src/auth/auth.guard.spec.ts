import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { TokenService } from './token.service';

describe('AuthGuard', () => {
  const verify = jest.fn();
  const guard = new AuthGuard({ verify } as unknown as TokenService);

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
    verify.mockReset();
  });

  it('rejects a request with no bearer token', async () => {
    const { context: ctx } = context();
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects an invalid access token', async () => {
    verify.mockRejectedValue(new UnauthorizedException('Invalid or expired session'));
    const { context: ctx } = context('Bearer bad');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verify).toHaveBeenCalledWith('bad');
  });

  it('attaches the user from a valid access token', async () => {
    verify.mockResolvedValue({ id: 'user-1', email: 'ada@example.com' });
    const { request, context: ctx } = context('Bearer access-token');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith('access-token');
    expect(request.user).toEqual({ id: 'user-1', email: 'ada@example.com' });
  });
});
