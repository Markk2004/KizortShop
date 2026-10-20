import { Controller, Get, UseGuards } from "@nestjs/common";
import { PrismaService } from "../../../common/prisma/prisma.service";

@Controller("admin/dashboard")
export class AdminDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("accounting")
  async getCostAndProfitAccounting() {
    const stocks = await this.prisma.accountStock.findMany({
      include: {
        product: {
          select: {
            id: true,
            code: true,
            title: true,
            price: true,
            category: { select: { id: true, name: true } },
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            amount: true,
            costAmount: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    let totalRevenue = 0;
    let totalCost = 0;
    let soldCount = 0;
    let availableCount = 0;
    let defectiveCount = 0;
    let inventoryCost = 0;
    let potentialRevenue = 0;
    let defectLoss = 0;

    const mapStats: Record<
      string,
      {
        mapName: string;
        soldCount: number;
        availableCount: number;
        revenue: number;
        cost: number;
        profit: number;
      }
    > = {};

    const recentSales: any[] = [];

    for (const item of stocks) {
      const mapKey =
        item.farmedMaps?.trim() ||
        item.product?.category?.name?.trim() ||
        item.product?.title?.trim() ||
        "ทั่วไป";

      if (!mapStats[mapKey]) {
        mapStats[mapKey] = {
          mapName: mapKey,
          soldCount: 0,
          availableCount: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };
      }

      const cost = Number(item.costPrice || 0);

      // Determine selling price
      let sellingPrice = 0;
      if (item.sellingPriceText) {
        const num = parseFloat(item.sellingPriceText.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 0) sellingPrice = num;
      }
      if (sellingPrice === 0 && item.order?.amount) {
        sellingPrice = Number(item.order.amount);
      }
      if (sellingPrice === 0 && item.product?.price) {
        sellingPrice = Number(item.product.price);
      }

      if (item.status === "SOLD") {
        soldCount++;
        totalRevenue += sellingPrice;
        totalCost += cost;

        mapStats[mapKey].soldCount++;
        mapStats[mapKey].revenue += sellingPrice;
        mapStats[mapKey].cost += cost;
        mapStats[mapKey].profit += sellingPrice - cost;

        recentSales.push({
          id: item.id,
          serialCode: item.serialCode,
          username: item.username || item.maskedIdentity,
          productTitle: item.product?.title || "สินค้า",
          map: mapKey,
          sellingPrice,
          cost,
          profit: sellingPrice - cost,
          soldAt: item.soldAt || item.updatedAt,
        });
      } else if (item.status === "AVAILABLE") {
        availableCount++;
        inventoryCost += cost;
        potentialRevenue += sellingPrice;
        mapStats[mapKey].availableCount++;
      } else if (item.status === "CLAIMED_DEFECTIVE") {
        defectiveCount++;
        defectLoss += cost;
      }
    }

    const netProfit = totalRevenue - totalCost - defectLoss;
    const profitMargin =
      totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;

    return {
      summary: {
        totalRevenue,
        totalCost,
        netProfit,
        profitMargin,
        defectLoss,
        inventoryCost,
        potentialRevenue,
        soldCount,
        availableCount,
        defectiveCount,
        totalItems: stocks.length,
      },
      breakdownByMap: Object.values(mapStats).sort((a, b) => b.revenue - a.revenue),
      recentSales: recentSales.sort(
        (a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime(),
      ),
    };
  }

  @Get("metrics")
  async getSummaryMetrics() {
    // Real counts from Supabase
    const [stocks, usersCount, pendingSlipsCount] = await Promise.all([
      this.prisma.accountStock.findMany({
        select: {
          status: true,
          sellingPriceText: true,
          costPrice: true,
          product: { select: { price: true } },
        },
      }),
      this.prisma.user.count(),
      this.prisma.topupTransaction.count({ where: { status: "PENDING_VERIFY" } }).catch(() => 0),
    ]);

    let totalRevenue = 0;
    let soldCount = 0;
    let outOfStock = 0;

    for (const s of stocks) {
      if (s.status === "SOLD") {
        soldCount++;
        let p = 0;
        if (s.sellingPriceText) {
          const num = parseFloat(s.sellingPriceText.replace(/[^0-9.]/g, ""));
          if (!isNaN(num) && num > 0) p = num;
        }
        if (p === 0 && s.product?.price) p = Number(s.product.price);
        totalRevenue += p;
      }
    }

    return {
      dailyRevenue: totalRevenue,
      monthlyRevenue: totalRevenue,
      totalOrdersToday: soldCount,
      pendingSlips: pendingSlipsCount || 0,
      activeMembers: usersCount,
      outOfStockCount: outOfStock,
    };
  }

  @Get("recent-activity")
  async getRecentActivity() {
    const recentSold = await this.prisma.accountStock.findMany({
      where: { status: "SOLD" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { product: true },
    });

    return recentSold.map((s) => ({
      id: s.id,
      action: "SOLD_STOCK",
      detail: `ไอดี ${s.username || s.maskedIdentity} [${s.product?.title || "ไก่ตัน"}] ขายออกแล้ว (${s.sellingPriceText || `${s.product?.price} บาท`})`,
      timestamp: s.soldAt || s.updatedAt,
    }));
  }
}
