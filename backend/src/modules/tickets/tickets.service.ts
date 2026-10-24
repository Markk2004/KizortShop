import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DiscordWebhookService } from '../../common/webhook/discord-webhook.service';

export interface CreateTicketDto {
  userId: string;
  subject: string;
  detail: string;
  orderId?: string;
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discordWebhook: DiscordWebhookService,
  ) {}

  /**
   * Member opens a new support ticket
   */
  async createTicket(dto: CreateTicketDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException(`User ${dto.userId} not found`);
    }

    if (!dto.subject || !dto.detail) {
      throw new BadRequestException('subject and detail are required');
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        userId: user.id,
        subject: dto.subject,
        detail: dto.detail,
        orderId: dto.orderId,
        status: 'OPEN',
      },
    });

    // Notify Discord #web-tickets-audit
    await this.discordWebhook.notifyTicketCreated({
      ticketId: ticket.id,
      username: user.username,
      subject: ticket.subject,
      detail: ticket.detail,
      orderId: ticket.orderId || undefined,
    }).catch(() => {});

    return ticket;
  }

  async closeTicket(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return await this.prisma.ticket.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
  }

  async listTickets(params?: { status?: string; limit?: number }) {
    const where: any = {};
    if (params?.status) where.status = params.status;

    return await this.prisma.ticket.findMany({
      where,
      take: params?.limit || 20,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { username: true } },
      },
    });
  }
}
