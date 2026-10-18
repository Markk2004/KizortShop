import { Controller, Get, Param, Query } from "@nestjs/common";

@Controller("member/orders")
export class MemberOrdersController {
  @Get()
  async getMyOrderHistory(@Query("page") page = 1) {
    return {
      page,
      total: 14,
      orders: [
        {
          id: "ord_1001",
          productTitle: "ไก่ตัน Blox Fruits V4 หมัดก็อด",
          credentials: "username_demo:password_demo",
          amount: 349,
          status: "COMPLETED",
          purchasedAt: new Date(),
        },
      ],
    };
  }

  @Get(":id")
  async getOrderDetail(@Param("id") id: string) {
    return {
      id,
      productTitle: "ไก่ตัน Blox Fruits V4 หมัดก็อด",
      credentials: "username_demo:password_demo",
      amount: 349,
      status: "COMPLETED",
      warrantyExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }
}
