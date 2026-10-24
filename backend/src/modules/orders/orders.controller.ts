import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { OrdersService, CreateOrderDto } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  async checkout(@Body() dto: CreateOrderDto) {
    if (!dto.userId || !dto.productId) {
      throw new BadRequestException('userId and productId are required');
    }
    return await this.ordersService.checkout(dto);
  }

  @Get()
  async listOrders(
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.ordersService.listOrders({
      userId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
