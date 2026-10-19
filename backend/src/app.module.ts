import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminModule } from "./modules/admin/admin.module";
import { MemberModule } from "./modules/member/member.module";
import { PrismaModule } from "./common/prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AdminModule,
    MemberModule,
  ],
})
export class AppModule {}
