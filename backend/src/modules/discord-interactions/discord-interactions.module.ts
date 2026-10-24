import { Module } from '@nestjs/common';
import { DiscordInteractionsController } from './discord-interactions.controller';
import { DiscordInteractionsService } from './discord-interactions.service';
import { HealthModule } from '../health/health.module';

@Module({
  imports: [HealthModule],
  controllers: [DiscordInteractionsController],
  providers: [DiscordInteractionsService],
  exports: [DiscordInteractionsService],
})
export class DiscordInteractionsModule {}
