import { Module } from '@nestjs/common';
import { DiscordInteractionsController } from './discord-interactions.controller';
import { DiscordInteractionsService } from './discord-interactions.service';
import { AdminGuardService } from './admin-guard.service';
import { AdminAuditService } from './admin-audit.service';
import { HealthModule } from '../health/health.module';

@Module({
  imports: [HealthModule],
  controllers: [DiscordInteractionsController],
  providers: [
    DiscordInteractionsService,
    AdminGuardService,
    AdminAuditService,
  ],
  exports: [DiscordInteractionsService, AdminGuardService, AdminAuditService],
})
export class DiscordInteractionsModule {}
