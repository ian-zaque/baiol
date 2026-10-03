import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify } from 'jose';
import { AuthUser } from '../common/auth-user';

function readTtl(config: ConfigService, name: string): number {
  const value = Number(config.getOrThrow<string>(name));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number of seconds`);
  }
  return value;
}

@Injectable()
export class TokenService {
  private readonly secret: Uint8Array;
  readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;

  constructor(config: ConfigService) {
    const raw = config.getOrThrow<string>('AUTH_JWT_SECRET').trim();
    if (!raw) {
      throw new Error('AUTH_JWT_SECRET is required');
    }
    this.secret = new TextEncoder().encode(raw);
    this.accessTtlSeconds = readTtl(config, 'AUTH_ACCESS_TTL_SECONDS');
    this.refreshTtlSeconds = readTtl(config, 'AUTH_REFRESH_TTL_SECONDS');
  }

  sign(user: AuthUser): Promise<string> {
    return new SignJWT({ email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${this.accessTtlSeconds}s`)
      .sign(this.secret);
  }

  async verify(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, this.secret);
      if (!payload.sub || typeof payload.email !== 'string' || !payload.email) {
        throw new UnauthorizedException('Invalid or expired session');
      }
      return { id: payload.sub, email: payload.email };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
