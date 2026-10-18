import { Module } from "@nestjs/common";
import { AdminDashboardController } from "./controllers/admin-dashboard.controller";
import { AdminProductsController } from "./controllers/admin-products.controller";
import { AdminStocksController } from "./controllers/admin-stocks.controller";

@Module({
  controllers: [
    AdminDashboardController,
    AdminProductsController,
    AdminStocksController,
  ],
  providers: [],
  exports: [],
})
export class AdminModule {}
