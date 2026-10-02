import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { SupabaseAuthGuard } from '../common/supabase-auth.guard';
import {
  CreateItemDto,
  CreateListDto,
  UpdateItemDto,
  UpdateListDto,
} from './dto/list.dto';
import { ListsService } from './lists.service';

@Controller('lists')
@UseGuards(SupabaseAuthGuard)
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.lists.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateListDto) {
    return this.lists.create(user, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lists.getForUser(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateListDto,
  ) {
    return this.lists.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lists.remove(id, user.id);
  }

  @Get(':id/share')
  shareLink(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lists.getShareLink(id, user.id);
  }

  @Post(':id/share/rotate')
  rotateShare(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lists.rotateShareToken(id, user.id);
  }

  @Get(':id/members')
  members(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lists.assertMember(id, user.id).then(() => this.lists.getMembers(id));
  }

  @Post(':id/items')
  createItem(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateItemDto,
  ) {
    return this.lists.createItem(id, user.id, dto);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateItemDto,
  ) {
    return this.lists.updateItem(id, itemId, user.id, dto);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lists.removeItem(id, itemId, user.id);
  }
}
