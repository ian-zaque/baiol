import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { AuthUser } from '../common/auth-user';

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        realtime: {
          // Node 20 has no global WebSocket; supabase realtime requires `ws`.
          transport: WebSocket as never,
        },
      },
    );
  }

  async getUserFromToken(token: string): Promise<AuthUser> {
    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user?.id || !data.user.email) {
      throw new UnauthorizedException('Invalid or expired session');
    }
    return { id: data.user.id, email: data.user.email };
  }
}
