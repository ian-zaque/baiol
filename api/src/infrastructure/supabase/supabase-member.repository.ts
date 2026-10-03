import { Injectable } from '@nestjs/common';
import { MemberRow } from '../../common/types';
import { MemberRepository } from '../../persistence/member.repository';
import { maybe, rows } from './supabase-db';
import { SupabaseClientProvider } from './supabase-client.provider';

@Injectable()
export class SupabaseMemberRepository extends MemberRepository {
  constructor(private readonly db: SupabaseClientProvider) {
    super();
  }

  async listActive(listId: string): Promise<MemberRow[]> {
    return rows(
      await this.db.client
        .from('list_members')
        .select('*')
        .eq('list_id', listId)
        .is('deleted_at', null),
    );
  }

  async findActive(listId: string, userId: string): Promise<MemberRow | null> {
    return maybe(
      await this.db.client
        .from('list_members')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .maybeSingle(),
    );
  }
}
