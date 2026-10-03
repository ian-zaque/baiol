import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ListsModule } from '../lists/lists.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [AuthModule, ListsModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
