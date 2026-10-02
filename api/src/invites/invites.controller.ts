import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/current-user.decorator';
import { SupabaseAuthGuard } from '../common/supabase-auth.guard';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InvitesService } from './invites.service';

@Controller()
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Post('lists/:id/invites')
  @UseGuards(SupabaseAuthGuard)
  create(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateInviteDto,
  ) {
    return this.invites.create(id, user, dto);
  }

  @Get('lists/:id/invites')
  @UseGuards(SupabaseAuthGuard)
  list(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.invites.list(id, user.id);
  }

  @Delete('lists/:id/invites/:inviteId')
  @UseGuards(SupabaseAuthGuard)
  revoke(
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invites.revoke(id, inviteId, user.id);
  }

  @Post('invites/:token/accept')
  @UseGuards(SupabaseAuthGuard)
  accept(@Param('token') token: string, @CurrentUser() user: AuthUser) {
    return this.invites.acceptByToken(token, user);
  }

  @Get('invites/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async preview(@Param('token') token: string, @Res() res: Response) {
    const preview = await this.invites.getInvitePreview(token);
    const appLink = `baiol://invite/${token}`;
    const statusLabel =
      preview.status === 'pending'
        ? 'Open Baiol to access this list'
        : `This invite is ${preview.status}`;
    res.send(`<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Baiol invite</title>
    <style>
      body { font-family: sans-serif; background: #f8f4ec; color: #1b4332; padding: 32px; }
      .card { max-width: 420px; margin: 0 auto; background: white; padding: 24px; border-radius: 16px; }
      a.button { display: inline-block; margin-top: 16px; background: #2d6a4f; color: white; text-decoration: none; padding: 12px 18px; border-radius: 10px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${escapeHtml(preview.list_name)}</h1>
      <p>${escapeHtml(statusLabel)}.</p>
      <p>If you already have Baiol, this list will appear after you open the app and sign in with ${escapeHtml(preview.email)}.</p>
      <a class="button" href="${appLink}">Open Baiol</a>
    </div>
  </body>
</html>`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
