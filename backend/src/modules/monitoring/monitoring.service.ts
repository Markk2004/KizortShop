import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DiscordWebhookService } from '../../common/webhook/discord-webhook.service';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discordWebhook: DiscordWebhookService,
  ) {}

  /**
   * Daily business summary run at 21:00 (Asia/Bangkok)
   * Cron '0 21 * * *' (or 14:00 UTC)
   */
  @Cron('0 21 * * *', { timeZone: 'Asia/Bangkok' })
  async runDailySummary(): Promise<void> {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

      const [orders, topups, expenses, newUsersCount] = await Promise.all([
        this.prisma.order.findMany({
          where: { createdAt: { gte: startOfDay }, status: 'COMPLETED' },
          select: { amount: true },
        }),
        this.prisma.topupTransaction.findMany({
          where: { createdAt: { gte: startOfDay }, status: 'SUCCESS' },
          select: { amount: true },
        }),
        this.prisma.expense.findMany({
          where: { createdAt: { gte: startOfDay } },
          select: { amount: true },
        }),
        this.prisma.user.count({
          where: { createdAt: { gte: startOfDay } },
        }),
      ]);

      const totalRevenue = orders.reduce((acc, curr) => acc + Number(curr.amount), 0);
      const topupTotal = topups.reduce((acc, curr) => acc + Number(curr.amount), 0);
      const totalExpense = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

      const dateStr = startOfDay.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      await this.discordWebhook.notifyDailySummary({
        dateStr,
        totalRevenue,
        orderCount: orders.length,
        topupTotal,
        newUsersCount,
        totalExpense,
      });

      this.logger.log(`Daily summary report dispatched for ${dateStr}`);
    } catch (err: any) {
      this.logger.error(`Failed to send daily summary: ${err.message}`, err.stack);
    }
  }

  /**
   * Every 30 minutes: Alert on open tickets older than TICKET_STALE_HOURS (default 6h)
   */
  @Cron('*/30 * * * *')
  async checkStaleTickets(): Promise<void> {
    try {
      const staleHours = parseInt(process.env.TICKET_STALE_HOURS || '6', 10);
      const cutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000);

      const staleTickets = await this.prisma.ticket.findMany({
        where: {
          status: 'OPEN',
          createdAt: { lte: cutoff },
        },
        include: {
          user: { select: { username: true } },
        },
        take: 10,
        orderBy: { createdAt: 'asc' },
      });

      if (staleTickets.length === 0) return;

      const ticketList = staleTickets
        .map((t) => `• \`${t.id.slice(0, 8)}\` โดย ${t.user.username} - หัวข้อ: "${t.subject}" (<t:${Math.floor(t.createdAt.getTime() / 1000)}:R>)`)
        .join('\n');

      await this.discordWebhook.notifySystemAlert({
        title: `พบตั๋วช่วยเหลือค้างตอบเกิน ${staleHours} ชั่วโมง (${staleTickets.length} รายการ)`,
        message: `มีลูกค้าเปิดตั๋วช่วยเหลือรอทีมงานดำเนินการ:\n\n${ticketList}`,
        severity: 'WARN',
        alertKey: 'stale_tickets_alert',
        cooldownMinutes: 60, // notify at most once per hour
        metadata: {
          staleCount: staleTickets.length,
          staleHours,
        },
      });
    } catch (err: any) {
      this.logger.error(`Error checking stale tickets: ${err.message}`);
    }
  }
}
