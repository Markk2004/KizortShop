import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type WebhookChannelKey =
  | 'kaitun_sync'
  | 'orders'
  | 'topups'
  | 'stocks'
  | 'catalog'
  | 'members'
  | 'tickets_audit';

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbedPayload {
  title: string;
  description?: string;
  color?: number; // e.g. 0x10B981 (green), 0xEF4444 (red), 0xF59E0B (amber), 0x3B82F6 (blue)
  fields?: DiscordEmbedField[];
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
}

@Injectable()
export class DiscordWebhookService {
  private readonly logger = new Logger(DiscordWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ส่ง Discord Embed ไปยังช่องที่ระบุ (ค้นหา Webhook URL จาก WebhookChannelConfig ใน Supabase)
   */
  async sendEmbed(channelKey: WebhookChannelKey, embed: DiscordEmbedPayload): Promise<boolean> {
    try {
      const config = await this.prisma.webhookChannelConfig.findUnique({
        where: { channelKey },
      });

      if (!config || !config.isActive || !config.webhookUrl) {
        this.logger.debug(`Discord Webhook for channel '${channelKey}' is not configured or inactive`);
        return false;
      }

      const payload = {
        username: 'KaiZort System Log',
        avatar_url: 'https://qidraqabrlnuurnlkwko.supabase.co/storage/v1/object/public/assets/kaizort_logo.png',
        embeds: [
          {
            ...embed,
            timestamp: embed.timestamp || new Date().toISOString(),
            footer: embed.footer || { text: 'KaiZort Store • Web Notification' },
          },
        ],
      };

      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        this.logger.warn(`Failed to send Discord webhook [${channelKey}]: ${res.status} ${res.statusText}`);
        return false;
      }

      return true;
    } catch (err: any) {
      this.logger.error(`Error sending Discord webhook to [${channelKey}]: ${err.message}`, err.stack);
      return false;
    }
  }

  // --- Helper Methods for Specific Web Events ---

  /**
   * แจ้งเตือนอัปเดตไอดีไก่ตันกลับไปยังห้อง #kaitun-id (2-way sync notification)
   */
  async notifyKaitunSync(action: 'SOLD' | 'AVAILABLE' | 'PASSWORD_UPDATED' | 'DETAILS_UPDATED', data: {
    username: string;
    details?: string;
    farmedMaps?: string;
    price?: string;
    actor?: string;
  }) {
    const isSold = action === 'SOLD';
    const color = isSold ? 0xEF4444 : action === 'PASSWORD_UPDATED' ? 0xF59E0B : 0x10B981;
    const title = isSold
      ? `[เว็บขายแล้ว] บัญชี ${data.username} ถูกขายแล้ว`
      : action === 'PASSWORD_UPDATED'
      ? `[เว็บเปลี่ยนรหัสผ่าน] บัญชี ${data.username} มีการเปลี่ยนรหัสผ่าน`
      : `[เว็บอัปเดตไอดี] ข้อมูลบัญชี ${data.username} ถูกปรับปรุง`;

    await this.sendEmbed('kaitun_sync', {
      title,
      description: `สถานะไอดี: ${isSold ? 'ขายแล้ว (SOLD)' : 'พร้อมขาย (AVAILABLE)'}\nอัปเดตจาก: ${data.actor || 'ระบบเว็บไซต์ KaiZort Store'}`,
      color,
      fields: [
        { name: 'ชื่อไอดี (Username)', value: `\`${data.username}\``, inline: true },
        { name: 'สถานะการขาย', value: isSold ? 'ขายแล้ว' : 'ยังไม่ขาย', inline: true },
        { name: 'ราคา', value: data.price ? `\`${data.price}\`` : '-', inline: true },
        { name: 'แมพที่ฟาร์ม', value: data.farmedMaps ? `\`${data.farmedMaps}\`` : 'ยังไม่ได้ระบุ', inline: false },
        { name: 'รายละเอียดของในไอดี', value: data.details ? `\`\`\`${data.details}\`\`\`` : 'ยังไม่ได้ระบุ', inline: false },
      ],
    });
  }

  /**
   * แจ้งเตือนออเดอร์ใหม่ (#web-orders)
   */
  async notifyOrderCreated(data: {
    orderNumber: string;
    username: string;
    productTitle: string;
    amount: number;
    stockSerial?: string;
    remainingStockCount?: number;
  }) {
    await this.sendEmbed('orders', {
      title: `[คำสั่งซื้อใหม่] เลขที่ ${data.orderNumber}`,
      description: `ลูกค้าสั่งซื้อและรับสินค้าสำเร็จทันที`,
      color: 0x10B981,
      fields: [
        { name: 'เลขที่ออเดอร์', value: `\`${data.orderNumber}\``, inline: true },
        { name: 'ผู้สั่งซื้อ', value: `\`${data.username}\``, inline: true },
        { name: 'ยอดชำระ', value: `${data.amount.toLocaleString()} บาท`, inline: true },
        { name: 'สินค้าที่ซื้อ', value: data.productTitle, inline: false },
        { name: 'รหัสสินค้าในสต๊อกที่ส่งมอบ', value: data.stockSerial ? `\`${data.stockSerial}\`` : '-', inline: true },
        { name: 'สต๊อกคงเหลือของสินค้านี้', value: data.remainingStockCount !== undefined ? `${data.remainingStockCount} ชิ้น` : '-', inline: true },
      ],
    });
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
    await this.sendEmbed('topups', {
      title: `[แจ้งโอนเงิน] สมาชิก ${data.username} ส่งคำขอเติมเงิน`,
      color: 0x3B82F6,
      fields: [
        { name: 'ผู้ใช้งาน', value: `\`${data.username}\``, inline: true },
        { name: 'จำนวนเงิน', value: `${data.amount.toLocaleString()} บาท`, inline: true },
        { name: 'ช่องทาง', value: data.paymentMethod, inline: true },
        { name: 'เลขอ้างอิงสลิป', value: data.slipRef ? `\`${data.slipRef}\`` : 'ไม่มี', inline: false },
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
      { name: 'รหัสล็อต (Batch)', value: data.batchCode ? `\`${data.batchCode}\`` : '-', inline: true },
      { name: 'ซัพพลายเออร์', value: data.supplierName ? `\`${data.supplierName}\`` : '-', inline: true },
    ];
    if (data.usernames && data.usernames.length > 0) {
      fields.push({
        name: 'รายชื่อไอดีที่เพิ่ม',
        value: data.usernames.slice(0, 15).map((u) => `• \`${u}\``).join('\n'),
        inline: false,
      });
    }

    await this.sendEmbed('stocks', {
      title: `[เพิ่มสต๊อกใหม่จากเว็บ] นำเข้ารหัสจำนวน ${data.count} บัญชี`,
      color: 0x10B981,
      fields,
    });

    await this.sendEmbed('kaitun_sync', {
      title: `[เว็บเพิ่มสต๊อกใหม่] นำเข้า ${data.count} บัญชี เข้าสู่คลัง`,
      description: `สินค้า: **${data.productTitle}**`,
      color: 0x10B981,
      fields,
    });
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
      { name: 'ชื่อไอดี (Username)', value: `\`${data.username || '-'}\``, inline: true },
      { name: 'Serial Code', value: `\`${data.serialCode}\``, inline: true },
      { name: 'สินค้า', value: data.productTitle || '-', inline: false },
    ];

    await this.sendEmbed('stocks', {
      title: `[นำไอดีออกจากคลัง] ลบสต๊อก ${data.username || data.serialCode}`,
      color: 0xEF4444,
      fields,
    });

    await this.sendEmbed('kaitun_sync', {
      title: `[เว็บนำไอดีออก] บัญชี ${data.username || data.serialCode} ถูกลบออกจากสต๊อก`,
      color: 0xEF4444,
      fields,
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
      CREATED: { label: 'สร้างใหม่', color: 0x10B981 },
      UPDATED: { label: 'แก้ไขข้อมูล', color: 0x3B82F6 },
      STATUS_CHANGED: { label: 'เปลี่ยนสถานะ', color: 0xF59E0B },
      DELETED: { label: 'นำออก/ลบ', color: 0xEF4444 },
    };
    const act = actionMap[data.action];

    const fields: DiscordEmbedField[] = [
      { name: `ชื่อ${typeLabel}`, value: `**${data.name}**`, inline: true },
    ];
    if (data.code) {
      fields.push({ name: 'รหัส/Slug', value: `\`${data.code}\``, inline: true });
    }
    if (data.categoryName) {
      fields.push({ name: 'หมวดหมู่', value: data.categoryName, inline: true });
    }
    if (data.price !== undefined) {
      fields.push({ name: 'ราคา', value: `฿${data.price.toLocaleString()}`, inline: true });
    }
    if (data.stock !== undefined) {
      fields.push({ name: 'สต็อกคงเหลือ', value: `${data.stock} ไอดี`, inline: true });
    }
    if (data.status) {
      fields.push({ name: 'สถานะ', value: `\`${data.status}\``, inline: true });
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
      color: 0xF59E0B,
      fields: [
        { name: 'ผู้กระทำรายการ', value: `\`${data.actor}\``, inline: true },
        { name: 'เป้าหมาย', value: `\`${data.target}\``, inline: true },
        { name: 'IP Address', value: data.ipAddress ? `\`${data.ipAddress}\`` : '-', inline: true },
      ],
    });
  }

  /**
   * แจ้งเตือนการบันทึกหรือลบค่าใช้จ่ายร้าน (#kaitun-id และ #web-orders)
   */
  async notifyExpenseAction(action: 'CREATED' | 'DELETED', data: {
    title: string;
    category: string;
    amount: number;
    note?: string;
    actor?: string;
  }) {
    const isCreated = action === 'CREATED';
    const categoryLabels: Record<string, string> = {
      SCRIPT: 'ค่าสคริปต์ฟาร์ม 📜',
      VPS: 'ค่า VPS / เซิร์ฟเวอร์ 💻',
      ELECTRICITY: 'ค่าไฟ / ค่าฮาร์ดแวร์ ⚡',
      BOT_HOST: 'ค่าโฮสต์บอท Discord 🤖',
      OTHER: 'รายจ่ายอื่นๆ 📦',
    };
    const catLabel = categoryLabels[data.category] || data.category;
    const title = isCreated
      ? `💸 [บันทึกค่าใช้จ่ายใหม่จากเว็บ] ${data.title}`
      : `🗑️ [ลบรายการค่าใช้จ่ายจากเว็บ] ${data.title}`;
    const color = isCreated ? 0xF59E0B : 0xEF4444;

    const fields: DiscordEmbedField[] = [
      { name: 'รายการค่าใช้จ่าย', value: `**${data.title}**`, inline: true },
      { name: 'หมวดหมู่', value: catLabel, inline: true },
      { name: 'จำนวนเงิน', value: `**฿${Number(data.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}**`, inline: true },
    ];
    if (data.note) {
      fields.push({ name: 'หมายเหตุ', value: `\`\`\`${data.note}\`\`\``, inline: false });
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
    ]);
  }
}
