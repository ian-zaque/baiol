import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthController } from './health.controller';
import { ListsModule } from './lists/lists.module';
import { MailModule } from './mail/mail.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    SupabaseModule,
    MailModule,
    ListsModule,
    ProfilesModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
