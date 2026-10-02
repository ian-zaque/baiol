import { Module } from '@nestjs/common';
import { InvitesModule } from '../invites/invites.module';
import { ListsModule } from '../lists/lists.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [ListsModule, InvitesModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}
