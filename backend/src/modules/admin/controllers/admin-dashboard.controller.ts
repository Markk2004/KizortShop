import { Controller, Get, UseGuards } from "@nestjs/common";
import { PrismaService } from "../../../common/prisma/prisma.service";

@Controller("admin/dashboard")
export class AdminDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("accounting")
  async getCostAndProfitAccounting() {
    const [stocks, expenses] = await Promise.all([
      this.prisma.accountStock.findMany({
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
      }),
      this.prisma.expense.findMany(),
    ]);

    let totalRevenue = 0;
    let totalCost = 0;
    let soldCount = 0;
    let availableCount = 0;
    let pricedAvailableCount = 0;
    let unpricedAvailableCount = 0;
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
      const rawMapName =
        item.farmedMaps?.trim() ||
        item.product?.category?.name?.trim() ||
        item.product?.title?.trim() ||
        "ทั่วไป";
      const mapKey = rawMapName.toLowerCase();

      if (!mapStats[mapKey]) {
        mapStats[mapKey] = {
          mapName: rawMapName,
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

      if (item.status === "SOLD") {
        if (sellingPrice === 0 && item.product?.price) {
          sellingPrice = Number(item.product.price);
        }
        soldCount++;
        totalRevenue += sellingPrice;
        totalCost += cost;

        mapStats[mapKey].soldCount++;
        mapStats[mapKey].revenue += sellingPrice;
        mapStats[mapKey].cost += cost;
        mapStats[mapKey].profit += sellingPrice - cost;

        const resolvedTitle =
          item.farmedMaps || item.details || item.product?.title || "สินค้าไก่ตัน";

        recentSales.push({
          id: item.id,
          serialCode: item.serialCode,
          username: item.username || item.maskedIdentity,
          productTitle: resolvedTitle,
          map: mapStats[mapKey].mapName,
          sellingPrice,
          cost,
          profit: sellingPrice - cost,
          soldAt: item.soldAt || item.updatedAt,
          orderNumber: item.order?.orderNumber || "KZ-DIRECT",
        });
      } else if (item.status === "AVAILABLE") {
        availableCount++;
        inventoryCost += cost;
        if (sellingPrice > 0) {
          pricedAvailableCount++;
          potentialRevenue += sellingPrice;
        } else {
          unpricedAvailableCount++;
        }
        mapStats[mapKey].availableCount++;
      } else if (item.status === "CLAIMED_DEFECTIVE") {
        defectiveCount++;
        defectLoss += cost;
      }
    }

    const operatingExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const netProfit = totalRevenue - totalCost - defectLoss - operatingExpenses;
    const profitMargin =
      totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;
    const avgSoldPrice = soldCount > 0 ? Number((totalRevenue / soldCount).toFixed(1)) : 0;
    const estimatedInventoryValue = Number((avgSoldPrice * unpricedAvailableCount).toFixed(1));

    return {
      summary: {
        totalRevenue,
        totalCost,
        operatingExpenses,
        netProfit,
        profitMargin,
        defectLoss,
        inventoryCost,
        potentialRevenue,
        pricedAvailableCount,
        unpricedAvailableCount,
        avgSoldPrice,
        estimatedInventoryValue,
        soldCount,
        availableCount,
        defectiveCount,
        totalItems: stocks.length,
      },
      breakdownByMap: Object.values(mapStats)
        .filter((m) => m.soldCount > 0 || m.availableCount > 0)
        .sort((a, b) => b.revenue - a.revenue),
      recentSales: recentSales.sort(
        (a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime(),
      ),
    };
  }

  @Get("metrics")
  async getSummaryMetrics() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0);

    // Real counts and records from Supabase
    const [stocks, usersCount, pendingSlips, products, openTicketsCount] = await Promise.all([
      this.prisma.accountStock.findMany({
        select: {
          status: true,
          sellingPriceText: true,
          costPrice: true,
          soldAt: true,
          updatedAt: true,
          product: { select: { price: true } },
          order: { select: { amount: true } },
        },
      }),
      this.prisma.user.count(),
      this.prisma.topupTransaction.findMany({
        where: { status: "PENDING_VERIFY" },
        select: { amount: true },
      }).catch(() => []),
      this.prisma.product
        .findMany({
          where: { isActive: true, code: { not: "KAITUN-VAULT-POOL" } },
          select: {
            id: true,
            code: true,
            title: true,
            _count: { select: { stocks: { where: { status: "AVAILABLE" } } } },
          },
        })
        .catch(() => []),
      this.prisma.ticket.count({ where: { status: "OPEN" } }).catch(() => 0),
    ]);

    const outOfStockProducts = products.filter((p) => p._count.stocks === 0);
    const outOfStockCount = outOfStockProducts.length;

    let dailyRevenue = 0;
    let yesterdayRevenue = 0;
    let weeklyRevenue = 0;
    let monthlyRevenue = 0;
    let totalRevenue = 0;
    let soldTodayCount = 0;
    let soldTotalCount = 0;
    let availableCount = 0;
    let defectiveCount = 0;

    // Daily buckets for last 7 days (day 6 ago up to today)
    const dayNames = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    const fullDayNames = [
      "วันอาทิตย์",
      "วันจันทร์",
      "วันอังคาร",
      "วันพุธ",
      "วันพฤหัสบดี",
      "วันศุกร์",
      "วันเสาร์",
    ];

    const weeklyBuckets: Record<string, { day: string; label: string; val: number; isToday: boolean }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      weeklyBuckets[key] = {
        day: dayNames[d.getDay()],
        label: fullDayNames[d.getDay()],
        val: 0,
        isToday: i === 0,
      };
    }

    for (const s of stocks) {
      if (s.status === "AVAILABLE") {
        availableCount++;
      } else if (s.status === "CLAIMED_DEFECTIVE") {
        defectiveCount++;
      } else if (s.status === "SOLD") {
        soldTotalCount++;
        let p = 0;
        if (s.sellingPriceText) {
          const num = parseFloat(s.sellingPriceText.replace(/[^0-9.]/g, ""));
          if (!isNaN(num) && num > 0) p = num;
        }
        if (p === 0 && s.order?.amount) p = Number(s.order.amount);
        if (p === 0 && s.product?.price) p = Number(s.product.price);

        totalRevenue += p;

        const soldTime = new Date(s.soldAt || s.updatedAt);
        if (soldTime >= startOfMonth) {
          monthlyRevenue += p;
        }
        if (soldTime >= startOfToday) {
          dailyRevenue += p;
          soldTodayCount++;
        }
        if (soldTime >= startOfYesterday && soldTime <= endOfYesterday) {
          yesterdayRevenue += p;
        }
        if (soldTime >= sevenDaysAgo) {
          weeklyRevenue += p;
        }

        const dateKey = `${soldTime.getFullYear()}-${String(soldTime.getMonth() + 1).padStart(2, "0")}-${String(soldTime.getDate()).padStart(2, "0")}`;
        if (weeklyBuckets[dateKey]) {
          weeklyBuckets[dateKey].val += p;
        }
      }
    }

    const bucketList = Object.values(weeklyBuckets);
    const maxVal = Math.max(...bucketList.map((b) => b.val), 100);
    const weeklyBars = bucketList.map((b) => ({
      day: b.day,
      label: b.label,
      val: b.val,
      valLabel: b.val >= 1000 ? `${(b.val / 1000).toFixed(1)}K` : `฿${b.val}`,
      heightPercent: b.val > 0 ? Math.max(12, Math.round((b.val / maxVal) * 100)) : 6,
      isToday: b.isToday,
    }));

    let pendingSlipsAmount = 0;
    for (const s of pendingSlips) {
      pendingSlipsAmount += Number(s.amount || 0);
    }
    const revenueChangePercent =
      yesterdayRevenue > 0
        ? Number((((dailyRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1))
        : dailyRevenue > 0
        ? 100
        : 0;

    return {
      dailyRevenue,
      yesterdayRevenue,
      revenueChangePercent,
      weeklyRevenue,
      monthlyRevenue,
      totalRevenue,
      totalOrdersToday: soldTodayCount,
      soldTotalCount,
      availableStockCount: availableCount,
      defectiveCount,
      openTicketsCount,
      pendingSlips: pendingSlips.length,
      pendingSlipsAmount,
      activeMembers: usersCount,
      outOfStockCount,
      outOfStockProducts: outOfStockProducts.map((p) => p.code || p.title),
      weeklyBars,
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
