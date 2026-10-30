import { Module } from "@nestjs/common";
import { AdminDashboardController } from "./controllers/admin-dashboard.controller";
import { AdminCategoriesController } from "./controllers/admin-categories.controller";
import { AdminProductsController } from "./controllers/admin-products.controller";
import { AdminStocksController } from "./controllers/admin-stocks.controller";
import { AdminAccountingController } from "./controllers/admin-accounting.controller";
import { AdminUsersController } from "./controllers/admin-users.controller";
import { AdminOrdersController } from "./controllers/admin-orders.controller";

@Module({
  controllers: [
    AdminDashboardController,
    AdminCategoriesController,
    AdminProductsController,
    AdminStocksController,
    AdminAccountingController,
    AdminUsersController,
    AdminOrdersController,
  ],
  providers: [],
  exports: [],
})
export class AdminModule {}
