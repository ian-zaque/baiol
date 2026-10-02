import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { SupabaseAuthGuard } from '../common/supabase-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from './profiles.service';

@Controller('me')
@UseGuards(SupabaseAuthGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Post('sync')
  sync(@CurrentUser() user: AuthUser) {
    return this.profiles.sync(user);
  }

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.profiles.get(user);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.profiles.update(user, dto);
  }
}
