import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService, HealthCheckResult } from './health.service';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getLiveness(): { status: string; timestamp: string; uptime: number } {
    return this.healthService.getLiveness();
  }

  @Get('deep')
  async getDeepHealth(): Promise<HealthCheckResult> {
    return await this.healthService.getDeepHealth();
  }
}
