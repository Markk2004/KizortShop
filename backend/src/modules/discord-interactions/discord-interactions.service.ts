import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DiscordOutboxService } from '../../common/discord/discord-outbox.service';
import { HealthService } from '../health/health.service';
import { DISCORD_COLORS } from '../../common/discord/discord.constants';
import * as nacl from 'tweetnacl';

@Injectable()
export class DiscordInteractionsService {
  private readonly logger = new Logger(DiscordInteractionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: DiscordOutboxService,
    private readonly healthService: HealthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Verify Ed25519 signature from Discord Interactions
   */
  verifySignature(
    signature: string,
    timestamp: string,
    rawBody: Buffer | string,
  ): boolean {
    const publicKey = this.config.get<string>('DISCORD_OPS_PUBLIC_KEY');
    const isProduction =
      this.config.get<string>('NODE_ENV') === 'production' ||
      process.env.NODE_ENV === 'production';

    if (!publicKey) {
      if (isProduction) {
        this.logger.error(
          'FAIL CLOSED: DISCORD_OPS_PUBLIC_KEY is not configured in production. Rejecting interaction.',
        );
        return false;
      }
      this.logger.warn(
        'DISCORD_OPS_PUBLIC_KEY is not configured. Interaction verification bypassed for non-production development.',
      );
      return true;
    }

    try {
      const message = Buffer.concat([
        Buffer.from(timestamp, 'utf-8'),
        Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf-8'),
      ]);
      const sig = Buffer.from(signature, 'hex');
      const pubKey = Buffer.from(publicKey, 'hex');
      return nacl.sign.detached.verify(message, sig, pubKey);
    } catch (err: any) {
      this.logger.error(`Signature verification failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Check if user has permission to run admin slash commands
   */
  hasAdminPermission(interaction: any): boolean {
    const adminRoleId = this.config.get<string>('DISCORD_ADMIN_ROLE_ID');
    // If no admin role is configured, allow for setup/dev
    if (!adminRoleId) return true;

    // Check member roles
    const userRoles = interaction?.member?.roles || [];
    if (userRoles.includes(adminRoleId)) return true;

    // Check administrator permission bit (0x8 = ADMINISTRATOR)
    const permissions = BigInt(interaction?.member?.permissions || '0');
    if ((permissions & BigInt(0x8)) === BigInt(0x8)) return true;

    return false;
  }

  /**
   * Dispatch interaction command
   */
  async handleCommand(interaction: any): Promise<any> {
    const { name, options } = interaction.data;

    // Permission Guard
    if (!this.hasAdminPermission(interaction)) {
      return {
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: {
          flags: 64, // EPHEMERAL
          content:
            '[Access Denied] เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถใช้คำสั่งนี้ได้',
        },
      };
    }

    const optionsMap = (options || []).reduce((acc: any, cur: any) => {
      acc[cur.name] = cur.value;
      return acc;
    }, {});

    try {
      switch (name) {
        case 'web':
          return await this.handleWebCheck();
        case 'status':
          return await this.handleStatusCheck();
        case 'stock':
          return await this.handleStockList();
        case 'stock-log':
          return await this.handleStockLogs(Number(optionsMap.hours || 24));
        case 'orders':
          return await this.handleOrders(optionsMap.status);
        case 'topups':
          return await this.handleTopups(optionsMap.status);
        case 'tickets':
          return await this.handleTickets();
        case 'summary':
          return await this.handleSummary(optionsMap.period || 'today');
        case 'updates':
          return await this.handleUpdates(Number(optionsMap.hours || 24));
        case 'outbox':
          return await this.handleOutbox();
        case 'retry-outbox':
          return await this.handleRetryOutbox();
        case 'mute':
          return await this.handleMute(optionsMap.alert, Number(optionsMap.minutes || 60));
        default:
          return {
            type: 4,
            data: {
              flags: 64,
              content: `ไม่พบคำสั่ง /${name}`,
            },
          };
      }
    } catch (err: any) {
      this.logger.error(`Error executing slash command /${name}: ${err.message}`, err.stack);
      return {
        type: 4,
        data: {
          flags: 64,
          content: `[ข้อผิดพลาด] ไม่สามารถประมวลผลคำสั่ง /${name} ได้ในขณะนี้: ${err.message || 'เกิดข้อผิดพลาดภายในระบบ'}`,
        },
      };
    }
  }

  // --- Command Handlers ---

  private async handleWebCheck() {
    const health = await this.healthService.getDeepHealth();
    const fe = health.components.frontend;
    const db = health.components.database;

    const fields = [
      {
        name: 'หน้าร้าน (Frontend)',
        value: `สถานะ: \`${fe.status}\`\nURL: ${fe.url || '-'}\nการตอบสนอง: \`${fe.latencyMs ?? '-'}ms\``,
        inline: false,
      },
      {
        name: 'ระบบฐานข้อมูล (Supabase)',
        value: `สถานะ: \`${db.status}\`\nความเร็ว Query: \`${db.latencyMs ?? '-'}ms\``,
        inline: true,
      },
      {
        name: 'ความพร้อม API (Backend)',
        value: `สถานะ: \`ONLINE\`\nUptime: \`${health.uptimeSeconds}s\`\nNode: \`${health.system.nodeVersion}\``,
        inline: true,
      },
    ];

    const isOk = health.status === 'HEALTHY';
    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: '[ตรวจสอบระบบเว็บไซต์] ผลการตรวจสอบความพร้อมของระบบ',
            color: isOk ? DISCORD_COLORS.SUCCESS : DISCORD_COLORS.WARNING,
            description: isOk
              ? 'ทุกบริการทำงานได้ตามปกติ ลูกค้าสามารถเข้าชมและสั่งซื้อสินค้าได้ทันที'
              : 'พบปัญหาบางส่วนในระบบ กรุณาตรวจสอบรายละเอียดด้านล่าง',
            fields,
            footer: { text: 'KaiZort Ops Bot - Realtime Web Monitor' },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleStatusCheck() {
    const health = await this.healthService.getDeepHealth();
    const bots = health.components.discordBots;
    const outbox = health.components.outbox;

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: `[สถานะระบบรวม] ${health.status}`,
            color:
              health.status === 'HEALTHY'
                ? DISCORD_COLORS.SUCCESS
                : DISCORD_COLORS.WARNING,
            fields: [
              {
                name: 'Supabase Database',
                value: `สถานะ: \`${health.components.database.status}\` (${health.components.database.latencyMs ?? '-'}ms)`,
                inline: true,
              },
              {
                name: 'Notify Bot',
                value: `สถานะ: \`${bots.notifyBot.status}\`\n${bots.notifyBot.details || ''}`,
                inline: true,
              },
              {
                name: 'Ops Bot',
                value: `สถานะ: \`${bots.opsBot.status}\`\n${bots.opsBot.details || ''}`,
                inline: true,
              },
              {
                name: 'คิวแจ้งเตือน (Outbox)',
                value: `ค้างส่ง: \`${outbox.pending}\` | ส่งแล้ว: \`${outbox.sent}\` | ล้มเหลว: \`${outbox.failed}\``,
                inline: false,
              },
              {
                name: 'หน่วยความจำ Backend',
                value: `RSS: \`${health.system.memoryUsageMB.rss} MB\` | Heap: \`${health.system.memoryUsageMB.heapUsed} MB\``,
                inline: true,
              },
              {
                name: 'Uptime',
                value: `${Math.floor(health.uptimeSeconds / 60)} นาที`,
                inline: true,
              },
            ],
            footer: { text: 'KaiZort Ops Bot' },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleStockList() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: {
        stocks: {
          where: { status: 'AVAILABLE' },
          select: { id: true },
        },
        category: {
          select: { name: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (products.length === 0) {
      return {
        type: 4,
        data: {
          flags: 64,
          content: 'ยังไม่มีรายการสินค้าในระบบ',
        },
      };
    }

    const lines = products.map((p) => {
      const count = p.stocks.length;
      const tag = count === 0 ? '[หมด]' : count <= 2 ? '[เหลือน้อย]' : '[พร้อม]';
      return `• ${tag} **${p.title}** (\`${p.code}\`) - เหลือ **${count}** ไอดี (ราคา ฿${p.price})`;
    });

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: `[รายงานสต็อกสินค้า] รายการสินค้าทั้งหมด (${products.length} รายการ)`,
            description: lines.join('\n'),
            color: DISCORD_COLORS.INFO,
            footer: { text: 'KaiZort Store - Admin Inventory Tracking' },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleStockLogs(hours: number) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const stocks = await this.prisma.accountStock.findMany({
      where: { createdAt: { gte: since } },
      include: {
        product: { select: { title: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (stocks.length === 0) {
      return {
        type: 4,
        data: {
          flags: 64,
          content: `ไม่พบประวัติการลงของในช่วง ${hours} ชั่วโมงที่ผ่านมา`,
        },
      };
    }

    const lines = stocks.map(
      (s) =>
        `• <t:${Math.floor(s.createdAt.getTime() / 1000)}:R> | **${s.product.title}** | Batch: \`${s.batchCode || '-'}\` | ซัพพลายเออร์: \`${s.supplierName || '-'}\``,
    );

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: `[ประวัติการลงของ] ช่วง ${hours} ชั่วโมงที่ผ่านมา (แสดงล่าสุด ${stocks.length} รายการ)`,
            description: lines.join('\n'),
            color: DISCORD_COLORS.SUCCESS,
            footer: { text: 'KaiZort Store - Stock Ingestion Log' },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleOrders(statusFilter?: string) {
    const where: any = {};
    if (statusFilter) {
      where.status = statusFilter;
    }

    const [orders, countToday] = await Promise.all([
      this.prisma.order.findMany({
        where,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { username: true } },
          product: { select: { title: true } },
        },
      }),
      this.prisma.order.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    if (orders.length === 0) {
      return {
        type: 4,
        data: {
          flags: 64,
          content: 'ไม่พบรายการคำสั่งซื้อตามเงื่อนไข',
        },
      };
    }

    const lines = orders.map(
      (o) =>
        `• \`${o.orderNumber}\` | ${o.user.username} | ฿${o.amount} | **${o.product.title}** | \`${o.status}\``,
    );

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: `[คำสั่งซื้อล่าสุด] วันนี้มีทั้งหมด ${countToday} รายการ`,
            description: lines.join('\n'),
            color: DISCORD_COLORS.INFO,
            footer: { text: 'KaiZort Store - Orders Monitor' },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleTopups(statusFilter?: string) {
    const where: any = {};
    if (statusFilter) {
      where.status = statusFilter;
    }

    const [topups, pendingCount] = await Promise.all([
      this.prisma.topupTransaction.findMany({
        where,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { username: true } },
        },
      }),
      this.prisma.topupTransaction.count({
        where: { status: 'PENDING_VERIFY' },
      }),
    ]);

    if (topups.length === 0) {
      return {
        type: 4,
        data: {
          flags: 64,
          content: 'ไม่พบรายการเติมเงิน',
        },
      };
    }

    const lines = topups.map(
      (t) =>
        `• ${t.user.username} | **฿${t.amount}** | \`${t.paymentMethod}\` | สถานะ: \`${t.status}\``,
    );

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: `[รายการเติมเงิน] รอตรวจสอบ ${pendingCount} รายการ`,
            description: lines.join('\n'),
            color:
              pendingCount > 0
                ? DISCORD_COLORS.WARNING
                : DISCORD_COLORS.SUCCESS,
            footer: { text: 'KaiZort Store - Topup Monitor' },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleTickets() {
    const tickets = await this.prisma.ticket.findMany({
      where: { status: 'OPEN' },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { username: true } },
      },
    });

    if (tickets.length === 0) {
      return {
        type: 4,
        data: {
          flags: 64,
          content: 'ไม่มีตั๋วติดต่อที่เปิดค้างอยู่ (OPEN)',
        },
      };
    }

    const lines = tickets.map(
      (t) =>
        `• รหัส \`${t.id.slice(0, 8)}\` | ${t.user.username} | **${t.subject}** (<t:${Math.floor(t.createdAt.getTime() / 1000)}:R>)`,
    );

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: `[ตั๋วช่วยเหลือที่เปิดอยู่] ทั้งหมด ${tickets.length} รายการ`,
            description: lines.join('\n'),
            color: DISCORD_COLORS.WARNING,
            footer: { text: 'KaiZort Store - Ticket Support' },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleSummary(period: string) {
    const start =
      period === 'week'
        ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        : new Date(new Date().setHours(0, 0, 0, 0));

    const [orders, topups, expenses, newUsers] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: start }, status: 'COMPLETED' },
        select: { amount: true, costAmount: true },
      }),
      this.prisma.topupTransaction.findMany({
        where: { createdAt: { gte: start }, status: 'SUCCESS' },
        select: { amount: true },
      }),
      this.prisma.expense.findMany({
        where: { createdAt: { gte: start } },
        select: { amount: true },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: start } },
      }),
    ]);

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.amount), 0);
    const totalTopup = topups.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const estimatedProfit = totalRevenue - totalExpense;

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: `[สรุปสถิติธุรกิจ] ช่วงเวลา: ${period === 'week' ? '7 วันย้อนหลัง' : 'วันนี้'}`,
            color: DISCORD_COLORS.PURPLE,
            fields: [
              {
                name: 'ยอดขายรวม',
                value: `฿${totalRevenue.toLocaleString()}`,
                inline: true,
              },
              {
                name: 'ออเดอร์สำเร็จ',
                value: `${orders.length} รายการ`,
                inline: true,
              },
              {
                name: 'ยอดเติมเงิน',
                value: `฿${totalTopup.toLocaleString()}`,
                inline: true,
              },
              {
                name: 'ค่าใช้จ่ายร้าน',
                value: `฿${totalExpense.toLocaleString()}`,
                inline: true,
              },
              {
                name: 'กำไรสุทธิเบื้องต้น',
                value: `฿${estimatedProfit.toLocaleString()}`,
                inline: true,
              },
              {
                name: 'สมาชิกสมัครใหม่',
                value: `${newUsers} ท่าน`,
                inline: true,
              },
            ],
            footer: { text: 'KaiZort Store - Business Intelligence' },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleUpdates(hours: number) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        createdAt: { gte: since },
        targetType: { in: ['PRODUCT', 'CATEGORY', 'STOCK', 'BANNER'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        actor: { select: { username: true } },
      },
    });

    if (logs.length === 0) {
      return {
        type: 4,
        data: {
          flags: 64,
          content: `ไม่พบการเปลี่ยนแปลงสินค้าหรือหมวดหมู่ในช่วง ${hours} ชั่วโมงที่ผ่านมา`,
        },
      };
    }

    const lines = logs.map(
      (l) =>
        `• <t:${Math.floor(l.createdAt.getTime() / 1000)}:R> | \`${l.action}\` | เป้าหมาย: \`${l.targetType}\` | โดย: \`${l.actor?.username || 'ระบบ'}\``,
    );

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: `[ความเปลี่ยนแปลงบนเว็บ] ช่วง ${hours} ชั่วโมงที่ผ่านมา`,
            description: lines.join('\n'),
            color: DISCORD_COLORS.INFO,
            footer: { text: 'KaiZort Store - Audit Tracking' },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleOutbox() {
    const stats = await this.outboxService.getStats();

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: '[สถานะคิวแจ้งเตือน Discord Outbox]',
            color:
              stats.failed > 0
                ? DISCORD_COLORS.DANGER
                : stats.pending > 10
                ? DISCORD_COLORS.WARNING
                : DISCORD_COLORS.SUCCESS,
            fields: [
              {
                name: 'รอการส่ง (Pending)',
                value: `\`${stats.pending}\` รายการ`,
                inline: true,
              },
              {
                name: 'ส่งสำเร็จแล้ว (Sent)',
                value: `\`${stats.sent}\` รายการ`,
                inline: true,
              },
              {
                name: 'ล้มเหลว (Failed)',
                value: `\`${stats.failed}\` รายการ`,
                inline: true,
              },
            ],
            description:
              stats.failed > 0
                ? 'มีรายการส่งไม่สำเร็จ สามารถใช้คำสั่ง `/retry-outbox` เพื่อสั่งส่งใหม่ได้ทันที'
                : 'คิวการแจ้งเตือนทำงานได้เป็นปกติ ไม่มีข้อความตกค้าง',
            footer: { text: 'KaiZort Outbox Queue' },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleRetryOutbox() {
    const res = await this.outboxService.retryAllFailed();
    return {
      type: 4,
      data: {
        flags: 64,
        content: `[Retry Triggered] นำข้อความที่เคยล้มเหลวจำนวน ${res.count} รายการกลับเข้าคิวส่งใหม่แล้ว`,
      },
    };
  }

  private async handleMute(alertName: string, minutes: number) {
    if (!alertName) {
      return {
        type: 4,
        data: {
          flags: 64,
          content: 'กรุณาระบุชื่อการแจ้งเตือนที่ต้องการปิดเสียง (เช่น system_watchdog_incident, stale_tickets_alert)',
        },
      };
    }

    const muteUntil = new Date(Date.now() + minutes * 60 * 1000);
    await this.prisma.alertState.upsert({
      where: { key: alertName },
      create: {
        key: alertName,
        mutedUntil: muteUntil,
      },
      update: {
        mutedUntil: muteUntil,
      },
    });

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: `[Mute Alert] ปิดเสียงแจ้งเตือนสำเร็จ`,
            description: `ปิดเสียงแจ้งเตือน \`${alertName}\` เป็นเวลา **${minutes} นาที** (จนถึง <t:${Math.floor(muteUntil.getTime() / 1000)}:T>)`,
            color: DISCORD_COLORS.WARNING,
            footer: { text: 'KaiZort Ops Bot' },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }
}
