import { Module } from "@nestjs/common";
import { MemberOrdersController } from "./controllers/member-orders.controller";
import { MemberProfileController } from "./controllers/member-profile.controller";

@Module({
  controllers: [
    MemberProfileController,
    MemberOrdersController,
  ],
  providers: [],
  exports: [],
})
export class MemberModule {}
