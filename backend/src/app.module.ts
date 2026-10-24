import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AdminModule } from './modules/admin/admin.module';
import { MemberModule } from './modules/member/member.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { DiscordCoreModule } from './common/discord/discord.module';
import { DiscordWebhookModule } from './common/webhook/discord-webhook.module';
import { HealthModule } from './modules/health/health.module';
import { DiscordInteractionsModule } from './modules/discord-interactions/discord-interactions.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { BotSyncModule } from './modules/bot-sync/bot-sync.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TicketsModule } from './modules/tickets/tickets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute per IP
      },
    ]),
    PrismaModule,
    DiscordCoreModule,
    DiscordWebhookModule,
    HealthModule,
    DiscordInteractionsModule,
    MonitoringModule,
    BotSyncModule,
    OrdersModule,
    PaymentsModule,
    TicketsModule,
    AdminModule,
    MemberModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
