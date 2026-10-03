import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  root() {
    return { ok: true, service: 'baiol-api' };
  }

  @Get('health')
  check() {
    return { ok: true };
  }
}
