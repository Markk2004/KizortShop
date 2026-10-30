import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
} from "@nestjs/common";
import { PrismaService } from "../../../common/prisma/prisma.service";

@Controller("admin/orders")
export class AdminOrdersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listAllOrders() {
    const [orders, soldStocks] = await Promise.all([
      this.prisma.order.findMany({
        include: {
          user: true,
          product: { include: { category: true } },
          deliveredKey: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.accountStock.findMany({
        where: { status: "SOLD", orderId: null },
        include: {
          product: { include: { category: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const result: any[] = [];

    // 1. Map existing Order records
    for (const ord of orders) {
      result.push({
        id: ord.id,
        orderNumber: ord.orderNumber,
        buyer: ord.user?.username || "ลูกค้าเว็บไซต์",
        buyerEmail: ord.user?.email || "customer@kaizort.store",
        productTitle: ord.product?.title || "สินค้า",
        categoryCode: ord.product?.code || "PROD",
        deliveredCode: ord.deliveredKey?.serialCode || "STK-VAULT",
        decryptedCredential: "●●●●●●●●",
        amount: Number(ord.amount),
        status: ord.status,
        sla: "0.8 วิ",
        timeAgo: formatTimeAgo(ord.createdAt),
        createdAt: ord.createdAt.toISOString(),
      });
    }

    // 2. Map sold stock items (e.g. from Discord sales or direct register)
    for (const stk of soldStocks) {
      let price = 0;
      if (stk.sellingPriceText) {
        const num = parseFloat(stk.sellingPriceText.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 0) price = num;
      }
      if (price === 0 && stk.product?.price) {
        price = Number(stk.product.price);
      }

      const soldDate = stk.soldAt || stk.updatedAt || stk.createdAt;
      const rawMap = (stk.farmedMaps || stk.details || stk.product?.title || "Break And Steal Egg").trim();
      const mapLower = rawMap.toLowerCase();
      let cleanMap = "Break And Steal Egg";
      if (mapLower.includes("tap") || mapLower.includes("simulator")) {
        cleanMap = "Tap Simulator Reborn";
      } else if (mapLower.includes("blox") || mapLower.includes("bf")) {
        cleanMap = "Blox Fruits";
      }

      result.push({
        id: stk.id,
        orderNumber: `KZ-${stk.serialCode.replace(/[^A-Z0-9]/gi, "").slice(-6)}`,
        buyer: stk.username || stk.maskedIdentity || "ลูกค้าผ่าน Discord",
        buyerEmail: "discord-customer@kaizort.store",
        productTitle:
          stk.details && !stk.details.toLowerCase().includes("break")
            ? `${cleanMap} (${stk.details})`
            : cleanMap,
        categoryCode: cleanMap,
        deliveredCode: stk.serialCode,
        decryptedCredential: "●●●●●●●●",
        amount: price,
        status: "COMPLETED",
        sla: "0.8 วิ",
        timeAgo: formatTimeAgo(soldDate),
        createdAt: soldDate.toISOString(),
      });
    }

    // Sort by createdAt desc
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      message: "Orders and sales retrieved successfully",
      data: result,
    };
  }

  @Patch(":id/status")
  async updateOrderStatus(
    @Param("id") id: string,
    @Body("status") status: string,
  ) {
    // Check if it's an Order
    const ord = await this.prisma.order.findUnique({ where: { id } });
    if (ord) {
      const updated = await this.prisma.order.update({
        where: { id },
        data: { status: status as any },
      });
      return { message: "Order status updated", data: updated };
    }

    // Else check AccountStock
    const stk = await this.prisma.accountStock.findUnique({ where: { id } });
    if (stk) {
      const updated = await this.prisma.accountStock.update({
        where: { id },
        data: {
          status: status === "REFUNDED" ? "CLAIMED_DEFECTIVE" : (status as any),
        },
      });
      return { message: "Stock status updated", data: updated };
    }

    throw new NotFoundException("Order or stock item not found");
  }
}

function formatTimeAgo(date: Date): string {
  const diffSec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diffSec < 60) return "เมื่อสักครู่";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ชม. ที่แล้ว`;
  const diffDays = Math.floor(diffHour / 24);
  return `${diffDays} วันที่แล้ว`;
}
