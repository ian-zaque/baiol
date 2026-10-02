import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  CreateItemDto,
  UpdateItemDto,
  UpdateListDto,
} from './dto/list.dto';
import { ListsService } from './lists.service';

@Controller('shared')
export class SharedController {
  constructor(
    private readonly lists: ListsService,
    private readonly config: ConfigService,
  ) {}

  @Get(':token')
  async get(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const list = await this.lists.getByShareToken(token);
    const accept = req.headers.accept ?? '';
    if (accept.includes('text/html')) {
      const scheme = this.config.get<string>('APP_SCHEME') ?? 'baiol';
      const webAppUrl = (
        this.config.get<string>('WEB_APP_URL') ?? 'http://localhost:8081'
      ).replace(/\/$/, '');
      const webJoin = `${webAppUrl}/join/${encodeURIComponent(token)}`;
      const appLink = `${scheme}://join/${encodeURIComponent(token)}`;
      res.type('html').send(`<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(list.name)}</title>
    <style>
      body { font-family: sans-serif; background: #f8f4ec; color: #1b4332; padding: 32px; }
      .card { max-width: 420px; margin: 0 auto; background: white; padding: 24px; border-radius: 16px; }
      a.button { display: inline-block; margin-top: 16px; background: #2d6a4f; color: white; text-decoration: none; padding: 12px 18px; border-radius: 10px; }
      p.alt { margin-top: 16px; }
      a.alt { color: #2d6a4f; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${escapeHtml(list.name)}</h1>
      <p>Open this grocery list in Baiol. You do not need an account.</p>
      <a class="button" href="${escapeHtml(webJoin)}">Open list</a>
      <p class="alt" id="app-link"><a class="alt" href="${escapeHtml(appLink)}">Open in the Baiol app</a></p>
    </div>
    <script>
      if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        var node = document.getElementById('app-link');
        if (node) node.remove();
      }
    </script>
  </body>
</html>`);
      return;
    }
    res.json(list);
  }

  @Patch(':token')
  update(@Param('token') token: string, @Body() dto: UpdateListDto) {
    return this.lists.updateByShareToken(token, dto);
  }

  @Post(':token/items')
  createItem(@Param('token') token: string, @Body() dto: CreateItemDto) {
    return this.lists.createItemByShareToken(token, dto);
  }

  @Patch(':token/items/:itemId')
  updateItem(
    @Param('token') token: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.lists.updateItemByShareToken(token, itemId, dto);
  }

  @Delete(':token/items/:itemId')
  removeItem(@Param('token') token: string, @Param('itemId') itemId: string) {
    return this.lists.removeItemByShareToken(token, itemId);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
