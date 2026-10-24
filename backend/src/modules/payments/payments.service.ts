import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DiscordWebhookService } from '../../common/webhook/discord-webhook.service';

export interface SubmitTopupDto {
  userId: string;
  amount: number;
  paymentMethod: string;
  slipRef?: string;
  slipUrl?: string;
}

export interface VerifyTopupDto {
  status: 'SUCCESS' | 'REJECTED';
  verifiedBy: string;
  reason?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discordWebhook: DiscordWebhookService,
  ) {}

  /**
   * Member submits a topup request with slip
   */
  async submitTopup(dto: SubmitTopupDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException(`User ${dto.userId} not found`);
    }

    if (dto.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const transactionCode = `TOP-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;

    const topup = await this.prisma.topupTransaction.create({
      data: {
        transactionCode,
        userId: user.id,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod || 'PROMPTPAY_QR',
        slipRef: dto.slipRef,
        slipUrl: dto.slipUrl,
        status: 'PENDING_VERIFY',
      },
    });

    // Notify Discord #web-topups (checks LARGE_TOPUP_AMOUNT automatically)
    await this.discordWebhook.notifyTopupSubmitted({
      username: user.username,
      amount: dto.amount,
      paymentMethod: topup.paymentMethod,
      slipRef: dto.slipRef,
      slipUrl: dto.slipUrl,
    }).catch(() => {});

    return topup;
  }

  /**
   * Admin approves or rejects topup
   */
  async verifyTopup(id: string, dto: VerifyTopupDto) {
    const topup = await this.prisma.topupTransaction.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!topup) {
      throw new NotFoundException(`Topup transaction ${id} not found`);
    }

    if (topup.status !== 'PENDING_VERIFY') {
      throw new BadRequestException(`Topup is already resolved as ${topup.status}`);
    }

    const isApproved = dto.status === 'SUCCESS';
    const amount = Number(topup.amount);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (isApproved) {
        // Credit user wallet
        await tx.wallet.upsert({
          where: { userId: topup.userId },
          create: {
            userId: topup.userId,
            balance: amount,
            totalTopup: amount,
          },
          update: {
            balance: { increment: amount },
            totalTopup: { increment: amount },
          },
        });
      }

      return await tx.topupTransaction.update({
        where: { id },
        data: {
          status: dto.status,
          verifiedBy: dto.verifiedBy,
          verifiedAt: new Date(),
          rejectReason: dto.reason,
        },
      });
    });

    // Notify Discord #web-topups
    await this.discordWebhook.notifyTopupVerified({
      username: topup.user.username,
      amount,
      status: dto.status,
      verifiedBy: dto.verifiedBy,
      reason: dto.reason,
    }).catch(() => {});

    return updated;
  }

  async listTopups(params?: { status?: any; limit?: number }) {
    const where: any = {};
    if (params?.status) where.status = params.status;

    return await this.prisma.topupTransaction.findMany({
      where,
      take: params?.limit || 20,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { username: true } },
      },
    });
  }
}
