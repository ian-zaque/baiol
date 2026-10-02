import { Module } from '@nestjs/common';
import { ListsModule } from '../lists/lists.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [ListsModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
