import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminModule } from "./modules/admin/admin.module";
import { MemberModule } from "./modules/member/member.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import { DiscordWebhookModule } from "./common/webhook/discord-webhook.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    DiscordWebhookModule,
    AdminModule,
    MemberModule,
  ],
})
export class AppModule {}
