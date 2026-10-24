import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  PaymentsService,
  SubmitTopupDto,
  VerifyTopupDto,
} from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('topup/submit')
  async submitTopup(@Body() dto: SubmitTopupDto) {
    if (!dto.userId || dto.amount === undefined) {
      throw new BadRequestException('userId and amount are required');
    }
    return await this.paymentsService.submitTopup(dto);
  }

  @Post('topup/:id/verify')
  async verifyTopup(
    @Param('id') id: string,
    @Body() dto: VerifyTopupDto,
  ) {
    if (!dto.status || !['SUCCESS', 'REJECTED'].includes(dto.status)) {
      throw new BadRequestException('status must be SUCCESS or REJECTED');
    }
    return await this.paymentsService.verifyTopup(id, dto);
  }

  @Get('topup')
  async listTopups(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.paymentsService.listTopups({
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
