import { Controller, Get, UseGuards } from "@nestjs/common";

@Controller("admin/dashboard")
export class AdminDashboardController {
  @Get("metrics")
  async getSummaryMetrics() {
    return {
      dailyRevenue: 48250,
      monthlyRevenue: 1245000,
      totalOrdersToday: 142,
      pendingSlips: 3,
      activeMembers: 1284,
      outOfStockCount: 4,
    };
  }

  @Get("recent-activity")
  async getRecentActivity() {
    return [
      { id: "act_1", action: "NEW_ORDER", detail: "order #1001 completed", timestamp: new Date() },
      { id: "act_2", action: "SLIP_SUBMITTED", detail: "500 THB pending verify", timestamp: new Date() },
    ];
  }
}
