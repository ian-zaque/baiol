import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { PersistenceModule } from './infrastructure/supabase/persistence.module';
import { ListsModule } from './lists/lists.module';
import { MailModule } from './mail/mail.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    PersistenceModule,
    AuthModule,
    MailModule,
    ListsModule,
    ProfilesModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
