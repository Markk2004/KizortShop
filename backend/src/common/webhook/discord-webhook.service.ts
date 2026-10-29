import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordOutboxService } from '../discord/discord-outbox.service';
import {
  DISCORD_COLORS,
  DiscordBotType,
  DiscordChannelKey,
  DiscordEmbedField,
  DiscordEmbedPayload,
  DiscordMessagePayload,
} from '../discord/discord.constants';

export type WebhookChannelKey = DiscordChannelKey;
export { DiscordEmbedField, DiscordEmbedPayload };

@Injectable()
export class DiscordWebhookService implements OnModuleInit {
  private readonly logger = new Logger(DiscordWebhookService.name);
  private readonly alertCooldownMap = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: DiscordOutboxService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.bootstrapDefaultChannels();
  }

  /**
   * Ensure default webhook channel configs exist in database
   */
  async bootstrapDefaultChannels(): Promise<void> {
    const defaultChannels: { key: DiscordChannelKey; name: string; desc: string }[] = [
      { key: 'orders', name: '#web-orders', desc: 'แจ้งเตือนคำสั่งซื้อใหม่' },
      { key: 'topups', name: '#web-topups', desc: 'แจ้งเตือนการแจ้งโอนเงินและเติมเงิน' },
      { key: 'stocks', name: '#web-stock-logs', desc: 'แจ้งเตือนการลงของและสต็อกต่ำ' },
      { key: 'catalog', name: '#web-catalog', desc: 'อัปเดตรายการสินค้าและแค็ตตาล็อก' },
      { key: 'members', name: '#web-members', desc: 'แจ้งเตือนสมาชิกใหม่' },
      { key: 'tickets_audit', name: '#web-tickets-audit', desc: 'แจ้งเตือนตั๋วช่วยเหลือ' },
      { key: 'kaitun_sync', name: '#kaitun-id', desc: 'ซิงค์สถานะไอดีไก่ตัน' },
      { key: 'system_alerts', name: '#web-system-alerts', desc: 'แจ้งเตือนสถานะความสมบูรณ์และเหตุขัดข้องของระบบ' },
    ];

    try {
      for (const ch of defaultChannels) {
        const existing = await this.prisma.webhookChannelConfig.findUnique({
          where: { channelKey: ch.key },
        });
        if (!existing) {
          await this.prisma.webhookChannelConfig.create({
            data: {
              channelKey: ch.key,
              channelName: ch.name,
              channelId: '',
              webhookUrl: '',
              isActive: true,
              description: ch.desc,
            },
          });
          this.logger.log(`Initialized default channel config for [${ch.key}] (${ch.name})`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not bootstrap default channel configs: ${err.message}`);
    }
  }

  /**
   * Main method to send embed to a channel key via guaranteed Outbox delivery
   */
  async sendEmbed(
    channelKey: WebhookChannelKey,
    embed: DiscordEmbedPayload,
    botType: DiscordBotType = 'notify',
    content?: string,
  ): Promise<boolean> {
    const payload: DiscordMessagePayload = {
      content,
      embeds: [
        {
          ...embed,
          timestamp: embed.timestamp || new Date().toISOString(),
          footer: embed.footer || { text: 'KaiZort Store - Automated System' },
        },
      ],
    };

    return await this.outboxService.enqueue(channelKey, payload, botType);
  }

  /**
   * Send a system alert with severity, cooldown, and optional admin role mention
   */
  async notifySystemAlert(data: {
    title: string;
    message: string;
    severity: 'INFO' | 'WARN' | 'CRITICAL' | 'RESOLVED';
    metadata?: Record<string, any>;
    alertKey?: string;
    cooldownMinutes?: number;
  }): Promise<boolean> {
    const cooldownKey = data.alertKey || data.title;
    const cooldownMs = (data.cooldownMinutes ?? 10) * 60 * 1000;
    const now = new Date();
    const nowMs = now.getTime();

    // Check persistent mute / cooldown in AlertState
    try {
      const existingState = await this.prisma.alertState.findUnique({
        where: { key: cooldownKey },
      });

      // 1. Check if muted
      if (existingState?.mutedUntil && existingState.mutedUntil > now) {
        this.logger.debug(
          `System alert '${cooldownKey}' is muted until ${existingState.mutedUntil.toISOString()}`,
        );
        return false;
      }

      // 2. Check cooldown (unless RESOLVED)
      if (data.severity !== 'RESOLVED' && existingState?.lastSentAt) {
        const elapsed = nowMs - existingState.lastSentAt.getTime();
        if (elapsed < cooldownMs) {
          this.logger.debug(
            `System alert '${cooldownKey}' throttled by persistent cooldown (${Math.round(
              (cooldownMs - elapsed) / 1000,
            )}s remaining)`,
          );
          return false;
        }
      }

      // Upsert persistent state
      await this.prisma.alertState.upsert({
        where: { key: cooldownKey },
        create: {
          key: cooldownKey,
          lastSentAt: now,
          metadata: data.metadata as any,
        },
        update: {
          lastSentAt: now,
          metadata: data.metadata as any,
        },
      });
    } catch (err: any) {
      // Fast in-memory fallback if DB fails
      if (data.severity !== 'RESOLVED' && this.alertCooldownMap.has(cooldownKey)) {
        const lastTime = this.alertCooldownMap.get(cooldownKey)!;
        if (nowMs - lastTime < cooldownMs) {
          return false;
        }
      }
      this.alertCooldownMap.set(cooldownKey, nowMs);
    }

    const color =
      data.severity === 'CRITICAL'
        ? DISCORD_COLORS.DANGER
        : data.severity === 'WARN'
        ? DISCORD_COLORS.WARNING
        : data.severity === 'RESOLVED'
        ? DISCORD_COLORS.SUCCESS
        : DISCORD_COLORS.INFO;

    const fields: DiscordEmbedField[] = [
      { name: 'ระดับความรุนแรง', value: `\`${data.severity}\``, inline: true },
      {
        name: 'เวลาที่เกิดเหตุ',
        value: `<t:${Math.floor(nowMs / 1000)}:R>`,
        inline: true,
      },
    ];

    if (data.metadata) {
      const metaStrings = Object.entries(data.metadata)
        .slice(0, 10)
        .map(([k, v]) => `• ${k}: \`${typeof v === 'object' ? JSON.stringify(v) : v}\``);
      if (metaStrings.length > 0) {
        fields.push({
          name: 'ข้อมูลทางเทคนิค (Details)',
          value: metaStrings.join('\n'),
          inline: false,
        });
      }
    }

    const adminRoleId = this.config.get<string>('DISCORD_ADMIN_ROLE_ID');
    let mentionContent: string | undefined = undefined;
    if (data.severity === 'CRITICAL' && adminRoleId) {
      mentionContent = `<@&${adminRoleId}> [ALERT] ตรวจพบเหตุขัดข้องของระบบ!`;
    }

    return await this.sendEmbed(
      'system_alerts',
      {
        title: `[ระบบเฝ้าระวัง] ${data.title}`,
        description: data.message,
        color,
        fields,
      },
      'ops',
      mentionContent,
    );
  }

  /**
   * แจ้งเตือนอัปเดตไอดีไก่ตันกลับไปยังห้อง #kaitun-id, #web-stock-logs และ #web-orders พร้อมกัน
   */
  async notifyKaitunSync(
    action: 'SOLD' | 'AVAILABLE' | 'PASSWORD_UPDATED' | 'DETAILS_UPDATED',
    data: {
      username: string;
      details?: string;
      farmedMaps?: string;
      price?: string;
      actor?: string;
    },
  ) {
    const isSold = action === 'SOLD';
    const color = isSold
      ? DISCORD_COLORS.DANGER
      : action === 'PASSWORD_UPDATED'
      ? DISCORD_COLORS.WARNING
      : DISCORD_COLORS.SUCCESS;

    const title = isSold
      ? `[ขายไอดีสำเร็จ] บัญชี ${data.username} ถูกขายแล้ว`
      : action === 'PASSWORD_UPDATED'
      ? `[เปลี่ยนรหัสผ่าน] บัญชี ${data.username} มีการเปลี่ยนรหัสผ่าน`
      : `[อัปเดตไอดี] ข้อมูลบัญชี ${data.username} ถูกปรับปรุง`;

    const embedPayload = {
      title,
      description: `สถานะไอดี: ${
        isSold ? 'ขายแล้ว (SOLD)' : 'พร้อมขาย (AVAILABLE)'
      }\nอัปเดตจาก: ${data.actor || 'ระบบเว็บไซต์ KaiZort Store'}`,
      color,
      fields: [
        {
          name: 'ชื่อไอดี (Username)',
          value: `\`${data.username}\``,
          inline: true,
        },
        {
          name: 'สถานะการขาย',
          value: isSold ? '🔴 ขายแล้ว (Sold)' : '🟢 ยังไม่ขาย (Available)',
          inline: true,
        },
        {
          name: 'ราคา',
          value: data.price ? `\`${data.price}\`` : '-',
          inline: true,
        },
        {
          name: 'แมพที่ฟาร์ม',
          value: data.farmedMaps ? `\`${data.farmedMaps}\`` : 'ยังไม่ได้ระบุ',
          inline: false,
        },
        {
          name: 'รายละเอียดของในไอดี',
          value: data.details ? `\`\`\`${data.details}\`\`\`` : 'ยังไม่ได้ระบุ',
          inline: false,
        },
      ],
    };

    const tasks = [
      this.sendEmbed('kaitun_sync', embedPayload),
      this.sendEmbed('stocks', embedPayload),
    ];
    if (isSold) {
      tasks.push(
        this.sendEmbed('orders', {
          ...embedPayload,
          color: DISCORD_COLORS.SUCCESS,
          description: `บันทึกการขายไอดีไก่ตันเข้าระบบบัญชีร้านเรียบร้อยแล้ว\nดำเนินการโดย: ${
            data.actor || 'ระบบเว็บไซต์ KaiZort Store'
          }`,
        }),
      );
    }

    await Promise.allSettled(tasks);
  }

  /**
   * แจ้งเตือนออเดอร์ใหม่ (#web-orders, #web-stock-logs และ #kaitun-id)
   */
  async notifyOrderCreated(data: {
    orderNumber: string;
    username: string;
    productTitle: string;
    amount: number;
    stockSerial?: string;
    remainingStockCount?: number;
  }) {
    const embedPayload = {
      title: `[คำสั่งซื้อใหม่] เลขที่ ${data.orderNumber}`,
      description: `ลูกค้าสั่งซื้อและรับสินค้าสำเร็จทันที`,
      color: DISCORD_COLORS.SUCCESS,
      fields: [
        {
          name: 'เลขที่ออเดอร์',
          value: `\`${data.orderNumber}\``,
          inline: true,
        },
        { name: 'ผู้สั่งซื้อ', value: `\`${data.username}\``, inline: true },
        {
          name: 'ยอดชำระ',
          value: `${data.amount.toLocaleString()} บาท`,
          inline: true,
        },
        { name: 'สินค้าที่ซื้อ', value: data.productTitle, inline: false },
        {
          name: 'รหัสสินค้าในสต๊อกที่ส่งมอบ',
          value: data.stockSerial ? `\`${data.stockSerial}\`` : '-',
          inline: true,
        },
        {
          name: 'สต๊อกคงเหลือของสินค้านี้',
          value:
            data.remainingStockCount !== undefined
              ? `${data.remainingStockCount} ชิ้น`
              : '-',
          inline: true,
        },
      ],
    };

    await Promise.allSettled([
      this.sendEmbed('orders', embedPayload),
      this.sendEmbed('stocks', embedPayload),
      this.sendEmbed('kaitun_sync', embedPayload),
    ]);
  }

  /**
   * แจ้งเตือนการเติมเงิน (#web-topups)
   */
  async notifyTopupSubmitted(data: {
    username: string;
    amount: number;
    paymentMethod: string;
    slipRef?: string;
    slipUrl?: string;
  }) {
    const largeTopupThreshold = parseInt(
      this.config.get<string>('LARGE_TOPUP_AMOUNT') || '2000',
      10,
    );
    const isLarge = data.amount >= largeTopupThreshold;

    const fields: DiscordEmbedField[] = [
      { name: 'ผู้ใช้งาน', value: `\`${data.username}\``, inline: true },
      {
        name: 'จำนวนเงิน',
        value: `${data.amount.toLocaleString()} บาท`,
        inline: true,
      },
      { name: 'ช่องทาง', value: data.paymentMethod, inline: true },
      {
        name: 'เลขอ้างอิงสลิป',
        value: data.slipRef ? `\`${data.slipRef}\`` : 'ไม่มี',
        inline: false,
      },
    ];

    if (isLarge) {
      fields.push({
        name: 'ข้อสังเกต',
        value: `ตรวจพบยอดเติมเงินสูง (>= ${largeTopupThreshold.toLocaleString()} บาท) กรุณาตรวจสอบสลิปอย่างละเอียด`,
        inline: false,
      });
    }

    await this.sendEmbed('topups', {
      title: isLarge
        ? `[แจ้งโอนเงิน - ยอดเงินสูง] สมาชิก ${data.username} เติมเงิน ${data.amount.toLocaleString()} บาท`
        : `[แจ้งโอนเงิน] สมาชิก ${data.username} ส่งคำขอเติมเงิน`,
      color: isLarge ? DISCORD_COLORS.WARNING : DISCORD_COLORS.INFO,
      fields,
    });
  }

  /**
   * แจ้งเตือนการอนุมัติหรือปฏิเสธการเติมเงิน
   */
  async notifyTopupVerified(data: {
    username: string;
    amount: number;
    status: 'SUCCESS' | 'REJECTED';
    verifiedBy: string;
    reason?: string;
  }) {
    const isApproved = data.status === 'SUCCESS';
    await this.sendEmbed('topups', {
      title: isApproved
        ? `[อนุมัติเติมเงิน] สมาชิก ${data.username} เติมเงินสำเร็จ`
        : `[ปฏิเสธเติมเงิน] สมาชิก ${data.username} คำขอถูกปฏิเสธ`,
      color: isApproved ? DISCORD_COLORS.SUCCESS : DISCORD_COLORS.DANGER,
      fields: [
        { name: 'ผู้ใช้งาน', value: `\`${data.username}\``, inline: true },
        {
          name: 'จำนวนเงิน',
          value: `${data.amount.toLocaleString()} บาท`,
          inline: true,
        },
        {
          name: 'ผู้ดำเนินการ',
          value: `\`${data.verifiedBy}\``,
          inline: true,
        },
        ...(data.reason
          ? [{ name: 'สาเหตุ', value: data.reason, inline: false }]
          : []),
      ],
    });
  }

  /**
   * แจ้งเตือนสต๊อกสินค้า (#web-stock-logs และ #kaitun-id)
   */
  async notifyStockImport(data: {
    count: number;
    productTitle: string;
    batchCode?: string;
    supplierName?: string;
    usernames?: string[];
  }) {
    const fields: DiscordEmbedField[] = [
      { name: 'สินค้า', value: data.productTitle, inline: false },
      { name: 'จำนวนที่เพิ่ม', value: `${data.count} บัญชี`, inline: true },
      {
        name: 'รหัสล็อต (Batch)',
        value: data.batchCode ? `\`${data.batchCode}\`` : '-',
        inline: true,
      },
      {
        name: 'ซัพพลายเออร์',
        value: data.supplierName ? `\`${data.supplierName}\`` : '-',
        inline: true,
      },
    ];
    if (data.usernames && data.usernames.length > 0) {
      fields.push({
        name: 'รายชื่อไอดีที่เพิ่ม',
        value: data.usernames
          .slice(0, 15)
          .map((u) => `• \`${u}\``)
          .join('\n'),
        inline: false,
      });
    }

    await Promise.allSettled([
      this.sendEmbed('stocks', {
        title: `[เพิ่มสต๊อกใหม่จากเว็บ] นำเข้ารหัสจำนวน ${data.count} บัญชี`,
        color: DISCORD_COLORS.SUCCESS,
        fields,
      }),
      this.sendEmbed('kaitun_sync', {
        title: `[เว็บเพิ่มสต๊อกใหม่] นำเข้า ${data.count} บัญชี เข้าสู่คลัง`,
        description: `สินค้า: **${data.productTitle}**`,
        color: DISCORD_COLORS.SUCCESS,
        fields,
      }),
    ]);
  }

  /**
   * แจ้งเตือนการลบไอดีออกจากสต๊อก (#web-stock-logs และ #kaitun-id)
   */
  async notifyStockRemoved(data: {
    serialCode: string;
    username?: string;
    productTitle?: string;
  }) {
    const fields: DiscordEmbedField[] = [
      {
        name: 'ชื่อไอดี (Username)',
        value: `\`${data.username || '-'}\``,
        inline: true,
      },
      { name: 'Serial Code', value: `\`${data.serialCode}\``, inline: true },
      { name: 'สินค้า', value: data.productTitle || '-', inline: false },
    ];

    await Promise.allSettled([
      this.sendEmbed('stocks', {
        title: `[นำไอดีออกจากคลัง] ลบสต๊อก ${data.username || data.serialCode}`,
        color: DISCORD_COLORS.DANGER,
        fields,
      }),
      this.sendEmbed('kaitun_sync', {
        title: `[เว็บนำไอดีออก] บัญชี ${
          data.username || data.serialCode
        } ถูกลบออกจากสต๊อก`,
        color: DISCORD_COLORS.DANGER,
        fields,
      }),
    ]);
  }

  /**
   * แจ้งเตือนเมื่อสต็อกสินค้าเหลือน้อย (#stocks)
   */
  async notifyLowStock(data: {
    productTitle: string;
    code: string;
    remaining: number;
    threshold: number;
  }) {
    const alertKey = `low_stock_${data.code}`;
    const now = new Date();
    const nowMs = now.getTime();
    const cooldownMs = 60 * 60 * 1000; // 1 hour cooldown per product

    try {
      const existingState = await this.prisma.alertState.findUnique({
        where: { key: alertKey },
      });

      if (existingState?.mutedUntil && existingState.mutedUntil > now) {
        return;
      }

      if (existingState?.lastSentAt) {
        const elapsed = nowMs - existingState.lastSentAt.getTime();
        if (elapsed < cooldownMs) {
          return;
        }
      }

      await this.prisma.alertState.upsert({
        where: { key: alertKey },
        create: {
          key: alertKey,
          lastSentAt: now,
          metadata: { remaining: data.remaining, threshold: data.threshold },
        },
        update: {
          lastSentAt: now,
          metadata: { remaining: data.remaining, threshold: data.threshold },
        },
      });
    } catch {
      // In-memory fallback
      if (this.alertCooldownMap.has(alertKey)) {
        if (nowMs - this.alertCooldownMap.get(alertKey)! < cooldownMs) return;
      }
      this.alertCooldownMap.set(alertKey, nowMs);
    }

    const isDepleted = data.remaining <= 0;
    await this.sendEmbed('stocks', {
      title: isDepleted
        ? `[สินค้าหมดสต็อก] ${data.productTitle}`
        : `[เตือนสต็อกเหลือน้อย] ${data.productTitle}`,
      description: isDepleted
        ? `สินค้า SKU \`${data.code}\` ขณะนี้ไม่มีสินค้าในสต็อกแล้ว กรุณาลงของเพิ่มเติม`
        : `สินค้า SKU \`${data.code}\` เหลือเพียง ${data.remaining} ชิ้น (เกณฑ์เตือน: ${data.threshold} ชิ้น)`,
      color: isDepleted ? DISCORD_COLORS.DANGER : DISCORD_COLORS.WARNING,
      fields: [
        { name: 'สินค้า', value: data.productTitle, inline: true },
        { name: 'รหัส SKU', value: `\`${data.code}\``, inline: true },
        {
          name: 'จำนวนคงเหลือ',
          value: `${data.remaining} ชิ้น`,
          inline: true,
        },
      ],
    });
  }

  /**
   * แจ้งเตือนการจัดการหมวดหมู่และสินค้า (#web-catalog)
   */
  async notifyCatalogAction(data: {
    type: 'CATEGORY' | 'PRODUCT';
    action: 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED';
    name: string;
    code?: string;
    categoryName?: string;
    price?: number;
    stock?: number;
    status?: string;
  }) {
    const typeLabel = data.type === 'CATEGORY' ? 'หมวดหมู่' : 'สินค้า';
    const actionMap = {
      CREATED: { label: 'สร้างใหม่', color: DISCORD_COLORS.SUCCESS },
      UPDATED: { label: 'แก้ไขข้อมูล', color: DISCORD_COLORS.INFO },
      STATUS_CHANGED: { label: 'เปลี่ยนสถานะ', color: DISCORD_COLORS.WARNING },
      DELETED: { label: 'นำออก/ลบ', color: DISCORD_COLORS.DANGER },
    };
    const act = actionMap[data.action];

    const fields: DiscordEmbedField[] = [
      { name: `ชื่อ${typeLabel}`, value: `**${data.name}**`, inline: true },
    ];
    if (data.code) {
      fields.push({
        name: 'รหัส/Slug',
        value: `\`${data.code}\``,
        inline: true,
      });
    }
    if (data.categoryName) {
      fields.push({ name: 'หมวดหมู่', value: data.categoryName, inline: true });
    }
    if (data.price !== undefined) {
      fields.push({
        name: 'ราคา',
        value: `${data.price.toLocaleString()} บาท`,
        inline: true,
      });
    }
    if (data.stock !== undefined) {
      fields.push({
        name: 'สต็อกคงเหลือ',
        value: `${data.stock} ไอดี`,
        inline: true,
      });
    }
    if (data.status) {
      fields.push({
        name: 'สถานะ',
        value: `\`${data.status}\``,
        inline: true,
      });
    }

    await this.sendEmbed('catalog', {
      title: `[${act.label}${typeLabel}] ${data.name}`,
      color: act.color,
      fields,
    });
  }

  /**
   * แจ้งเตือนความปลอดภัย Audit Log (#web-tickets-audit)
   */
  async notifySecurityAudit(data: {
    action: string;
    actor: string;
    target: string;
    ipAddress?: string;
  }) {
    await this.sendEmbed('tickets_audit', {
      title: `[ความปลอดภัย] ${data.action}`,
      color: DISCORD_COLORS.WARNING,
      fields: [
        { name: 'ผู้กระทำรายการ', value: `\`${data.actor}\``, inline: true },
        { name: 'เป้าหมาย', value: `\`${data.target}\``, inline: true },
        {
          name: 'IP Address',
          value: data.ipAddress ? `\`${data.ipAddress}\`` : '-',
          inline: true,
        },
      ],
    });
  }

  /**
   * แจ้งเตือนตั๋วซัพพอร์ตใหม่ (#tickets_audit)
   */
  async notifyTicketCreated(data: {
    ticketId: string;
    username: string;
    subject: string;
    detail: string;
    orderId?: string;
  }) {
    const fields: DiscordEmbedField[] = [
      { name: 'ผู้เปิดคำร้อง', value: `\`${data.username}\``, inline: true },
      { name: 'หัวข้อ', value: data.subject, inline: true },
    ];
    if (data.orderId) {
      fields.push({
        name: 'อ้างอิงออเดอร์',
        value: `\`${data.orderId}\``,
        inline: true,
      });
    }
    fields.push({
      name: 'รายละเอียดปัญหา',
      value: `\`\`\`${data.detail.slice(0, 500)}\`\`\``,
      inline: false,
    });

    await this.sendEmbed('tickets_audit', {
      title: `[ตั๋วช่วยเหลือใหม่] รหัส ${data.ticketId.slice(0, 8)}`,
      description: 'มีลูกค้าเปิดตั๋วติดต่อทีมงาน กรุณาตรวจสอบและให้ความช่วยเหลือ',
      color: DISCORD_COLORS.WARNING,
      fields,
    });
  }

  /**
   * แจ้งเตือนการบันทึกหรือลบค่าใช้จ่ายร้าน (#kaitun-id และ #web-orders)
   */
  async notifyExpenseAction(
    action: 'CREATED' | 'DELETED',
    data: {
      title: string;
      category: string;
      amount: number;
      note?: string;
      actor?: string;
    },
  ) {
    const isCreated = action === 'CREATED';
    const categoryLabels: Record<string, string> = {
      SCRIPT: 'ค่าสคริปต์ฟาร์ม',
      VPS: 'ค่า VPS / เซิร์ฟเวอร์',
      ELECTRICITY: 'ค่าไฟ / ค่าฮาร์ดแวร์',
      BOT_HOST: 'ค่าโฮสต์บอท Discord',
      OTHER: 'รายจ่ายอื่นๆ',
    };
    const catLabel = categoryLabels[data.category] || data.category;
    const title = isCreated
      ? `[บันทึกค่าใช้จ่ายใหม่จากเว็บ] ${data.title}`
      : `[ลบรายการค่าใช้จ่ายจากเว็บ] ${data.title}`;
    const color = isCreated ? DISCORD_COLORS.WARNING : DISCORD_COLORS.DANGER;

    const fields: DiscordEmbedField[] = [
      { name: 'รายการค่าใช้จ่าย', value: `**${data.title}**`, inline: true },
      { name: 'หมวดหมู่', value: catLabel, inline: true },
      {
        name: 'จำนวนเงิน',
        value: `${Number(data.amount).toLocaleString('th-TH', {
          minimumFractionDigits: 2,
        })} บาท`,
        inline: true,
      },
    ];
    if (data.note) {
      fields.push({
        name: 'หมายเหตุ',
        value: `\`\`\`${data.note}\`\`\``,
        inline: false,
      });
    }
    fields.push({
      name: 'แหล่งที่มา',
      value: data.actor || 'แอดมินผ่านหน้าเว็บไซต์ (/admin/expense)',
      inline: false,
    });

    await Promise.allSettled([
      this.sendEmbed('kaitun_sync', {
        title,
        description: isCreated
          ? 'มีการบันทึกค่าใช้จ่ายร้านสำเร็จ และระบบได้หักลบออกจากกำไรสุทธิแท้จริงเรียบร้อยแล้ว'
          : 'มีการลบรายการค่าใช้จ่ายนี้ออกจากระบบบัญชีเรียบร้อยแล้ว',
        color,
        fields,
      }),
      this.sendEmbed('orders', {
        title,
        description: isCreated
          ? 'บันทึกค่าใช้จ่ายร้านสำเร็จ (Expense Ledger Log)'
          : 'ลบรายการค่าใช้จ่ายออกจากระบบบัญชี',
        color,
        fields,
      }),
      this.sendEmbed('stocks', {
        title,
        description: isCreated
          ? 'บันทึกค่าใช้จ่ายร้านสำเร็จ (Expense Audit Log)'
          : 'ลบรายการค่าใช้จ่ายออกจากระบบบัญชี',
        color,
        fields,
      }),
    ]);
  }

  /**
   * สรุปรายงานประจำวัน (#orders หรือ #catalog)
   */
  async notifyDailySummary(data: {
    dateStr: string;
    totalRevenue: number;
    orderCount: number;
    topupTotal: number;
    newUsersCount: number;
    totalExpense: number;
  }) {
    const netProfit = data.totalRevenue - data.totalExpense;
    await this.sendEmbed('orders', {
      title: `[สรุปยอดประจำวัน] ${data.dateStr}`,
      description: 'ภาพรวมรายรับ คำสั่งซื้อ และสมาชิกใหม่ประจำวัน',
      color: DISCORD_COLORS.PURPLE,
      fields: [
        {
          name: 'ยอดขายรวม',
          value: `${data.totalRevenue.toLocaleString()} บาท`,
          inline: true,
        },
        {
          name: 'จำนวนคำสั่งซื้อ',
          value: `${data.orderCount} รายการ`,
          inline: true,
        },
        {
          name: 'ยอดเติมเงินรวม',
          value: `${data.topupTotal.toLocaleString()} บาท`,
          inline: true,
        },
        {
          name: 'ค่าใช้จ่ายร้าน',
          value: `${data.totalExpense.toLocaleString()} บาท`,
          inline: true,
        },
        {
          name: 'กำไรสุทธิเบื้องต้น',
          value: `${netProfit.toLocaleString()} บาท`,
          inline: true,
        },
        {
          name: 'สมาชิกสมัครใหม่',
          value: `${data.newUsersCount} ท่าน`,
          inline: true,
        },
      ],
    });
  }
}
