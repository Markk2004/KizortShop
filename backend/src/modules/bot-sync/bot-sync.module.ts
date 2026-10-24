import { Module } from '@nestjs/common';
import { BotSyncController } from './bot-sync.controller';

@Module({
  controllers: [BotSyncController],
})
export class BotSyncModule {}
