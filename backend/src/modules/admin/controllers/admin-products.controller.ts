import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CreateAdminProductDto, UpdateAdminProductDto, UpdateRobuxStatusDto } from "../dto/admin-product.dto";

// In-memory service state for Robux auto-topup (defaults to OUT_OF_STOCK as requested)
let robuxServiceState = {
  serviceId: "robux-auto-topup",
  serviceName: "เติม Robux อัตโนมัติ 24 ชม.",
  status: "OUT_OF_STOCK" as "AVAILABLE" | "OUT_OF_STOCK",
  stockCount: 0,
  reason: "ระบบปรับปรุงชั่วคราว สินค้าหมดชั่วคราว",
  lastUpdatedAt: new Date().toISOString(),
};

@Controller("admin/products")
export class AdminProductsController {
  @Get()
  async listAllProducts() {
    return {
      message: "Admin full product inventory list",
      data: [],
    };
  }

  /**
   * Diagnostic check function: checkRobuxAvailability
   */
  @Get("robux/status")
  async checkRobuxAvailability() {
    const isAvailable = robuxServiceState.status === "AVAILABLE" && robuxServiceState.stockCount > 0;
    return {
      serviceId: robuxServiceState.serviceId,
      serviceName: robuxServiceState.serviceName,
      isAvailable,
      status: robuxServiceState.status,
      statusLabel: isAvailable ? "มีสินค้า" : "สินค้าหมดชั่วคราว",
      stockCount: robuxServiceState.stockCount,
      message: isAvailable
        ? "บริการเติม Robux อัตโนมัติเปิดให้บริการตามปกติ ส่งมอบทันที 24 ชม."
        : robuxServiceState.reason,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Admin updates Robux auto-topup availability: AVAILABLE vs OUT_OF_STOCK
   */
  @Patch("robux/status")
  async updateRobuxStatus(@Body() dto: UpdateRobuxStatusDto) {
    robuxServiceState = {
      ...robuxServiceState,
      status: dto.status,
      stockCount: dto.stockCount !== undefined ? dto.stockCount : (dto.status === "AVAILABLE" ? 10000 : 0),
      reason: dto.reason || (dto.status === "OUT_OF_STOCK" ? "สินค้าหมดชั่วคราว ปิดการเติม Robux อัตโนมัติ" : ""),
      lastUpdatedAt: new Date().toISOString(),
    };

    return {
      message: `Robux status successfully updated to ${dto.status}`,
      data: robuxServiceState,
    };
  }

  @Post()
  async createProduct(@Body() dto: CreateAdminProductDto) {
    return {
      message: "Product created successfully",
      data: dto,
    };
  }

  @Patch(":id")
  async updateProduct(@Param("id") id: string, @Body() dto: UpdateAdminProductDto) {
    return {
      message: `Product ${id} updated successfully`,
      data: dto,
    };
  }

  @Delete(":id")
  async deleteProduct(@Param("id") id: string) {
    return {
      message: `Product ${id} deleted successfully`,
    };
  }
}
