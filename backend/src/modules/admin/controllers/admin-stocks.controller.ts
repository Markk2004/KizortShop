import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { AddStockBatchDto } from "../dto/admin-product.dto";

@Controller("admin/stocks")
export class AdminStocksController {
  @Get("status")
  async getStockOverview() {
    return {
      message: "Stock counts by game category",
      overview: [],
    };
  }

  @Post("batch")
  async importBatchCredentials(@Body() dto: AddStockBatchDto) {
    return {
      message: `Successfully imported ${dto.credentials?.length || 0} credentials into stock`,
      productId: dto.productId,
      importedCount: dto.credentials?.length || 0,
    };
  }
}
