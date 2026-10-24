import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { TicketsService, CreateTicketDto } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  async createTicket(@Body() dto: CreateTicketDto) {
    if (!dto.userId || !dto.subject || !dto.detail) {
      throw new BadRequestException('userId, subject, and detail are required');
    }
    return await this.ticketsService.createTicket(dto);
  }

  @Get()
  async listTickets(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.ticketsService.listTickets({
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Patch(':id/close')
  async closeTicket(@Param('id') id: string) {
    return await this.ticketsService.closeTicket(id);
  }
}
