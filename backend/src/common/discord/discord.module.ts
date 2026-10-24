import { Global, Module } from '@nestjs/common';
import { DiscordRestService } from './discord-rest.service';
import { DiscordOutboxService } from './discord-outbox.service';

@Global()
@Module({
  providers: [DiscordRestService, DiscordOutboxService],
  exports: [DiscordRestService, DiscordOutboxService],
})
export class DiscordCoreModule {}
