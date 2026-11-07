import { Module } from '@nestjs/common';
import { OrdersController, StorefrontController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController, StorefrontController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
