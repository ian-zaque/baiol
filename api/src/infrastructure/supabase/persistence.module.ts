import { Global, Module } from '@nestjs/common';
import { GroceryTypeRepository } from '../../persistence/grocery-type.repository';
import { ItemRepository } from '../../persistence/item.repository';
import { ListRepository } from '../../persistence/list.repository';
import { MemberRepository } from '../../persistence/member.repository';
import { ProfileRepository } from '../../persistence/profile.repository';
import { SessionRepository } from '../../persistence/session.repository';
import { SupabaseClientProvider } from './supabase-client.provider';
import { SupabaseGroceryTypeRepository } from './supabase-grocery-type.repository';
import { SupabaseItemRepository } from './supabase-item.repository';
import { SupabaseListRepository } from './supabase-list.repository';
import { SupabaseMemberRepository } from './supabase-member.repository';
import { SupabaseProfileRepository } from './supabase-profile.repository';
import { SupabaseSessionRepository } from './supabase-session.repository';

@Global()
@Module({
  providers: [
    SupabaseClientProvider,
    { provide: ProfileRepository, useClass: SupabaseProfileRepository },
    { provide: SessionRepository, useClass: SupabaseSessionRepository },
    { provide: ListRepository, useClass: SupabaseListRepository },
    { provide: ItemRepository, useClass: SupabaseItemRepository },
    { provide: MemberRepository, useClass: SupabaseMemberRepository },
    { provide: GroceryTypeRepository, useClass: SupabaseGroceryTypeRepository },
  ],
  exports: [
    ProfileRepository,
    SessionRepository,
    ListRepository,
    ItemRepository,
    MemberRepository,
    GroceryTypeRepository,
  ],
})
export class PersistenceModule {}
