import { Body, Controller, Get, Patch, Req } from "@nestjs/common";
import { UpdateMemberProfileDto } from "../dto/member-profile.dto";

@Controller("member/profile")
export class MemberProfileController {
  @Get()
  async getMyProfile() {
    return {
      id: "usr_9918",
      username: "Sal***",
      email: "sal***@kaitanstudio.com",
      balance: 250,
      role: "MEMBER",
      memberTier: "VIP",
      totalOrders: 14,
      totalSpent: 4890,
    };
  }

  @Patch()
  async updateMyProfile(@Body() dto: UpdateMemberProfileDto) {
    return {
      message: "Profile updated successfully",
      data: dto,
    };
  }
}
