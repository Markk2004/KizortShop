import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { DiscordWebhookService } from "../../../common/webhook/discord-webhook.service";

interface AddExpenseDto {
  title: string;
  category?: string;
  amount: number;
  note?: string;
  paidAt?: string;
}

@Controller(["admin/expense", "admin/accounting"])
export class AdminAccountingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discordWebhook: DiscordWebhookService,
  ) {}

  @Get()
  async getAccountingReport(
    @Query("timeRange") timeRange?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const now = new Date();
    let dateFilter: { gte?: Date; lte?: Date } | undefined = undefined;

    if (timeRange === "TODAY") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      dateFilter = { gte: start };
    } else if (timeRange === "YESTERDAY") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      dateFilter = { gte: start, lte: end };
    } else if (timeRange === "7D") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { gte: start };
    } else if (timeRange === "MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      dateFilter = { gte: start };
    } else if (startDate || endDate) {
      dateFilter = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
    }

    // 1. Fetch Stocks
    const stockWhere: any = {};
    const stocks = await this.prisma.accountStock.findMany({
      where: stockWhere,
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
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Fetch Operating Expenses
    const expenseWhere: any = {};
    if (dateFilter) {
      expenseWhere.paidAt = dateFilter;
    }
    const expenses = await this.prisma.expense.findMany({
      where: expenseWhere,
      orderBy: { paidAt: "desc" },
    });

    let grossRevenue = 0;
    let productCost = 0;
    let defectLoss = 0;
    let soldCount = 0;
    let availableCount = 0;
    let inventoryCost = 0;
    let potentialRevenue = 0;

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

    const filteredRecentSales: any[] = [];

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

      // Determine price
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

      const itemDate = item.soldAt || item.updatedAt || item.createdAt;

      // Check if item falls into selected date range for sold items
      let matchesDate = true;
      if (dateFilter) {
        if (dateFilter.gte && new Date(itemDate) < dateFilter.gte) matchesDate = false;
        if (dateFilter.lte && new Date(itemDate) > dateFilter.lte) matchesDate = false;
      }

      if (item.status === "SOLD") {
        if (matchesDate) {
          soldCount++;
          grossRevenue += sellingPrice;
          productCost += cost;

          mapStats[mapKey].soldCount++;
          mapStats[mapKey].revenue += sellingPrice;
          mapStats[mapKey].cost += cost;
          mapStats[mapKey].profit += sellingPrice - cost;

          filteredRecentSales.push({
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
        }
      } else if (item.status === "AVAILABLE") {
        availableCount++;
        inventoryCost += cost;
        potentialRevenue += sellingPrice;
        mapStats[mapKey].availableCount++;
      } else if (item.status === "CLAIMED_DEFECTIVE") {
        if (matchesDate) {
          defectLoss += cost;
        }
      }
    }

    const operatingExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const netProfit = grossRevenue - productCost - defectLoss - operatingExpenses;
    const profitMargin =
      grossRevenue > 0 ? Number(((netProfit / grossRevenue) * 100).toFixed(1)) : 0;

    return {
      timeRange: timeRange || "ALL",
      summary: {
        grossRevenue,
        productCost,
        operatingExpenses,
        defectLoss,
        netProfit,
        profitMargin,
        inventoryCost,
        potentialRevenue,
        soldCount,
        availableCount,
        totalExpensesCount: expenses.length,
      },
      breakdownByMap: Object.values(mapStats).sort((a, b) => b.revenue - a.revenue),
      expenses: expenses.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        amount: Number(e.amount),
        note: e.note || "",
        paidAt: e.paidAt.toISOString(),
      })),
      recentSales: filteredRecentSales.sort(
        (a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime(),
      ),
    };
  }

  @Post("expenses")
  async createExpense(@Body() dto: AddExpenseDto) {
    if (!dto.title || !dto.title.trim()) {
      throw new BadRequestException("Expense title is required");
    }
    if (dto.amount === undefined || isNaN(Number(dto.amount)) || Number(dto.amount) < 0) {
      throw new BadRequestException("Valid expense amount is required");
    }

    const created = await this.prisma.expense.create({
      data: {
        title: dto.title.trim(),
        category: dto.category || "OTHER",
        amount: Number(dto.amount),
        note: dto.note?.trim() || null,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
      },
    });

    return {
      message: "Expense recorded successfully",
      data: {
        ...created,
        amount: Number(created.amount),
      },
    };
  }

  @Delete("expenses/:id")
  async deleteExpense(@Param("id") id: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Expense item not found");
    }

    await this.prisma.expense.delete({ where: { id } });

    return {
      message: "Expense record deleted successfully",
      id,
    };
  }

  @Post("push-discord")
  async pushAccountingToDiscord() {
    const report = await this.getAccountingReport("ALL");
    const s = report.summary;

    await this.discordWebhook.sendEmbed("orders", {
      title: "📊 สรุปรายงานบัญชีการเงินร้าน KaiZort Store (Accounting Summary)",
      description: "คำนวณจากยอดขายจริง ต้นทุนไอดี และค่าใช้จ่ายร้านใน Supabase Database",
      color: 0x10b981,
      fields: [
        {
          name: "💰 ยอดขายจริงรวม (Gross Revenue)",
          value: `฿${s.grossRevenue.toLocaleString()} (${s.soldCount} บัญชี)`,
          inline: true,
        },
        {
          name: "📦 ต้นทุนไอดีรวม (COGS)",
          value: `฿${s.productCost.toLocaleString()}`,
          inline: true,
        },
        {
          name: "⚡ ค่าใช้จ่ายร้าน (Expenses)",
          value: `฿${s.operatingExpenses.toLocaleString()} (${s.totalExpensesCount} รายการ)`,
          inline: true,
        },
        {
          name: "📈 กำไรสุทธิแท้จริง (Net Profit)",
          value: `**+฿${s.netProfit.toLocaleString()}** (${s.profitMargin}% Margin)`,
          inline: true,
        },
        {
          name: "💎 มูลค่าสต็อกคงเหลือ",
          value: `฿${s.potentialRevenue.toLocaleString()} (${s.availableCount} บัญชี)`,
          inline: true,
        },
      ],
      footer: { text: "KaiZort Accounting System • Real-Time Sync" },
    });

    return {
      message: "Financial summary sent to Discord successfully",
      summary: s,
    };
  }
}
