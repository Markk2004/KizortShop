import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DiscordOutboxService } from '../../common/discord/discord-outbox.service';
import { HealthService } from '../health/health.service';
import { DISCORD_COLORS } from '../../common/discord/discord.constants';
import { DiscordWebhookService } from '../../common/webhook/discord-webhook.service';
import { AdminGuardService } from './admin-guard.service';
import { AdminAuditService } from './admin-audit.service';
import {
  encryptCredentialAes256Gcm,
  decryptCredentialAes256Gcm,
  inspectAndHashCredential,
  CredentialFormat,
} from '../../common/crypto/stock-crypto.util';
import * as nacl from 'tweetnacl';

@Injectable()
export class DiscordInteractionsService {
  private readonly logger = new Logger(DiscordInteractionsService.name);
  private readonly encryptionSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: DiscordOutboxService,
    private readonly healthService: HealthService,
    private readonly config: ConfigService,
    private readonly adminGuard: AdminGuardService,
    private readonly adminAudit: AdminAuditService,
    private readonly discordWebhook: DiscordWebhookService,
  ) {
    this.encryptionSecret =
      this.config.get<string>('STOCK_ENCRYPTION_SECRET') ||
      process.env.STOCK_ENCRYPTION_SECRET ||
      'kaizort-vault-default-secret-salt-2026';
  }

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
    if (!adminRoleId) return true;

    const userRoles = interaction?.member?.roles || [];
    if (userRoles.includes(adminRoleId)) return true;

    const permissions = BigInt(interaction?.member?.permissions || '0');
    if ((permissions & BigInt(0x8)) === BigInt(0x8)) return true;

    return false;
  }

  /**
   * Dispatch interaction command
   */
  async handleCommand(interaction: any): Promise<any> {
    const { name, options } = interaction.data;

    // Dual-Layer Permission Guard (ID Allowlist + Admin Role)
    const auth = await this.adminGuard.verifyAdmin(interaction, `/${name}`);
    if (!auth.allowed) {
      return {
        type: 4,
        data: {
          flags: 64,
          content: auth.reason || '[Access Denied] เฉพาะผู้ดูแลระบบที่ได้รับอนุญาตเท่านั้น',
        },
      };
    }

    const optionsMap = (options || []).reduce((acc: any, cur: any) => {
      acc[cur.name] = cur.value;
      return acc;
    }, {});

    try {
      switch (name) {
        case 'ping':
          return this.handlePing();
        case 'admin':
          return await this.handleAdminHub(interaction, false);
        case 'web':
          return await this.handleWebCheck();
        case 'status':
          return await this.handleStatusCheck();
        case 'stock':
          return await this.handleNavStock(interaction, undefined, 'all');
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
          content: `[ข้อผิดพลาด] ไม่สามารถประมวลผลคำสั่ง /${name} ได้: ${err.message || 'เกิดข้อผิดพลาดภายในระบบ'}`,
        },
      };
    }
  }

  /**
   * Dispatch interaction component clicks (Buttons & Select Menus)
   */
  async handleComponent(interaction: any): Promise<any> {
    const customId = interaction.data?.custom_id || '';

    // Guard all admin component actions (adm:*)
    if (customId.startsWith('adm:')) {
      const auth = await this.adminGuard.verifyAdmin(interaction, customId);
      if (!auth.allowed) {
        return {
          type: 4,
          data: {
            flags: 64,
            content: auth.reason || '[Access Denied] ปฏิเสธการเข้าถึงฟังก์ชันแอดมิน',
          },
        };
      }
    }

    try {
      // 1. Navigation Routes
      if (customId === 'adm:nav:hub') {
        return await this.handleAdminHub(interaction, true);
      }
      if (customId === 'adm:nav:stock') {
        return await this.handleNavStock(interaction);
      }
      if (customId === 'adm:nav:expense') {
        return await this.handleNavExpense(interaction);
      }
      if (customId === 'adm:nav:topups') {
        return await this.handleNavTopups(interaction);
      }
      if (customId === 'adm:nav:orders') {
        return await this.handleNavOrders(interaction);
      }
      if (customId === 'adm:nav:summary') {
        return await this.handleNavSummary(interaction, 'today');
      }
      if (customId === 'adm:nav:pybot') {
        return await this.handleNavPybot(interaction);
      }

      // 2. Summary Filters
      if (customId === 'adm:summary:today') return await this.handleNavSummary(interaction, 'today');
      if (customId === 'adm:summary:week') return await this.handleNavSummary(interaction, 'week');
      if (customId === 'adm:summary:month') return await this.handleNavSummary(interaction, 'month');

      // 3. Stock Actions
      if (customId === 'adm:stock:filter_product') {
        const selectedSku = interaction.data?.values?.[0];
        return await this.handleNavStock(interaction, selectedSku, 'all');
      }
      if (customId.startsWith('adm:stock:status:')) {
        const parts = customId.split(':');
        const stFilter = parts[3] || 'all';
        const pCode = parts[4] && parts[4] !== 'ALL' ? parts[4] : undefined;
        return await this.handleNavStock(interaction, pCode, stFilter);
      }
      if (customId === 'adm:stock:open_search') {
        return this.renderSearchStockModal();
      }
      if (customId === 'adm:stock:open_add') {
        return this.renderAddStockModal();
      }
      if (customId === 'adm:stock:list' || customId.startsWith('adm:stock:list:')) {
        const prodId = customId.startsWith('adm:stock:list:') ? customId.split(':')[3] : undefined;
        return await this.handleNavStock(interaction, prodId, 'all');
      }
      if (customId.startsWith('adm:stock:open_edit:')) {
        const stockId = customId.split(':')[3];
        return await this.handleStockOpenEdit(interaction, stockId);
      }
      if (customId.startsWith('adm:stock:confirm_del:')) {
        const stockId = customId.split(':')[3];
        return await this.handleStockConfirmDelete(interaction, stockId);
      }
      if (customId.startsWith('adm:stock:do_del:')) {
        const stockId = customId.split(':')[3];
        return await this.handleStockDoDelete(interaction, stockId);
      }

      // 4. Expense Actions
      if (customId === 'adm:expense:select') {
        const selectedExpId = interaction.data?.values?.[0];
        return await this.handleNavExpense(interaction, selectedExpId);
      }
      if (customId === 'adm:expense:open_add') {
        return this.renderAddExpenseModal();
      }
      if (customId === 'adm:expense:open_edit_latest') {
        return await this.handleExpenseOpenEditLatest(interaction);
      }
      if (customId.startsWith('adm:expense:open_edit:')) {
        const expId = customId.split(':')[3];
        return await this.handleExpenseOpenEdit(interaction, expId);
      }
      if (customId === 'adm:expense:confirm_del_latest') {
        return await this.handleExpenseConfirmDeleteLatest(interaction);
      }
      if (customId.startsWith('adm:expense:confirm_del:')) {
        const expId = customId.split(':')[3];
        return await this.handleExpenseConfirmDelete(interaction, expId);
      }
      if (customId.startsWith('adm:expense:do_del:')) {
        const expId = customId.split(':')[3];
        return await this.handleExpenseDoDelete(interaction, expId);
      }

      // 5. Topup Actions
      if (customId === 'adm:topup:select') {
        const selectedTopupId = interaction.data?.values?.[0];
        return await this.handleNavTopups(interaction, selectedTopupId);
      }
      if (customId.startsWith('adm:topup:approve:')) {
        const topupId = customId.split(':')[3];
        return await this.handleTopupApprove(interaction, topupId);
      }
      if (customId.startsWith('adm:topup:open_reject:')) {
        const topupId = customId.split(':')[3];
        return this.renderRejectTopupModal(topupId);
      }

      // 6. Order Actions
      if (customId === 'adm:order:select') {
        const selectedId = interaction.data?.values?.[0];
        return await this.handleNavOrders(interaction, selectedId);
      }
      if (customId === 'adm:order:open_search') {
        return this.renderSearchOrderModal();
      }
      if (customId.startsWith('adm:order:view:')) {
        const orderId = customId.split(':')[3];
        return await this.handleOrderView(interaction, orderId);
      }
      if (customId.startsWith('adm:order:confirm_refund:')) {
        const orderId = customId.split(':')[3];
        return await this.handleOrderConfirmRefund(interaction, orderId);
      }
      if (customId.startsWith('adm:order:do_refund:')) {
        const orderId = customId.split(':')[3];
        return await this.handleOrderDoRefund(interaction, orderId);
      }
      if (customId.startsWith('adm:order:confirm_cancel:')) {
        const orderId = customId.split(':')[3];
        return await this.handleOrderConfirmCancel(interaction, orderId);
      }
      if (customId.startsWith('adm:order:do_cancel:')) {
        const orderId = customId.split(':')[3];
        return await this.handleOrderDoCancel(interaction, orderId);
      }
      if (customId.startsWith('adm:order:confirm_resend:')) {
        const orderId = customId.split(':')[3];
        return await this.handleOrderConfirmResend(interaction, orderId);
      }
      if (customId.startsWith('adm:order:do_resend:')) {
        const orderId = customId.split(':')[3];
        return await this.handleOrderDoResend(interaction, orderId);
      }

      return {
        type: 4,
        data: { flags: 64, content: `ไม่รองรับการทำงานของปุ่ม (${customId})` },
      };
    } catch (err: any) {
      this.logger.error(`Error handling component ${customId}: ${err.message}`, err.stack);
      return {
        type: 4,
        data: { flags: 64, content: `เกิดข้อผิดพลาดในการประมวลผล: ${err.message}` },
      };
    }
  }

  /**
   * Dispatch interaction modal submissions (Form submissions)
   */
  async handleModalSubmit(interaction: any): Promise<any> {
    const customId = interaction.data?.custom_id || '';

    const auth = await this.adminGuard.verifyAdmin(interaction, `modal:${customId}`);
    if (!auth.allowed) {
      return {
        type: 4,
        data: { flags: 64, content: auth.reason || '[Access Denied] ปฏิเสธการบันทึกข้อมูล' },
      };
    }

    try {
      if (customId === 'adm:stock:submit_add') {
        return await this.handleModalSubmitAddStock(interaction);
      }
      if (customId === 'adm:stock:submit_search') {
        return await this.handleModalSubmitSearchStock(interaction);
      }
      if (customId.startsWith('adm:stock:submit_edit:')) {
        const stockId = customId.split(':')[3];
        return await this.handleModalSubmitEditStock(interaction, stockId);
      }
      if (customId === 'adm:expense:submit_add') {
        return await this.handleModalSubmitAddExpense(interaction);
      }
      if (customId.startsWith('adm:expense:submit_edit:')) {
        const expId = customId.split(':')[3];
        return await this.handleModalSubmitEditExpense(interaction, expId);
      }
      if (customId.startsWith('adm:topup:submit_reject:')) {
        const topupId = customId.split(':')[3];
        return await this.handleModalSubmitRejectTopup(interaction, topupId);
      }
      if (customId === 'adm:order:submit_search') {
        return await this.handleModalSubmitSearchOrder(interaction);
      }

      return {
        type: 4,
        data: { flags: 64, content: `ไม่พบตัวประมวลผลสำหรับ Modal (${customId})` },
      };
    } catch (err: any) {
      this.logger.error(`Error processing modal ${customId}: ${err.message}`, err.stack);
      return {
        type: 4,
        data: { flags: 64, content: `เกิดข้อผิดพลาดในการบันทึกฟอร์ม: ${err.message}` },
      };
    }
  }

  // ============================================================================
  // WAKE-UP HINT HELPERS
  // ============================================================================

  /**
   * Warm-up notice: shown when the server just woke from sleep (free hosting)
   */
  private warmupHint(): string | null {
    const up = Math.floor(process.uptime());
    if (up < 180) {
      return `⏳ เซิร์ฟเวอร์เพิ่งตื่น (${up} วินาทีที่แล้ว) หากคำสั่งก่อนหน้าไม่ตอบสนอง ให้รอ 5–10 วินาทีแล้วลองพิมพ์ใหม่`;
    }
    return null;
  }

  /**
   * /ping : lightweight wake-up / liveness check
   */
  private handlePing() {
    const up = Math.floor(process.uptime());
    return {
      type: 4,
      data: {
        flags: 64,
        content: `🏓 Pong! ระบบพร้อมใช้งาน (uptime ${up} วินาที)${
          up < 180 ? '\n⏳ เพิ่งตื่นจากหลับ พิมพ์ /admin ได้เลย' : ''
        }`,
      },
    };
  }

  // ============================================================================
  // UNIFIED ADMIN HUB & INTERACTIVE VIEWS
  // ============================================================================

  /**
   * Main Admin Hub Screen (/admin)
   */
  private async handleAdminHub(interaction: any, isUpdate: boolean = false) {
    const allowedChannelId =
      this.config.get<string>('DISCORD_ADMIN_PANEL_CHANNEL_ID') ||
      process.env.DISCORD_ADMIN_PANEL_CHANNEL_ID;
    if (
      allowedChannelId &&
      allowedChannelId.trim() !== '' &&
      interaction?.channel_id &&
      interaction.channel_id !== allowedChannelId.trim()
    ) {
      return {
        type: 4,
        data: {
          flags: 64,
          content: `⚠️ กรุณาใช้งานคำสั่ง \`/admin\` ในห้อง <#${allowedChannelId.trim()}> เท่านั้น`,
        },
      };
    }

    const [availableStockCount, pendingTopupsCount, recentOrdersCount, monthExpenses] =
      await Promise.all([
        this.prisma.accountStock.count({ where: { status: 'AVAILABLE' } }),
        this.prisma.topupTransaction.count({ where: { status: 'PENDING_VERIFY' } }),
        this.prisma.order.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
        this.prisma.expense.aggregate({
          where: {
            paidAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          _sum: { amount: true },
        }),
      ]);

    const user = this.adminGuard.extractUser(interaction);

    await this.adminAudit.log({
      action: 'ADMIN_HUB_ACCESS',
      targetType: 'ADMIN_PANEL',
      actorDiscordId: user.id,
      actorUsername: user.username,
      metadata: { isUpdate },
    });

    const embed = {
      title: '🛡️ KaiZort Admin Control Hub',
      description:
        'ศูนย์รวมการบริหารและควบคุมระบบร้านค้าแบบรวมศูนย์ (Admin Control Panel)\nกดเลือกปุ่มเมนูด้านล่างเพื่อจัดการสต็อก ค่าใช้จ่าย สลิปเติมเงิน หรือออเดอร์ได้ทันที',
      color: DISCORD_COLORS.INFO,
      fields: [
        {
          name: '📦 สต็อกพร้อมขาย',
          value: `**${availableStockCount.toLocaleString()}** ชิ้น`,
          inline: true,
        },
        {
          name: '💳 สลิปรอตรวจ',
          value:
            pendingTopupsCount > 0
              ? `⚠️ **${pendingTopupsCount}** รายการ (ต้องตรวจ)`
              : '✅ ไม่มีค้าง',
          inline: true,
        },
        {
          name: '🛒 ออเดอร์ 24 ชม.',
          value: `**${recentOrdersCount}** รายการ`,
          inline: true,
        },
        {
          name: '💸 รายจ่ายเดือนนี้',
          value: `฿${Number(monthExpenses._sum.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
          inline: true,
        },
        {
          name: '👤 แอดมินผู้ใช้งาน',
          value: `${user.globalName} (<@${user.id}>)`,
          inline: true,
        },
        {
          name: '🔒 ระดับความปลอดภัย',
          value: '`ID Allowlist + Admin Role Guarded`',
          inline: true,
        },
      ],
      footer: { text: 'KaiZort Admin System • Secure Monorepo' },
      timestamp: new Date().toISOString(),
    };

    const components = [
      {
        type: 1, // Action Row 1
        components: [
          {
            type: 2,
            style: 1, // Primary (Blurple)
            label: '📦 คลังสต็อก',
            custom_id: 'adm:nav:stock',
          },
          {
            type: 2,
            style: 1,
            label: '💸 รายจ่าย/บัญชี',
            custom_id: 'adm:nav:expense',
          },
          {
            type: 2,
            style: pendingTopupsCount > 0 ? 4 : 1, // Danger if pending, Primary otherwise
            label: `💳 ตรวจสลิป (${pendingTopupsCount})`,
            custom_id: 'adm:nav:topups',
          },
          {
            type: 2,
            style: 1,
            label: '🛒 ออเดอร์ล่าสุด',
            custom_id: 'adm:nav:orders',
          },
        ],
      },
      {
        type: 1, // Action Row 2
        components: [
          {
            type: 2,
            style: 2, // Secondary (Grey)
            label: '📊 สรุปยอดธุรกิจ',
            custom_id: 'adm:nav:summary',
          },
          {
            type: 2,
            style: 2,
            label: '🤖 ฟอร์มบอท Python',
            custom_id: 'adm:nav:pybot',
          },
          {
            type: 2,
            style: 2,
            label: '🔄 รีเฟรชสถานะ',
            custom_id: 'adm:nav:hub',
          },
        ],
      },
    ];

    return {
      type: isUpdate ? 7 : 4, // 7: UPDATE_MESSAGE, 4: CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        flags: 64, // Ephemeral to protect privacy
        content: this.warmupHint() || undefined,
        embeds: [embed],
        components,
      },
    };
  }

  /**
   * Python Bot Shortcut & Guide (adm:nav:pybot)
   */
  private async handleNavPybot(interaction: any) {
    const embed = {
      title: '🤖 ฟอร์มและคำสั่งบอท Python (KaiZort Support)',
      description:
        'ระบบทำงานร่วมกันแบบ Hybrid ระหว่าง **KaiZort Admin (`/admin`)** และบอท Python **KaiZort Support** โดยคุณสามารถเลือกใช้ช่องทางที่ถนัดได้ทันที:',
      color: DISCORD_COLORS.PURPLE,
      fields: [
        {
          name: '📦 ฟอร์มจัดการไอดีไก่ตัน & รายจ่าย (บอท Python)',
          value:
            '• ห้อง `#kaitun-id`: ใช้ปุ่มฟอร์มของบอท Python สำหรับลงขายไอดีไก่ตัน เปลี่ยนรหัสผ่าน หรือบันทึกรายจ่ายฟาร์ม\n• ข้อมูลจะซิงค์เข้าฐานข้อมูลเดียวกันกับ `/admin` อัตโนมัติแบบ Real-time',
          inline: false,
        },
        {
          name: '🔑 คำสั่งระบบคีย์และการช่วยเหลือ (Slash Commands)',
          value:
            '• `/getkey` — รับคีย์ใหม่พร้อมปุ่ม Copy Key\n• `/process link:<url>` — ประมวลผลลิงก์จากระบบพาร์ทเนอร์\n• `/redeem key:<key>` — ตรวจสอบและยืนยันการใช้งานคีย์\n• `/ask message:<ข้อความ>` — สอบถามข้อมูลจากบอท\n• `/help` — เปิดคู่มือการใช้งานบอท Python',
          inline: false,
        },
      ],
      footer: { text: 'KaiZort Support (Python Bot) • Co-existence Mode' },
      timestamp: new Date().toISOString(),
    };

    return {
      type: 7,
      data: {
        embeds: [embed],
        components: [
          {
            type: 1,
            components: [
              { type: 2, style: 1, label: '📦 ไปหน้าคลังสต็อก', custom_id: 'adm:nav:stock' },
              { type: 2, style: 1, label: '💸 ไปหน้ารายจ่าย', custom_id: 'adm:nav:expense' },
              { type: 2, style: 2, label: '🔙 กลับหน้าหลัก Admin', custom_id: 'adm:nav:hub' },
            ],
          },
        ],
      },
    };
  }

  /**
   * Helper: Safely extract/decrypt password for spoiler display
   */
  private extractPassword(cipherPayload?: string | null): string {
    if (!cipherPayload) return '';
    try {
      let plain = cipherPayload;
      if (plain.includes(':') && plain.split(':').length === 3) {
        plain = decryptCredentialAes256Gcm(plain, this.encryptionSecret);
      }
      if (plain.includes('|')) {
        const parts = plain.split('|');
        return parts[1]?.trim() || parts[0]?.trim();
      }
      if (plain.includes(':')) {
        const parts = plain.split(':');
        return parts[1]?.trim() || parts[0]?.trim();
      }
      return plain.trim();
    } catch {
      return '';
    }
  }

  /**
   * Stock Manager View (adm:nav:stock) — Formatted like /stock_list with Decrypted Passwords in Spoiler Tags
   */
  private async handleNavStock(
    interaction: any,
    selectedProductCode?: string,
    statusFilter: string = 'all',
  ) {
    const user = this.adminGuard.extractUser(interaction);

    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            stocks: {
              where: { status: 'AVAILABLE' },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const isFiltered = Boolean(selectedProductCode && selectedProductCode !== 'ALL');
    const filteredProduct = isFiltered
      ? products.find((p) => p.code === selectedProductCode || p.id === selectedProductCode)
      : null;

    // Build where condition for account stocks query
    const stockWhere: any = {};
    if (filteredProduct) {
      stockWhere.productId = filteredProduct.id;
    }
    if (statusFilter === 'unsold') {
      stockWhere.status = 'AVAILABLE';
    } else if (statusFilter === 'sold') {
      stockWhere.status = 'SOLD';
    }

    const [totalStats, availableStats, soldStats, accounts] = await Promise.all([
      this.prisma.accountStock.count(
        filteredProduct ? { where: { productId: filteredProduct.id } } : undefined,
      ),
      this.prisma.accountStock.count({
        where: {
          status: 'AVAILABLE',
          ...(filteredProduct ? { productId: filteredProduct.id } : {}),
        },
      }),
      this.prisma.accountStock.count({
        where: {
          status: 'SOLD',
          ...(filteredProduct ? { productId: filteredProduct.id } : {}),
        },
      }),
      this.prisma.accountStock.findMany({
        where: stockWhere,
        include: { product: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    const lines: string[] = [];
    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      const isSold = acc.status === 'SOLD' || Boolean(acc.soldAt);
      const statusIcon = isSold ? '🔴' : '🟢';
      const statusLabel = isSold ? 'ขายแล้ว' : 'พร้อมขาย';
      const password = this.extractPassword(acc.credentials);
      const passStr = password ? ` | รหัส: ||\`${password}\`||` : '';
      const mapStr = acc.farmedMaps ? ` • 🗺️ \`${acc.farmedMaps}\`` : '';
      const priceVal = acc.product?.price || acc.sellingPriceText;
      const priceStr = priceVal ? ` • 💰 ฿${Number(priceVal)}` : '';
      const displayName = acc.username || acc.maskedIdentity || acc.serialCode;
      lines.push(
        `\`${i + 1}.\` ${statusIcon} **[${statusLabel}]** **${displayName}**${passStr}${mapStr}${priceStr}`,
      );
    }

    const title =
      statusFilter === 'all'
        ? '📋 รายการคลังสต็อกสินค้าทั้งหมด (Stock Manager: All)'
        : statusFilter === 'unsold'
        ? '🟢 รายการคลังสต็อกสินค้าพร้อมขาย (Stock Manager: Available)'
        : '📜 ประวัติคลังสต็อกสินค้าที่ขายแล้ว (Stock Manager: Sold)';

    const color =
      statusFilter === 'all'
        ? DISCORD_COLORS.INFO
        : statusFilter === 'unsold'
        ? DISCORD_COLORS.SUCCESS
        : DISCORD_COLORS.DANGER;

    const filterProductHeader = filteredProduct
      ? `🔍 **สินค้า:** **${filteredProduct.title}** (\`${filteredProduct.code}\`) | ราคา ฿${Number(filteredProduct.price)}\n\n`
      : '';

    const description = `${filterProductHeader}${
      lines.length > 0 ? lines.join('\n') : '📦 ไม่พบรายการไอดีตามเงื่อนไขที่เลือกในระบบ'
    }`;

    const embed = {
      title,
      description,
      color,
      fields: [
        { name: '📦 รวมทั้งหมด', value: `\`${totalStats}\` บัญชี`, inline: true },
        { name: '🟢 พร้อมขาย', value: `\`${availableStats}\` บัญชี`, inline: true },
        { name: '🔴 ขายแล้ว', value: `\`${soldStats}\` บัญชี`, inline: true },
      ],
      footer: {
        text: `แสดง ${accounts.length} รายการล่าสุด • คลิกที่แถบดำ ||...|| เพื่อเปิดดูรหัสผ่าน • ตรวจสอบโดย ${user.username}`,
      },
      timestamp: new Date().toISOString(),
    };

    const filterOptions = [
      {
        label: '📦 สินค้าทั้งหมด (All Products)',
        value: 'ALL',
        description: 'แสดงรายการสต็อกของสินค้าทุกชนิด',
        default: !isFiltered,
      },
      ...products.slice(0, 24).map((p) => ({
        label: `${p.title} (${p.code})`.slice(0, 100),
        value: p.code,
        description: `คงเหลือ ${p._count.stocks} ชิ้น | ฿${Number(p.price)}`.slice(0, 100),
        default: filteredProduct?.id === p.id,
      })),
    ];

    const currentProductVal = filteredProduct?.code || 'ALL';

    const components: any[] = [
      {
        type: 1, // Action Row 1: Filter Select Menu
        components: [
          {
            type: 3, // STRING_SELECT
            custom_id: 'adm:stock:filter_product',
            placeholder: 'เลือกสินค้าที่ต้องการกรองดูสต็อก...',
            options: filterOptions,
          },
        ],
      },
      {
        type: 1, // Action Row 2: Status View Toggle Buttons
        components: [
          {
            type: 2,
            style: statusFilter === 'all' ? 1 : 2,
            label: '📦 ทั้งหมด',
            custom_id: `adm:stock:status:all:${currentProductVal}`,
          },
          {
            type: 2,
            style: statusFilter === 'unsold' ? 3 : 2,
            label: '🟢 เฉพาะพร้อมขาย',
            custom_id: `adm:stock:status:unsold:${currentProductVal}`,
          },
          {
            type: 2,
            style: statusFilter === 'sold' ? 4 : 2,
            label: '🔴 เฉพาะขายแล้ว',
            custom_id: `adm:stock:status:sold:${currentProductVal}`,
          },
          {
            type: 2,
            style: 2,
            label: '🔄 รีเฟรช',
            custom_id: `adm:stock:status:${statusFilter}:${currentProductVal}`,
          },
        ],
      },
      {
        type: 1, // Action Row 3: Main Action Buttons
        components: [
          {
            type: 2,
            style: 3, // Success (Green)
            label: '➕ เพิ่มสต็อก (Bulk Modal)',
            custom_id: 'adm:stock:open_add',
          },
          {
            type: 2,
            style: 1, // Primary (Blurple)
            label: '🔎 ค้นหาสต็อก',
            custom_id: 'adm:stock:open_search',
          },
          {
            type: 2,
            style: 2,
            label: '🤖 ฟอร์มบอท Python',
            custom_id: 'adm:nav:pybot',
          },
        ],
      },
      {
        type: 1, // Action Row 4: Back to Hub
        components: [
          {
            type: 2,
            style: 2,
            label: '🔙 กลับหน้าหลัก Admin',
            custom_id: 'adm:nav:hub',
          },
        ],
      },
    ];

    const isSlashCommand = interaction.type === 2;

    return {
      type: isSlashCommand ? 4 : 7,
      data: {
        flags: 64, // Ephemeral: Only admin can see decrypted credentials!
        embeds: [embed],
        components,
      },
    };
  }

  /**
   * Modal: Add Stock (Bulk)
   */
  private renderAddStockModal() {
    return {
      type: 9, // MODAL
      data: {
        title: 'เพิ่มสต็อกสินค้า (Bulk Stock Import)',
        custom_id: 'adm:stock:submit_add',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4, // TEXT_INPUT
                custom_id: 'product_code',
                style: 1, // Short
                label: 'รหัสสินค้า (Product SKU หรือ Code)',
                placeholder: 'เช่น BF-V4-MAX-01 หรือใส่รหัสสินค้า',
                required: true,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'items',
                style: 2, // Paragraph
                label: 'รายการบัญชี (1 บรรทัด = 1 บัญชี user:pass)',
                placeholder: 'user1:password123\nuser2:password456',
                required: true,
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * Modal: Search Stock Item
   */
  private renderSearchStockModal() {
    return {
      type: 9, // MODAL
      data: {
        title: 'ค้นหาชิ้นสต็อกสินค้า (Search Stock)',
        custom_id: 'adm:stock:submit_search',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'query',
                style: 1,
                label: 'Serial Code / ไอดี / รายละเอียด / SKU',
                placeholder: 'เช่น STK-BF-V4... หรือชื่อผู้ใช้',
                required: true,
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * Submit Modal: Search Stock Item
   */
  private async handleModalSubmitSearchStock(interaction: any) {
    const rawComponents = interaction.data?.components || [];
    let query = '';
    for (const row of rawComponents) {
      for (const comp of row.components || []) {
        if (comp.custom_id === 'query') query = comp.value?.trim() || '';
      }
    }

    if (!query) {
      return {
        type: 4,
        data: { flags: 64, content: '❌ กรุณาระบุคำค้นหา' },
      };
    }

    const found = await this.prisma.accountStock.findFirst({
      where: {
        OR: [
          { serialCode: { contains: query, mode: 'insensitive' } },
          { username: { contains: query, mode: 'insensitive' } },
          { maskedIdentity: { contains: query, mode: 'insensitive' } },
          { details: { contains: query, mode: 'insensitive' } },
          { id: query },
        ],
      },
      include: { product: true },
    });

    if (!found) {
      return {
        type: 4,
        data: {
          flags: 64,
          content: `❌ ไม่พบชิ้นสต็อกที่ตรงกับคำค้นหา \`${query}\``,
        },
      };
    }

    const embed = {
      title: `📦 ผลการค้นหาสต็อก: \`${found.serialCode}\``,
      description: `พบข้อมูลสต็อกสินค้าในระบบ:`,
      color: DISCORD_COLORS.INFO,
      fields: [
        { name: 'สินค้า', value: found.product?.title || '-', inline: true },
        { name: 'สถานะ', value: `\`${found.status}\``, inline: true },
        { name: 'ไอดี (Masked)', value: `\`${found.maskedIdentity}\``, inline: true },
        {
          name: 'ราคาขายพิเศษ',
          value: found.sellingPriceText
            ? `฿${found.sellingPriceText}`
            : `ตามสินค้า (฿${Number(found.product?.price || 0)})`,
          inline: true,
        },
        { name: 'รายละเอียด', value: found.details || 'ไม่มีรายละเอียด', inline: false },
        {
          name: 'นำเข้าเมื่อ',
          value: `<t:${Math.floor(new Date(found.createdAt).getTime() / 1000)}:f>`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [embed],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 1, // Primary
                label: '✏️ แก้ไขสต็อกชิ้นนี้',
                custom_id: `adm:stock:open_edit:${found.id}`,
              },
              {
                type: 2,
                style: 4, // Danger
                label: '🗑️ ลบสต็อกชิ้นนี้',
                custom_id: `adm:stock:confirm_del:${found.id}`,
              },
              {
                type: 2,
                style: 2,
                label: '🔙 กลับหน้าคลังสต็อก',
                custom_id: 'adm:nav:stock',
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * Submit Modal: Add Stock (Optimized Bulk Insert)
   */
  private async handleModalSubmitAddStock(interaction: any) {
    const rawComponents = interaction.data?.components || [];
    let productCode = '';
    let itemsText = '';

    for (const row of rawComponents) {
      for (const comp of row.components || []) {
        if (comp.custom_id === 'product_code') productCode = comp.value?.trim();
        if (comp.custom_id === 'items') itemsText = comp.value?.trim();
      }
    }

    if (!productCode || !itemsText) {
      return {
        type: 4,
        data: { flags: 64, content: 'กรุณากรอกรหัสสินค้าและรายการบัญชีให้ครบถ้วน' },
      };
    }

    const product = await this.prisma.product.findFirst({
      where: {
        OR: [
          { code: { equals: productCode, mode: 'insensitive' } },
          { id: productCode },
          { title: { contains: productCode, mode: 'insensitive' } },
        ],
      },
    });

    if (!product) {
      return {
        type: 4,
        data: {
          flags: 64,
          content: `❌ ไม่พบสินค้ารหัส \`${productCode}\` ในระบบ กรุณาตรวจสอบรหัส SKU ในหน้าร้าน`,
        },
      };
    }

    const lines = itemsText
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    const user = this.adminGuard.extractUser(interaction);
    let successCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];

    // 1. In-memory validation, hashing, deduplication within the batch
    const seenHashesInBatch = new Set<string>();
    const candidates: Array<{
      line: string;
      inspected: any;
      serialCode: string;
      encrypted: string;
    }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const inspected = inspectAndHashCredential(line, product.credentialFormat as CredentialFormat);

      if (!inspected.isValid) {
        errors.push(`แถวที่ ${i + 1}: ${inspected.error}`);
        continue;
      }

      if (seenHashesInBatch.has(inspected.credentialHash)) {
        duplicateCount++;
        continue;
      }
      seenHashesInBatch.add(inspected.credentialHash);

      const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const serialCode = `STK-${product.code}-${Date.now().toString(36).toUpperCase()}-${i + 1}-${randomSuffix}`;
      const encrypted = encryptCredentialAes256Gcm(line, this.encryptionSecret);

      candidates.push({
        line,
        inspected,
        serialCode,
        encrypted,
      });
    }

    // 2. Single DB Query: Check existing hashes in DB
    if (candidates.length > 0) {
      const candidateHashes = candidates.map((c) => c.inspected.credentialHash);
      const existingInDb = await this.prisma.accountStock.findMany({
        where: { credentialHash: { in: candidateHashes } },
        select: { credentialHash: true },
      });
      const existingDbSet = new Set(existingInDb.map((e) => e.credentialHash));

      const toCreate = candidates
        .filter((c) => {
          if (existingDbSet.has(c.inspected.credentialHash)) {
            duplicateCount++;
            return false;
          }
          return true;
        })
        .map((c) => ({
          serialCode: c.serialCode,
          productId: product.id,
          credentialFormat: product.credentialFormat,
          credentialHash: c.inspected.credentialHash,
          maskedIdentity: c.inspected.maskedIdentity,
          credentials: c.encrypted,
          username: c.inspected.normalizedPrimaryKey,
          addedSource: 'DISCORD_ADMIN_MODAL',
          addedByDiscordId: user.id,
          status: 'AVAILABLE' as const,
        }));

      // 3. Single Batch DB Insert (< 200ms)
      if (toCreate.length > 0) {
        const createResult = await this.prisma.accountStock.createMany({
          data: toCreate,
          skipDuplicates: true,
        });
        successCount = createResult.count;
      }
    }

    // Log Audit
    await this.adminAudit.log({
      action: 'ADMIN_STOCK_IMPORT',
      targetType: 'PRODUCT',
      targetId: product.id,
      actorDiscordId: user.id,
      actorUsername: user.username,
      metadata: {
        productCode: product.code,
        successCount,
        duplicateCount,
        errorCount: errors.length,
      },
      severity: 'LOW',
    });

    // Notify Webhook
    if (successCount > 0) {
      try {
        await this.discordWebhook.notifyStockImport({
          count: successCount,
          productTitle: product.title,
          batchCode: `BY_${user.username}`,
        });
      } catch (err: any) {
        this.logger.error(`Stock import webhook failed: ${err.message}`);
      }
    }

    const embed = {
      title: '📦 ผลการนำเข้าสต็อกสินค้า (Stock Import Result)',
      description: `นำเข้าสำหรับสินค้า: **${product.title}** (\`${product.code}\`)`,
      color: successCount > 0 ? DISCORD_COLORS.SUCCESS : DISCORD_COLORS.WARNING,
      fields: [
        { name: '✅ นำเข้าสำเร็จ', value: `**${successCount}** ชิ้น`, inline: true },
        { name: '⚠️ ซ้ำซ้อน (ข้าม)', value: `**${duplicateCount}** ชิ้น`, inline: true },
        { name: '❌ ผิดรูปแบบ', value: `**${errors.length}** รายการ`, inline: true },
      ],
      footer: { text: `โดย ${user.username}` },
      timestamp: new Date().toISOString(),
    };

    return {
      type: 4,
      data: { flags: 64, embeds: [embed] },
    };
  }

  /**
   * List Recent Stock Items with Delete Confirmation
   */
  private async handleStockListRecent(interaction: any, productId?: string) {
    const where: any = { status: 'AVAILABLE' };
    if (productId) {
      where.productId = productId;
    }

    const recent = await this.prisma.accountStock.findMany({
      where,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    const targetProduct = productId ? await this.prisma.product.findUnique({ where: { id: productId } }) : null;
    const title = targetProduct
      ? `📋 รายการสต็อกพร้อมขาย (${targetProduct.title})`
      : '📋 รายการสต็อกสินค้าพร้อมขายล่าสุด';

    if (recent.length === 0) {
      return {
        type: 7,
        data: {
          flags: 64,
          embeds: [
            {
              title,
              description: 'ขณะนี้ไม่มีสต็อกพร้อมขายในระบบ',
              color: DISCORD_COLORS.NEUTRAL,
            },
          ],
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 กลับหน้าสต็อก', custom_id: 'adm:nav:stock' },
              ],
            },
          ],
        },
      };
    }

    const lines = recent.map((s, i) => {
      const isSold = s.status === 'SOLD' || Boolean(s.soldAt);
      const statusIcon = isSold ? '🔴' : '🟢';
      const statusLabel = isSold ? 'ขายแล้ว' : 'พร้อมขาย';
      const password = this.extractPassword(s.credentials);
      const passStr = password ? ` | รหัส: ||\`${password}\`||` : '';
      const mapStr = s.farmedMaps ? ` • 🗺️ \`${s.farmedMaps}\`` : '';
      const priceVal = s.product?.price || s.sellingPriceText;
      const priceStr = priceVal ? ` • 💰 ฿${Number(priceVal)}` : '';
      const displayName = s.username || s.maskedIdentity || s.serialCode;
      return `\`${i + 1}.\` ${statusIcon} **[${statusLabel}]** **${displayName}**${passStr}${mapStr}${priceStr}`;
    });

    const editButtons = recent.slice(0, 5).map((s, i) => ({
      type: 2,
      style: 1, // Primary
      label: `✏️ แก้ไข #${i + 1}`,
      custom_id: `adm:stock:open_edit:${s.id}`,
    }));

    const deleteButtons = recent.slice(0, 5).map((s, i) => ({
      type: 2,
      style: 4, // Danger
      label: `🗑️ ลบ #${i + 1}`,
      custom_id: `adm:stock:confirm_del:${s.id}`,
    }));

    return {
      type: 7,
      data: {
        flags: 64,
        embeds: [
          {
            title,
            description: lines.join('\n'),
            color: DISCORD_COLORS.INFO,
            footer: { text: `แสดง ${recent.length} รายการ • คลิกที่แท่งดำ ||...|| เพื่อเปิดดูรหัสผ่าน` },
          },
        ],
        components: [
          ...(editButtons.length > 0 ? [{ type: 1, components: editButtons }] : []),
          ...(deleteButtons.length > 0 ? [{ type: 1, components: deleteButtons }] : []),
          {
            type: 1,
            components: [
              { type: 2, style: 2, label: '🔙 กลับหน้าสต็อก', custom_id: 'adm:nav:stock' },
            ],
          },
        ],
      },
    };
  }

  /**
   * Open Edit Stock Modal
   */
  private async handleStockOpenEdit(interaction: any, stockId: string) {
    const stock = await this.prisma.accountStock.findUnique({
      where: { id: stockId },
      include: { product: true },
    });

    if (!stock) {
      return {
        type: 4,
        data: { flags: 64, content: '❌ ไม่พบชิ้นสต็อกดังกล่าวในระบบ' },
      };
    }

    return {
      type: 9, // MODAL
      data: {
        title: `แก้ไขสต็อก (${stock.serialCode.slice(0, 18)})`,
        custom_id: `adm:stock:submit_edit:${stock.id}`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'credentials',
                style: 1,
                label: 'รหัสใหม่ user:pass (เว้นว่างหากไม่เปลี่ยน)',
                placeholder: `ไอดีปัจจุบัน: ${stock.maskedIdentity}`,
                required: false,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'details',
                style: 2,
                label: 'รายละเอียดของในไอดี / หมายเหตุ',
                value: stock.details || '',
                placeholder: 'เช่น เผ่า V4 เต็ม, ดาบคู่ CDK, ผลตื่นครบ',
                required: false,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'selling_price',
                style: 1,
                label: 'ราคาขายพิเศษ (เว้นว่างใช้ราคาสินค้าปกติ)',
                value: stock.sellingPriceText || '',
                placeholder: `ราคาสินค้าปกติ: ${Number(stock.product?.price || 0)} บาท`,
                required: false,
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * Submit Modal: Edit Stock
   */
  private async handleModalSubmitEditStock(interaction: any, stockId: string) {
    const stock = await this.prisma.accountStock.findUnique({
      where: { id: stockId },
      include: { product: true },
    });

    if (!stock) {
      return {
        type: 4,
        data: { flags: 64, content: '❌ ไม่พบข้อมูลสต็อกที่ต้องการแก้ไข' },
      };
    }

    const rawComponents = interaction.data?.components || [];
    let newCredentials = '';
    let details = '';
    let sellingPriceText = '';

    for (const row of rawComponents) {
      for (const comp of row.components || []) {
        if (comp.custom_id === 'credentials') newCredentials = comp.value?.trim() || '';
        if (comp.custom_id === 'details') details = comp.value?.trim() || '';
        if (comp.custom_id === 'selling_price') sellingPriceText = comp.value?.trim() || '';
      }
    }

    const updateData: any = {
      details: details || null,
      sellingPriceText: sellingPriceText || null,
    };

    let passwordUpdated = false;
    if (newCredentials) {
      const format = (stock.credentialFormat ||
        stock.product?.credentialFormat ||
        'USER_PASS') as CredentialFormat;
      const inspected = inspectAndHashCredential(newCredentials, format);
      if (!inspected.isValid) {
        return {
          type: 4,
          data: { flags: 64, content: `❌ รูปแบบรหัสไม่ถูกต้อง: ${inspected.error}` },
        };
      }
      updateData.credentialHash = inspected.credentialHash;
      updateData.maskedIdentity = inspected.maskedIdentity;
      updateData.credentials = encryptCredentialAes256Gcm(newCredentials, this.encryptionSecret);
      updateData.username = inspected.normalizedPrimaryKey;
      passwordUpdated = true;
    }

    const updated = await this.prisma.accountStock.update({
      where: { id: stockId },
      data: updateData,
    });

    const user = this.adminGuard.extractUser(interaction);

    await this.adminAudit.log({
      action: 'ADMIN_STOCK_UPDATE',
      targetType: 'ACCOUNT_STOCK',
      targetId: stockId,
      actorDiscordId: user.id,
      actorUsername: user.username,
      metadata: {
        serialCode: stock.serialCode,
        passwordUpdated,
        detailsUpdated: Boolean(details),
      },
      severity: passwordUpdated ? 'MEDIUM' : 'LOW',
    });

    try {
      await this.discordWebhook.notifyKaitunSync(
        passwordUpdated ? 'PASSWORD_UPDATED' : 'DETAILS_UPDATED',
        {
          username: updated.username || updated.maskedIdentity,
          details: updated.details || undefined,
          price: updated.sellingPriceText || String(stock.product?.price || '-'),
          actor: `Discord Admin (${user.username})`,
        },
      );
    } catch (err: any) {
      this.logger.error(`Stock edit webhook failed: ${err.message}`);
    }

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: '✅ แก้ไขข้อมูลสต็อกสำเร็จ (Stock Updated)',
            description: `อัปเดตข้อมูลสำหรับ \`${stock.serialCode}\` (**${stock.product?.title}**) เรียบร้อยแล้ว`,
            color: DISCORD_COLORS.SUCCESS,
            fields: [
              { name: 'ไอดี (Masked)', value: `\`${updated.maskedIdentity}\``, inline: true },
              {
                name: 'เปลี่ยนรหัสผ่าน',
                value: passwordUpdated ? '✅ เปลี่ยนรหัสใหม่แล้ว' : '➖ คงเดิม',
                inline: true,
              },
              { name: 'รายละเอียด', value: updated.details || '-', inline: false },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  /**
   * Confirmation Dialog before deleting stock
   */
  private async handleStockConfirmDelete(interaction: any, stockId: string) {
    const stock = await this.prisma.accountStock.findUnique({
      where: { id: stockId },
      include: { product: true },
    });

    if (!stock) {
      return {
        type: 7,
        data: {
          content: '❌ ไม่พบข้อมูลสต็อกชิ้นนี้ หรืออาจถูกลบไปแล้ว',
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 กลับหน้าสต็อก', custom_id: 'adm:nav:stock' },
              ],
            },
          ],
        },
      };
    }

    return {
      type: 7,
      data: {
        embeds: [
          {
            title: '⚠️ ยืนยันการลบชิ้นสต็อกสินค้า (Safety Confirmation)',
            description: `คุณแน่ใจหรือไม่ที่จะลบสต็อกชิ้นนี้ออกจากระบบ?\n\n• **Serial Code:** \`${stock.serialCode}\`\n• **สินค้า:** ${stock.product?.title}\n• **ไอดี:** \`${stock.maskedIdentity}\``,
            color: DISCORD_COLORS.DANGER,
          },
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 4, // Danger
                label: '⚠️ ยืนยันลบทันที',
                custom_id: `adm:stock:do_del:${stock.id}`,
              },
              {
                type: 2,
                style: 2,
                label: '❌ ยกเลิก',
                custom_id: 'adm:nav:stock',
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * Execute Delete Stock
   */
  private async handleStockDoDelete(interaction: any, stockId: string) {
    const user = this.adminGuard.extractUser(interaction);

    const stock = await this.prisma.accountStock.findUnique({
      where: { id: stockId },
      include: { product: true },
    });

    if (!stock) {
      return {
        type: 7,
        data: {
          content: '❌ ไม่พบสต็อกดังกล่าวในระบบ',
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 กลับหน้าสต็อก', custom_id: 'adm:nav:stock' },
              ],
            },
          ],
        },
      };
    }

    await this.prisma.accountStock.delete({ where: { id: stockId } });

    await this.adminAudit.log({
      action: 'ADMIN_STOCK_DELETE',
      targetType: 'ACCOUNT_STOCK',
      targetId: stockId,
      actorDiscordId: user.id,
      actorUsername: user.username,
      metadata: {
        serialCode: stock.serialCode,
        productId: stock.productId,
        productTitle: stock.product?.title,
      },
      severity: 'HIGH',
      notifySecurity: true,
    });

    try {
      await this.discordWebhook.notifyStockRemoved({
        serialCode: stock.serialCode,
        productTitle: stock.product?.title || 'สินค้า',
        username: stock.username || stock.maskedIdentity,
      });

      if (stock.product) {
        const remaining = await this.prisma.accountStock.count({
          where: { productId: stock.productId, status: 'AVAILABLE' },
        });
        if (remaining <= 3) {
          await this.discordWebhook.notifyLowStock({
            productTitle: stock.product.title,
            code: stock.product.code,
            remaining,
            threshold: 3,
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Stock removed webhook failed: ${err.message}`);
    }

    return {
      type: 7,
      data: {
        embeds: [
          {
            title: '✅ ลบสต็อกสินค้าสำเร็จเรียบร้อย',
            description: `ลบรายการ \`${stock.serialCode}\` ออกจากฐานข้อมูลเรียบร้อยแล้ว`,
            color: DISCORD_COLORS.SUCCESS,
          },
        ],
        components: [
          {
            type: 1,
            components: [
              { type: 2, style: 2, label: '🔙 กลับหน้าสต็อก', custom_id: 'adm:nav:stock' },
              { type: 2, style: 2, label: '🏠 หน้าหลัก Admin', custom_id: 'adm:nav:hub' },
            ],
          },
        ],
      },
    };
  }

  // ============================================================================
  // EXPENSE MANAGER VIEWS
  // ============================================================================

  /**
   * Expense Manager View (adm:nav:expense)
   */
  private async handleNavExpense(interaction: any, selectedExpId?: string) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [monthSummary, recentExpenses] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { paidAt: { gte: monthStart } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.findMany({
        orderBy: { paidAt: 'desc' },
        take: 5,
      }),
    ]);

    let targetExpense =
      recentExpenses.find((e) => e.id === selectedExpId) || recentExpenses[0];

    if (selectedExpId && targetExpense?.id !== selectedExpId) {
      const fetched = await this.prisma.expense.findUnique({
        where: { id: selectedExpId },
      });
      if (fetched) targetExpense = fetched;
    }

    const lines = recentExpenses.map((e, i) => {
      const pointer = targetExpense && e.id === targetExpense.id ? '👉 ' : '';
      return `${pointer}**${i + 1}.** [${e.category}] **${e.title}** - **฿${Number(e.amount).toLocaleString()}** (<t:${Math.floor(new Date(e.paidAt).getTime() / 1000)}:R>)`;
    });

    const embed = {
      title: '💸 ระบบบันทึกและจัดการค่าใช้จ่าย (Expense Manager)',
      description: `**ยอดรายจ่ายเดือนนี้:** ฿${Number(monthSummary._sum.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} (${monthSummary._count} รายการ)\n\n**5 รายการล่าสุด:**\n${lines.length > 0 ? lines.join('\n') : 'ยังไม่มีการบันทึกรายจ่าย'}${
        targetExpense
          ? `\n\n🎯 **กำลังเลือก:** **${targetExpense.title}** (฿${Number(targetExpense.amount).toLocaleString()}) - \`${targetExpense.category}\``
          : ''
      }`,
      color: DISCORD_COLORS.INFO,
      footer: { text: 'KaiZort Admin • Accounting & Expenses' },
      timestamp: new Date().toISOString(),
    };

    const components: any[] = [];

    if (recentExpenses.length > 0 && targetExpense) {
      const selectOptions = recentExpenses.map((e, i) => ({
        label: `#${i + 1} [${e.category}] ${e.title}`.slice(0, 100),
        description: `฿${Number(e.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`.slice(0, 100),
        value: e.id,
        default: e.id === targetExpense.id,
      }));

      components.push({
        type: 1, // Action Row 1: Select Dropdown
        components: [
          {
            type: 3, // STRING_SELECT
            custom_id: 'adm:expense:select',
            placeholder: 'เลือกรายการค่าใช้จ่ายที่ต้องการจัดการ...',
            options: selectOptions,
          },
        ],
      });

      components.push({
        type: 1, // Action Row 2: Selected Item Actions
        components: [
          {
            type: 2,
            style: 3, // Success
            label: '➕ บันทึกค่าใช้จ่าย',
            custom_id: 'adm:expense:open_add',
          },
          {
            type: 2,
            style: 1, // Primary
            label: `✏️ แก้ไข (#${recentExpenses.indexOf(targetExpense) + 1})`,
            custom_id: `adm:expense:open_edit:${targetExpense.id}`,
          },
          {
            type: 2,
            style: 4, // Danger
            label: `🗑️ ลบ (#${recentExpenses.indexOf(targetExpense) + 1})`,
            custom_id: `adm:expense:confirm_del:${targetExpense.id}`,
          },
          {
            type: 2,
            style: 2,
            label: '📈 กำไร/ขาดทุน',
            custom_id: 'adm:nav:summary',
          },
        ],
      });
    } else {
      components.push({
        type: 1,
        components: [
          {
            type: 2,
            style: 3, // Success
            label: '➕ บันทึกค่าใช้จ่าย',
            custom_id: 'adm:expense:open_add',
          },
          {
            type: 2,
            style: 2,
            label: '📈 กำไร/ขาดทุน',
            custom_id: 'adm:nav:summary',
          },
        ],
      });
    }

    components.push({
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          label: '🔙 หน้าหลัก Admin',
          custom_id: 'adm:nav:hub',
        },
      ],
    });

    return {
      type: 7,
      data: {
        embeds: [embed],
        components,
      },
    };
  }

  /**
   * Modal: Add Expense
   */
  private renderAddExpenseModal() {
    return {
      type: 9,
      data: {
        title: 'บันทึกค่าใช้จ่ายใหม่ (Add Expense)',
        custom_id: 'adm:expense:submit_add',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'title',
                style: 1,
                label: 'ชื่อรายการค่าใช้จ่าย',
                placeholder: 'เช่น ค่าไฟฟาร์ม, ค่า VPS รายเดือน, ค่าสคริปต์',
                required: true,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'amount',
                style: 1,
                label: 'จำนวนเงิน (บาท)',
                placeholder: 'เช่น 350 หรือ 1200.50',
                required: true,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'category',
                style: 1,
                label: 'หมวดหมู่ (SCRIPT, VPS, ELECTRICITY, OTHER)',
                value: 'OTHER',
                required: false,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'note',
                style: 2,
                label: 'หมายเหตุเพิ่มเติม (ถ้ามี)',
                required: false,
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * Submit Modal: Add Expense
   */
  private async handleModalSubmitAddExpense(interaction: any) {
    const rawComponents = interaction.data?.components || [];
    let title = '';
    let amountStr = '';
    let category = 'OTHER';
    let note = '';

    for (const row of rawComponents) {
      for (const comp of row.components || []) {
        if (comp.custom_id === 'title') title = comp.value?.trim();
        if (comp.custom_id === 'amount') amountStr = comp.value?.trim();
        if (comp.custom_id === 'category') category = comp.value?.trim().toUpperCase() || 'OTHER';
        if (comp.custom_id === 'note') note = comp.value?.trim() || '';
      }
    }

    const amount = parseFloat(amountStr);
    if (!title || isNaN(amount) || amount <= 0) {
      return {
        type: 4,
        data: {
          flags: 64,
          content: '❌ ข้อมูลไม่ถูกต้อง กรุณาระบุชื่อรายการและจำนวนเงินที่มากกว่า 0',
        },
      };
    }

    const user = this.adminGuard.extractUser(interaction);

    const expense = await this.prisma.expense.create({
      data: {
        title,
        amount,
        category,
        note: note ? `${note} (บันทึกโดย Discord: ${user.username})` : `บันทึกโดย Discord: ${user.username}`,
      },
    });

    await this.adminAudit.log({
      action: 'ADMIN_EXPENSE_CREATE',
      targetType: 'EXPENSE',
      targetId: expense.id,
      actorDiscordId: user.id,
      actorUsername: user.username,
      metadata: { title, amount, category },
      severity: 'LOW',
    });

    try {
      await this.discordWebhook.notifyExpenseAction('CREATED', {
        title,
        amount,
        category,
        note: expense.note || undefined,
      });
    } catch (err: any) {
      this.logger.error(`Expense webhook failed: ${err.message}`);
    }

    const embed = {
      title: '✅ บันทึกค่าใช้จ่ายสำเร็จ (Expense Recorded)',
      description: `บันทึกรายการ: **${title}** เข้าสู่ระบบเรียบร้อย`,
      color: DISCORD_COLORS.SUCCESS,
      fields: [
        { name: 'จำนวนเงิน', value: `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, inline: true },
        { name: 'หมวดหมู่', value: `\`${category}\``, inline: true },
        { name: 'ผู้บันทึก', value: user.username, inline: true },
      ],
      timestamp: new Date().toISOString(),
    };

    return {
      type: 4,
      data: { flags: 64, embeds: [embed] },
    };
  }

  /**
   * Open Edit Latest Expense Modal
   */
  private async handleExpenseOpenEditLatest(interaction: any) {
    const latest = await this.prisma.expense.findFirst({
      orderBy: { paidAt: 'desc' },
    });

    if (!latest) {
      return {
        type: 4,
        data: { flags: 64, content: '❌ ไม่มีรายการค่าใช้จ่ายในระบบให้แก้ไข' },
      };
    }

    return await this.handleExpenseOpenEdit(interaction, latest.id);
  }

  /**
   * Open Edit Expense Modal by ID
   */
  private async handleExpenseOpenEdit(interaction: any, expId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expId },
    });

    if (!expense) {
      return {
        type: 4,
        data: { flags: 64, content: '❌ ไม่พบรายการค่าใช้จ่ายที่ต้องการแก้ไข' },
      };
    }

    return {
      type: 9,
      data: {
        title: 'แก้ไขรายการค่าใช้จ่าย (Edit Expense)',
        custom_id: `adm:expense:submit_edit:${expense.id}`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'title',
                style: 1,
                label: 'ชื่อรายการค่าใช้จ่าย',
                value: expense.title,
                required: true,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'amount',
                style: 1,
                label: 'จำนวนเงิน (บาท)',
                value: String(Number(expense.amount)),
                required: true,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'category',
                style: 1,
                label: 'หมวดหมู่ (SCRIPT, VPS, ELECTRICITY, OTHER)',
                value: expense.category || 'OTHER',
                required: false,
              },
            ],
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'note',
                style: 2,
                label: 'หมายเหตุเพิ่มเติม (ถ้ามี)',
                value: expense.note || '',
                required: false,
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * Submit Modal: Edit Expense
   */
  private async handleModalSubmitEditExpense(interaction: any, expId: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id: expId } });
    if (!existing) {
      return {
        type: 4,
        data: { flags: 64, content: '❌ ไม่พบรายการค่าใช้จ่ายดังกล่าว' },
      };
    }

    const rawComponents = interaction.data?.components || [];
    let title = '';
    let amountStr = '';
    let category = 'OTHER';
    let note = '';

    for (const row of rawComponents) {
      for (const comp of row.components || []) {
        if (comp.custom_id === 'title') title = comp.value?.trim();
        if (comp.custom_id === 'amount') amountStr = comp.value?.trim();
        if (comp.custom_id === 'category') category = comp.value?.trim().toUpperCase() || 'OTHER';
        if (comp.custom_id === 'note') note = comp.value?.trim() || '';
      }
    }

    const amount = parseFloat(amountStr);
    if (!title || isNaN(amount) || amount <= 0) {
      return {
        type: 4,
        data: {
          flags: 64,
          content: '❌ ข้อมูลไม่ถูกต้อง กรุณาระบุชื่อรายการและจำนวนเงินที่มากกว่า 0',
        },
      };
    }

    const user = this.adminGuard.extractUser(interaction);

    const updated = await this.prisma.expense.update({
      where: { id: expId },
      data: {
        title,
        amount,
        category,
        note: note || null,
      },
    });

    await this.adminAudit.log({
      action: 'ADMIN_EXPENSE_UPDATE',
      targetType: 'EXPENSE',
      targetId: expId,
      actorDiscordId: user.id,
      actorUsername: user.username,
      metadata: {
        oldTitle: existing.title,
        oldAmount: Number(existing.amount),
        newTitle: title,
        newAmount: amount,
        category,
      },
      severity: 'LOW',
    });

    try {
      await this.discordWebhook.notifyExpenseAction('UPDATED', {
        title,
        amount,
        category,
        note: updated.note || undefined,
        actor: `Discord Admin (${user.username})`,
      });
    } catch (err: any) {
      this.logger.error(`Expense update webhook failed: ${err.message}`);
    }

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: '✅ แก้ไขรายการค่าใช้จ่ายสำเร็จ (Expense Updated)',
            description: `อัปเดตรายการ: **${title}** เรียบร้อยแล้ว`,
            color: DISCORD_COLORS.SUCCESS,
            fields: [
              {
                name: 'จำนวนเงินใหม่',
                value: `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
                inline: true,
              },
              { name: 'หมวดหมู่', value: `\`${category}\``, inline: true },
              { name: 'ผู้แก้ไข', value: user.username, inline: true },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  /**
   * Confirm Delete Expense (by ID or latest)
   */
  private async handleExpenseConfirmDelete(interaction: any, expId?: string) {
    const expense = expId
      ? await this.prisma.expense.findUnique({ where: { id: expId } })
      : await this.prisma.expense.findFirst({ orderBy: { paidAt: 'desc' } });

    if (!expense) {
      return {
        type: 7,
        data: {
          content: '❌ ไม่มีรายการค่าใช้จ่ายในระบบให้ลบ',
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 กลับหน้ารายจ่าย', custom_id: 'adm:nav:expense' },
              ],
            },
          ],
        },
      };
    }

    return {
      type: 7,
      data: {
        embeds: [
          {
            title: '⚠️ ยืนยันการลบค่าใช้จ่าย (Safety Confirmation)',
            description: `คุณต้องการลบรายการนี้ใช่หรือไม่?\n\n• **รายการ:** ${expense.title}\n• **จำนวนเงิน:** ฿${Number(expense.amount).toLocaleString()}\n• **หมวดหมู่:** \`${expense.category}\`\n• **วันที่:** <t:${Math.floor(new Date(expense.paidAt).getTime() / 1000)}:f>`,
            color: DISCORD_COLORS.DANGER,
          },
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 4,
                label: '⚠️ ยืนยันลบ',
                custom_id: `adm:expense:do_del:${expense.id}`,
              },
              {
                type: 2,
                style: 2,
                label: '❌ ยกเลิก',
                custom_id: 'adm:nav:expense',
              },
            ],
          },
        ],
      },
    };
  }

  private async handleExpenseConfirmDeleteLatest(interaction: any) {
    return await this.handleExpenseConfirmDelete(interaction);
  }

  /**
   * Execute Delete Expense
   */
  private async handleExpenseDoDelete(interaction: any, expId: string) {
    const user = this.adminGuard.extractUser(interaction);

    const expense = await this.prisma.expense.findUnique({ where: { id: expId } });
    if (!expense) {
      return {
        type: 7,
        data: {
          content: '❌ ไม่พบรายการค่าใช้จ่ายดังกล่าว หรือถูกลบไปแล้ว',
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 กลับหน้ารายจ่าย', custom_id: 'adm:nav:expense' },
              ],
            },
          ],
        },
      };
    }

    await this.prisma.expense.delete({ where: { id: expId } });

    await this.adminAudit.log({
      action: 'ADMIN_EXPENSE_DELETE',
      targetType: 'EXPENSE',
      targetId: expId,
      actorDiscordId: user.id,
      actorUsername: user.username,
      metadata: { title: expense.title, amount: Number(expense.amount) },
      severity: 'MEDIUM',
    });

    try {
      await this.discordWebhook.notifyExpenseAction('DELETED', {
        title: expense.title,
        amount: Number(expense.amount),
        category: expense.category,
      });
    } catch (err: any) {
      this.logger.error(`Expense delete webhook failed: ${err.message}`);
    }

    return {
      type: 7,
      data: {
        embeds: [
          {
            title: '✅ ลบรายการค่าใช้จ่ายสำเร็จ',
            description: `ลบรายการ **${expense.title}** (฿${Number(expense.amount).toLocaleString()}) เรียบร้อยแล้ว`,
            color: DISCORD_COLORS.SUCCESS,
          },
        ],
        components: [
          {
            type: 1,
            components: [
              { type: 2, style: 2, label: '🔙 กลับหน้ารายจ่าย', custom_id: 'adm:nav:expense' },
              { type: 2, style: 2, label: '🏠 หน้าหลัก Admin', custom_id: 'adm:nav:hub' },
            ],
          },
        ],
      },
    };
  }

  // ============================================================================
  // TOPUPS MANAGER VIEWS (Approve / Reject Slip)
  // ============================================================================

  /**
   * Topups View (adm:nav:topups)
   */
  private async handleNavTopups(interaction: any, selectedTopupId?: string) {
    const pending = await this.prisma.topupTransaction.findMany({
      where: { status: 'PENDING_VERIFY' },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
      take: 5,
    });

    if (pending.length === 0) {
      return {
        type: 7,
        data: {
          embeds: [
            {
              title: '💳 ระบบตรวจสอบสลิปเติมเงิน (Topups Verifier)',
              description: '✅ ไม่มีรายการสลิปรอตรวจสอบในขณะนี้ ทุกรายการได้รับการตรวจสอบครบถ้วนแล้ว',
              color: DISCORD_COLORS.SUCCESS,
            },
          ],
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔄 รีเฟรช', custom_id: 'adm:nav:topups' },
                { type: 2, style: 2, label: '🔙 กลับหน้าหลัก Admin', custom_id: 'adm:nav:hub' },
              ],
            },
          ],
        },
      };
    }

    const current = pending.find((t) => t.id === selectedTopupId) || pending[0];
    const currentIndex = pending.indexOf(current) + 1;

    const isHttpImage = Boolean(
      current.slipUrl &&
      (current.slipUrl.startsWith('http://') || current.slipUrl.startsWith('https://'))
    );

    const embed: any = {
      title: `💳 รายการสลิปรอตรวจ (ค้างทั้งหมด ${pending.length} รายการ)`,
      description: `กำลังแสดงรายการที่ **${currentIndex} จาก ${pending.length}**:\n\n• **รหัสรายการ:** \`${current.transactionCode || current.id}\`\n• **ผู้เติมเงิน:** **${current.user?.username || 'ผู้ใช้'}** (${current.user?.email || '-'})\n• **ยอดเงิน:** **฿${Number(current.amount).toLocaleString()}** (โบนัส: ฿${Number(current.bonusAmount || 0)})\n• **วิธีชำระ:** \`${current.paymentMethod}\`\n• **เวลาแจ้งโอน:** <t:${Math.floor(new Date(current.createdAt).getTime() / 1000)}:R>\n${current.slipUrl ? `• **รูปสลิป:** [กดดูภาพขยายเต็มจอ](${current.slipUrl})` : '• **รูปสลิป:** ไม่มี URL แนบ'}`,
      color: DISCORD_COLORS.WARNING,
      footer: { text: 'KaiZort Admin • Fast Topup Verifier' },
      timestamp: new Date().toISOString(),
    };

    if (isHttpImage) {
      embed.image = { url: current.slipUrl };
    }

    const components: any[] = [];

    if (pending.length > 1) {
      components.push({
        type: 1, // Action Row 1: Queue Select Menu
        components: [
          {
            type: 3, // STRING_SELECT
            custom_id: 'adm:topup:select',
            placeholder: 'เลือกสลิปที่ต้องการตรวจในคิว...',
            options: pending.map((t, i) => ({
              label: `#${i + 1} ฿${Number(t.amount).toLocaleString()} (${t.user?.username || 'ลูกค้า'})`.slice(0, 100),
              description: `${t.paymentMethod} | ${t.transactionCode || t.id}`.slice(0, 100),
              value: t.id,
              default: t.id === current.id,
            })),
          },
        ],
      });
    }

    components.push({
      type: 1, // Action Row 2: Actions
      components: [
        {
          type: 2,
          style: 3, // Success
          label: `✅ อนุมัติ ฿${Number(current.amount)}`,
          custom_id: `adm:topup:approve:${current.id}`,
        },
        {
          type: 2,
          style: 4, // Danger
          label: '❌ ปฏิเสธสลิป',
          custom_id: `adm:topup:open_reject:${current.id}`,
        },
        {
          type: 2,
          style: 2,
          label: '🔄 รีเฟรช',
          custom_id: 'adm:nav:topups',
        },
        {
          type: 2,
          style: 2,
          label: '🔙 หน้าหลัก Admin',
          custom_id: 'adm:nav:hub',
        },
      ],
    });

    return {
      type: 7,
      data: {
        embeds: [embed],
        components,
      },
    };
  }

  /**
   * Approve Topup Transaction
   */
  private async handleTopupApprove(interaction: any, topupId: string) {
    const user = this.adminGuard.extractUser(interaction);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const topup = await tx.topupTransaction.findUnique({
          where: { id: topupId },
          include: { user: true },
        });

        if (!topup) throw new Error('ไม่พบรายการเติมเงินนี้ในระบบ');
        if (topup.status !== 'PENDING_VERIFY') {
          throw new Error(`รายการนี้ได้รับการประมวลผลไปแล้ว (สถานะ: ${topup.status})`);
        }

        const totalCredit = Number(topup.amount) + Number(topup.bonusAmount || 0);

        // Credit to Wallet
        await tx.wallet.upsert({
          where: { userId: topup.userId },
          create: {
            userId: topup.userId,
            balance: totalCredit,
            totalTopup: topup.amount,
          },
          update: {
            balance: { increment: totalCredit },
            totalTopup: { increment: topup.amount },
          },
        });

        const verified = await tx.topupTransaction.update({
          where: { id: topupId },
          data: {
            status: 'SUCCESS',
            verifiedBy: `Discord Admin (${user.username})`,
            verifiedAt: new Date(),
          },
        });

        return { topup, verified, totalCredit };
      });

      await this.adminAudit.log({
        action: 'ADMIN_TOPUP_APPROVE',
        targetType: 'TOPUP',
        targetId: topupId,
        actorDiscordId: user.id,
        actorUsername: user.username,
        metadata: {
          username: result.topup.user?.username,
          amount: Number(result.topup.amount),
          bonus: Number(result.topup.bonusAmount),
        },
        severity: 'MEDIUM',
      });

      try {
        await this.discordWebhook.notifyTopupVerified({
          username: result.topup.user?.username || 'ลูกค้า',
          amount: Number(result.topup.amount),
          verifiedBy: user.username,
          status: 'SUCCESS',
        });
      } catch (err: any) {
        this.logger.error(`Topup verified webhook error: ${err.message}`);
      }

      // Automatically return next pending item
      return await this.handleNavTopups(interaction);
    } catch (err: any) {
      return {
        type: 7,
        data: {
          content: `❌ การอนุมัติล้มเหลว: ${err.message}`,
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔄 กลับไปหน้ารายการเติมเงิน', custom_id: 'adm:nav:topups' },
              ],
            },
          ],
        },
      };
    }
  }

  /**
   * Modal: Reject Topup
   */
  private renderRejectTopupModal(topupId: string) {
    return {
      type: 9,
      data: {
        title: 'ปฏิเสธรายการเติมเงิน (Reject Topup)',
        custom_id: `adm:topup:submit_reject:${topupId}`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'reason',
                style: 1,
                label: 'ระบุเหตุผลการปฏิเสธ',
                placeholder: 'เช่น สลิปซ้ำ, ยอดเงินไม่ตรง, สลิปหมดอายุ',
                required: true,
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * Submit Modal: Reject Topup
   */
  private async handleModalSubmitRejectTopup(interaction: any, topupId: string) {
    const rawComponents = interaction.data?.components || [];
    let reason = 'ข้อมูลสลิปไม่ถูกต้อง';

    for (const row of rawComponents) {
      for (const comp of row.components || []) {
        if (comp.custom_id === 'reason') reason = comp.value?.trim() || reason;
      }
    }

    const user = this.adminGuard.extractUser(interaction);

    const topup = await this.prisma.topupTransaction.findUnique({
      where: { id: topupId },
      include: { user: true },
    });

    if (!topup) {
      return {
        type: 4,
        data: { flags: 64, content: '❌ ไม่พบรายการเติมเงินดังกล่าว' },
      };
    }

    await this.prisma.topupTransaction.update({
      where: { id: topupId },
      data: {
        status: 'REJECTED',
        rejectReason: reason,
        verifiedBy: `Discord Admin (${user.username})`,
        verifiedAt: new Date(),
      },
    });

    await this.adminAudit.log({
      action: 'ADMIN_TOPUP_REJECT',
      targetType: 'TOPUP',
      targetId: topupId,
      actorDiscordId: user.id,
      actorUsername: user.username,
      metadata: { reason, username: topup.user?.username },
      severity: 'MEDIUM',
    });

    try {
      await this.discordWebhook.notifyTopupVerified({
        username: topup.user?.username || 'ลูกค้า',
        amount: Number(topup.amount),
        verifiedBy: user.username,
        status: 'REJECTED',
        reason,
      });
    } catch (err: any) {
      this.logger.error(`Topup reject webhook error: ${err.message}`);
    }

    return {
      type: 4,
      data: {
        flags: 64,
        content: `❌ ปฏิเสธรายการเติมเงินของ **${topup.user?.username}** เรียบร้อยแล้ว (เหตุผล: ${reason})`,
      },
    };
  }

  // ============================================================================
  // ORDERS MANAGER VIEWS (Inspect / Refund)
  // ============================================================================

  /**
   * Orders View (adm:nav:orders)
   */
  private async handleNavOrders(
    interaction: any,
    selectedOrderId?: string,
    isModalResponse: boolean = false,
  ) {
    const recentOrders = await this.prisma.order.findMany({
      include: {
        user: true,
        product: true,
        deliveredKey: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (recentOrders.length === 0) {
      return {
        type: isModalResponse ? 4 : 7,
        data: {
          flags: isModalResponse ? 64 : undefined,
          embeds: [
            {
              title: '🛒 จัดการคำสั่งซื้อ (Orders Manager)',
              description: 'ยังไม่มีประวัติคำสั่งซื้อในระบบ',
              color: DISCORD_COLORS.NEUTRAL,
            },
          ],
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 หน้าหลัก', custom_id: 'adm:nav:hub' },
              ],
            },
          ],
        },
      };
    }

    let targetOrder =
      recentOrders.find((o) => o.id === selectedOrderId) || recentOrders[0];

    if (selectedOrderId && targetOrder.id !== selectedOrderId) {
      const fetched = await this.prisma.order.findUnique({
        where: { id: selectedOrderId },
        include: { user: true, product: true, deliveredKey: true },
      });
      if (fetched) {
        targetOrder = fetched;
      }
    }

    const lines = recentOrders.map((o, i) => {
      const statusIcon =
        o.status === 'COMPLETED'
          ? '✅'
          : o.status === 'REFUNDED'
          ? '💸'
          : o.status === 'PENDING'
          ? '⏳'
          : '❌';
      const pointer = o.id === targetOrder.id ? '👉 ' : '';
      return `${pointer}**${i + 1}.** \`${o.orderNumber}\` | **${o.product?.title}** | ฿${Number(o.amount)} | ${statusIcon} \`${o.status}\` | ผู้ซื้อ: **${o.user?.username || '-'}** (<t:${Math.floor(new Date(o.createdAt).getTime() / 1000)}:R>)`;
    });

    const selectOptions = recentOrders.map((o, i) => ({
      label: `#${i + 1} ${o.orderNumber} (${o.user?.username || 'ลูกค้า'})`.slice(0, 100),
      description: `${o.product?.title || 'สินค้า'} | ฿${Number(o.amount)} | ${o.status}`.slice(
        0,
        100,
      ),
      value: o.id,
      default: o.id === targetOrder.id,
    }));

    const components = [
      {
        type: 1,
        components: [
          {
            type: 3, // STRING_SELECT
            custom_id: 'adm:order:select',
            placeholder: 'เลือกออเดอร์ที่ต้องการจัดการ...',
            options: selectOptions,
          },
        ],
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1, // Primary
            label: `🔍 ดูรหัส (${targetOrder.orderNumber.slice(-6)})`,
            custom_id: `adm:order:view:${targetOrder.id}`,
          },
          {
            type: 2,
            style: 3, // Success
            label: '🔄 ส่งซ้ำ/เปลี่ยนไอดี',
            custom_id: `adm:order:confirm_resend:${targetOrder.id}`,
            disabled: targetOrder.status === 'FAILED' || targetOrder.status === 'REFUNDED',
          },
          {
            type: 2,
            style: 4, // Danger
            label: '💸 คืนเงิน',
            custom_id: `adm:order:confirm_refund:${targetOrder.id}`,
            disabled: targetOrder.status !== 'COMPLETED',
          },
          {
            type: 2,
            style: 4, // Danger
            label: '🚫 ยกเลิกออเดอร์',
            custom_id: `adm:order:confirm_cancel:${targetOrder.id}`,
            disabled: targetOrder.status !== 'PENDING',
          },
        ],
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: '🔎 ค้นหาออเดอร์',
            custom_id: 'adm:order:open_search',
          },
          {
            type: 2,
            style: 2,
            label: '🔄 รีเฟรช',
            custom_id: 'adm:nav:orders',
          },
          {
            type: 2,
            style: 2,
            label: '🔙 หน้าหลัก',
            custom_id: 'adm:nav:hub',
          },
        ],
      },
    ];

    return {
      type: isModalResponse ? 4 : 7,
      data: {
        flags: isModalResponse ? 64 : undefined,
        embeds: [
          {
            title: '🛒 รายการคำสั่งซื้อล่าสุด (Recent Orders)',
            description: `${lines.join('\n\n')}\n\n🎯 **กำลังเลือกจัดการ:** \`${targetOrder.orderNumber}\` (${targetOrder.product?.title || '-'}) — สถานะ \`${targetOrder.status}\``,
            color: DISCORD_COLORS.INFO,
            footer: {
              text: 'เลือกออเดอร์จากเมนูด้านล่าง หรือกดค้นหาออเดอร์ด้วยเลขออเดอร์/ชื่อผู้ใช้',
            },
          },
        ],
        components,
      },
    };
  }

  /**
   * Modal: Search Order
   */
  private renderSearchOrderModal() {
    return {
      type: 9,
      data: {
        title: 'ค้นหาคำสั่งซื้อ (Search Order)',
        custom_id: 'adm:order:submit_search',
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'query',
                style: 1,
                label: 'เลขออเดอร์ / ชื่อผู้ใช้ / อีเมล / Serial Code',
                placeholder: 'เช่น ORD-2026... หรือชื่อผู้ซื้อ',
                required: true,
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * Submit Modal: Search Order
   */
  private async handleModalSubmitSearchOrder(interaction: any) {
    const rawComponents = interaction.data?.components || [];
    let query = '';
    for (const row of rawComponents) {
      for (const comp of row.components || []) {
        if (comp.custom_id === 'query') query = comp.value?.trim() || '';
      }
    }

    if (!query) {
      return {
        type: 4,
        data: { flags: 64, content: '❌ กรุณาระบุคำค้นหา' },
      };
    }

    const found = await this.prisma.order.findFirst({
      where: {
        OR: [
          { orderNumber: { contains: query, mode: 'insensitive' } },
          { id: query },
          { user: { username: { contains: query, mode: 'insensitive' } } },
          { user: { email: { contains: query, mode: 'insensitive' } } },
          { deliveredKey: { serialCode: { contains: query, mode: 'insensitive' } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!found) {
      return {
        type: 4,
        data: {
          flags: 64,
          content: `❌ ไม่พบคำสั่งซื้อที่ตรงกับ \`${query}\``,
        },
      };
    }

    return await this.handleNavOrders(interaction, found.id, true);
  }

  /**
   * View Decrypted Credential (Ephemeral)
   */
  private async handleOrderView(interaction: any, orderId: string) {
    const user = this.adminGuard.extractUser(interaction);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true, deliveredKey: true, user: true },
    });

    if (!order) {
      return {
        type: 4,
        data: { flags: 64, content: '❌ ไม่พบข้อมูลออเดอร์ดังกล่าว' },
      };
    }

    let credentialsPlain = 'ไม่มีรหัสส่งมอบ หรือเป็นสินค้าประเภทบริการ';
    if (order.deliveredKey?.credentials) {
      try {
        credentialsPlain = decryptCredentialAes256Gcm(
          order.deliveredKey.credentials,
          this.encryptionSecret,
        );
      } catch (err: any) {
        credentialsPlain = `[ถอดรหัสไม่สำเร็จ: ${err.message}]`;
      }
    }

    await this.adminAudit.log({
      action: 'ADMIN_REVEAL_ORDER_CREDENTIAL',
      targetType: 'ORDER',
      targetId: orderId,
      actorDiscordId: user.id,
      actorUsername: user.username,
      metadata: { orderNumber: order.orderNumber },
      severity: 'MEDIUM',
      notifySecurity: true,
    });

    const embed = {
      title: `🔍 ข้อมูลลับการจัดส่ง (Order: ${order.orderNumber})`,
      description: `ข้อมูลนี้ส่งแบบลับเฉพาะคุณ (Ephemeral) ไม่รั่วไหลในห้องแชท`,
      color: DISCORD_COLORS.WARNING,
      fields: [
        { name: 'สินค้า', value: order.product?.title || '-', inline: true },
        { name: 'ผู้ซื้อ', value: `${order.user?.username} (${order.user?.email})`, inline: true },
        { name: 'ราคา', value: `฿${Number(order.amount)}`, inline: true },
        { name: 'Serial Code', value: order.deliveredKey?.serialCode || '-', inline: true },
        { name: 'สถานะ', value: `\`${order.status}\``, inline: true },
        { name: 'ข้อมูลไอดี/รหัสที่จัดส่ง (Decrypted)', value: `\`\`\`\n${credentialsPlain}\n\`\`\`` },
      ],
      timestamp: new Date().toISOString(),
    };

    return {
      type: 4,
      data: { flags: 64, embeds: [embed] },
    };
  }

  /**
   * Confirmation Dialog before Refund
   */
  private async handleOrderConfirmRefund(interaction: any, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, product: true },
    });

    if (!order) {
      return {
        type: 7,
        data: {
          content: '❌ ไม่พบออเดอร์ดังกล่าว',
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 กลับหน้าออเดอร์', custom_id: 'adm:nav:orders' },
              ],
            },
          ],
        },
      };
    }

    return {
      type: 7,
      data: {
        embeds: [
          {
            title: '⚠️ ยืนยันการคืนเงินคำสั่งซื้อ (Safety Confirmation)',
            description: `คุณแน่ใจหรือไม่ที่จะคืนเงินออเดอร์นี้?\n\n• **หมายเลขออเดอร์:** \`${order.orderNumber}\`\n• **สินค้า:** ${order.product?.title}\n• **ยอดเงินคืนเข้า Wallet:** **฿${Number(order.amount).toLocaleString()}**\n• **ผู้รับเงินคืน:** **${order.user?.username}** (${order.user?.email})`,
            color: DISCORD_COLORS.DANGER,
          },
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 4, // Danger
                label: '⚠️ ยืนยันคืนเงินทันที',
                custom_id: `adm:order:do_refund:${order.id}`,
              },
              {
                type: 2,
                style: 2,
                label: '❌ ยกเลิก',
                custom_id: 'adm:nav:orders',
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * Execute Refund to Wallet
   */
  private async handleOrderDoRefund(interaction: any, orderId: string) {
    const user = this.adminGuard.extractUser(interaction);

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const ord = await tx.order.findUnique({
          where: { id: orderId },
          include: { user: true, deliveredKey: true, product: true },
        });

        if (!ord) throw new Error('ไม่พบข้อมูลออเดอร์');
        if (ord.status === 'REFUNDED') throw new Error('ออเดอร์นี้เคยได้รับการคืนเงินแล้ว');

        // Credit back to user's wallet
        await tx.wallet.upsert({
          where: { userId: ord.userId },
          create: {
            userId: ord.userId,
            balance: ord.amount,
          },
          update: {
            balance: { increment: ord.amount },
            totalSpent: { decrement: ord.amount },
          },
        });

        // Update Order status
        const updated = await tx.order.update({
          where: { id: orderId },
          data: { status: 'REFUNDED' },
        });

        // Mark stock as DEFECTIVE so it won't be sold again
        if (ord.deliveredKey) {
          await tx.accountStock.update({
            where: { id: ord.deliveredKey.id },
            data: { status: 'CLAIMED_DEFECTIVE' },
          });
        }

        return ord;
      });

      await this.adminAudit.log({
        action: 'ADMIN_ORDER_REFUND',
        targetType: 'ORDER',
        targetId: orderId,
        actorDiscordId: user.id,
        actorUsername: user.username,
        metadata: {
          orderNumber: order.orderNumber,
          amount: Number(order.amount),
          buyer: order.user?.username,
        },
        severity: 'HIGH',
        notifySecurity: true,
      });

      try {
        await this.discordWebhook.notifySystemAlert({
          title: `💸 การคืนเงินออเดอร์ (${order.orderNumber})`,
          message: `แอดมิน ${user.username} ได้คืนเงินจำนวน ฿${Number(order.amount)} เข้ากระเป๋าเงินของคุณ ${order.user?.username} เรียบร้อยแล้ว`,
          severity: 'INFO',
          alertKey: `refund_${order.orderNumber}`,
        });
      } catch (err: any) {
        this.logger.error(`Refund webhook notify error: ${err.message}`);
      }

      return {
        type: 7,
        data: {
          embeds: [
            {
              title: '✅ ดำเนินการคืนเงินสำเร็จ (Refund Completed)',
              description: `คืนเงินจำนวน **฿${Number(order.amount).toLocaleString()}** เข้ากระเป๋าเงินของคุณ **${order.user?.username}** เรียบร้อยแล้ว`,
              color: DISCORD_COLORS.SUCCESS,
            },
          ],
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 กลับหน้าออเดอร์', custom_id: 'adm:nav:orders' },
                { type: 2, style: 2, label: '🏠 หน้าหลัก Admin', custom_id: 'adm:nav:hub' },
              ],
            },
          ],
        },
      };
    } catch (err: any) {
      return {
        type: 7,
        data: {
          content: `❌ การคืนเงินล้มเหลว: ${err.message}`,
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 กลับหน้าออเดอร์', custom_id: 'adm:nav:orders' },
              ],
            },
          ],
        },
      };
    }
  }

  /**
   * Confirmation Dialog before Cancelling Order
   */
  private async handleOrderConfirmCancel(interaction: any, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, product: true, deliveredKey: true },
    });

    if (!order) {
      return {
        type: 7,
        data: {
          content: '❌ ไม่พบออเดอร์ดังกล่าว',
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 กลับหน้าออเดอร์', custom_id: 'adm:nav:orders' },
              ],
            },
          ],
        },
      };
    }

    if (order.status !== 'PENDING') {
      return {
        type: 7,
        data: {
          content:
            '❌ สามารถยกเลิกได้เฉพาะคำสั่งซื้อที่อยู่ในสถานะ PENDING เท่านั้น หากเป็นคำสั่งซื้อที่ส่งมอบสำเร็จแล้ว (COMPLETED) กรุณาใช้ปุ่ม "💸 คืนเงิน" แทน เพื่อให้ระบบคืนยอดเงินเข้ากระเป๋าเงินลูกค้าอย่างถูกต้อง',
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 กลับหน้าออเดอร์', custom_id: 'adm:nav:orders' },
              ],
            },
          ],
        },
      };
    }

    return {
      type: 7,
      data: {
        embeds: [
          {
            title: '⚠️ ยืนยันการยกเลิกคำสั่งซื้อ (Cancel Order Confirmation)',
            description: `คุณแน่ใจหรือไม่ที่จะยกเลิกออเดอร์นี้?\n\n• **หมายเลขออเดอร์:** \`${order.orderNumber}\`\n• **สินค้า:** ${order.product?.title}\n• **ผู้ซื้อ:** **${order.user?.username}**\n• **หมายเหตุ:** การยกเลิกจะเปลี่ยนสถานะเป็น \`FAILED\` และปลดล็อกสต็อกที่ค้างสถานะ \`RESERVED\` ให้กลับเป็นพร้อมขาย (AVAILABLE) ทันที`,
            color: DISCORD_COLORS.DANGER,
          },
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 4, // Danger
                label: '⚠️ ยืนยันยกเลิกออเดอร์',
                custom_id: `adm:order:do_cancel:${order.id}`,
              },
              {
                type: 2,
                style: 2,
                label: '❌ กลับ',
                custom_id: 'adm:nav:orders',
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * Execute Cancel Order
   */
  private async handleOrderDoCancel(interaction: any, orderId: string) {
    const user = this.adminGuard.extractUser(interaction);

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const ord = await tx.order.findUnique({
          where: { id: orderId },
          include: { user: true, deliveredKey: true, product: true },
        });

        if (!ord) throw new Error('ไม่พบข้อมูลออเดอร์');
        if (ord.status !== 'PENDING') {
          throw new Error('สามารถยกเลิกได้เฉพาะคำสั่งซื้อสถานะ PENDING เท่านั้น (หากต้องการคืนเงินกรุณาใช้ฟังก์ชันคืนเงิน)');
        }

        await tx.order.update({
          where: { id: orderId },
          data: { status: 'FAILED' },
        });

        if (ord.deliveredKey && ord.deliveredKey.status === 'RESERVED') {
          await tx.accountStock.update({
            where: { id: ord.deliveredKey.id },
            data: { status: 'AVAILABLE', orderId: null },
          });
        }

        return ord;
      });

      await this.adminAudit.log({
        action: 'ADMIN_ORDER_CANCEL',
        targetType: 'ORDER',
        targetId: orderId,
        actorDiscordId: user.id,
        actorUsername: user.username,
        metadata: {
          orderNumber: order.orderNumber,
          buyer: order.user?.username,
        },
        severity: 'HIGH',
        notifySecurity: true,
      });

      return {
        type: 7,
        data: {
          embeds: [
            {
              title: '✅ ยกเลิกคำสั่งซื้อสำเร็จ (Order Cancelled)',
              description: `ออเดอร์ \`${order.orderNumber}\` ถูกเปลี่ยนสถานะเป็น \`CANCELLED\` เรียบร้อยแล้ว`,
              color: DISCORD_COLORS.SUCCESS,
            },
          ],
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 กลับหน้าออเดอร์', custom_id: 'adm:nav:orders' },
                { type: 2, style: 2, label: '🏠 หน้าหลัก Admin', custom_id: 'adm:nav:hub' },
              ],
            },
          ],
        },
      };
    } catch (err: any) {
      return {
        type: 7,
        data: {
          content: `❌ ยกเลิกออเดอร์ไม่สำเร็จ: ${err.message}`,
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 กลับหน้าออเดอร์', custom_id: 'adm:nav:orders' },
              ],
            },
          ],
        },
      };
    }
  }

  /**
   * Confirmation Dialog before Resending / Re-delivering Order
   */
  private async handleOrderConfirmResend(interaction: any, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, product: true, deliveredKey: true },
    });

    if (!order) {
      return {
        type: 7,
        data: {
          content: '❌ ไม่พบออเดอร์ดังกล่าว',
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 กลับหน้าออเดอร์', custom_id: 'adm:nav:orders' },
              ],
            },
          ],
        },
      };
    }

    const modeDesc = order.deliveredKey
      ? `ออเดอร์นี้มีรหัสเดิม (\`${order.deliveredKey.serialCode}\`) ระบบจะดึงรหัสใหม่จากคลังมาสลับให้ลูกค้า (หากมีสต็อกว่าง) หรือส่งข้อมูลรหัสเดิมซ้ำอีกครั้ง`
      : `ออเดอร์นี้ยังไม่มีรหัสที่ส่งมอบ ระบบจะดึงสต็อก \`AVAILABLE\` ชิ้นใหม่จากคลังมาผูกและส่งมอบให้ทันที`;

    return {
      type: 7,
      data: {
        embeds: [
          {
            title: '🔄 ยืนยันการส่งมอบรหัสซ้ำ / เปลี่ยนไอดีใหม่ (Re-deliver Confirmation)',
            description: `คุณต้องการดำเนินการส่งรหัสซ้ำหรือจัดสรรไอดีใหม่สำหรับออเดอร์ \`${order.orderNumber}\` ใช่หรือไม่?\n\n• **สินค้า:** ${order.product?.title}\n• **ผู้ซื้อ:** **${order.user?.username}**\n• **การทำงาน:** ${modeDesc}`,
            color: DISCORD_COLORS.WARNING,
          },
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 3, // Success
                label: '✅ ยืนยันส่งรหัสซ้ำ/เปลี่ยนไอดี',
                custom_id: `adm:order:do_resend:${order.id}`,
              },
              {
                type: 2,
                style: 2,
                label: '❌ ยกเลิก',
                custom_id: 'adm:nav:orders',
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * Execute Resend / Re-deliver Order
   */
  private async handleOrderDoResend(interaction: any, orderId: string) {
    const user = this.adminGuard.extractUser(interaction);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const ord = await tx.order.findUnique({
          where: { id: orderId },
          include: { user: true, product: true, deliveredKey: true },
        });

        if (!ord) throw new Error('ไม่พบข้อมูลออเดอร์');

        // Look for an available replacement stock if none is attached or if admin wants to swap
        const nextStock = await tx.accountStock.findFirst({
          where: { productId: ord.productId, status: 'AVAILABLE' },
          orderBy: { createdAt: 'asc' },
        });

        let activeStock = ord.deliveredKey;
        let replaced = false;

        if (nextStock) {
          if (ord.deliveredKey) {
            await tx.accountStock.update({
              where: { id: ord.deliveredKey.id },
              data: { status: 'CLAIMED_DEFECTIVE', orderId: null },
            });
          }

          activeStock = await tx.accountStock.update({
            where: { id: nextStock.id },
            data: {
              status: 'SOLD',
              orderId: ord.id,
              soldAt: new Date(),
            },
          });

          await tx.order.update({
            where: { id: ord.id },
            data: { status: 'COMPLETED' },
          });

          replaced = true;
        } else if (!activeStock) {
          throw new Error('ไม่มีสต็อกพร้อมขายในคลังสำหรับการส่งมอบใหม่');
        }

        return { ord, activeStock, replaced };
      });

      let decrypted = 'ไม่สามารถถอดรหัสได้';
      if (result.activeStock?.credentials) {
        try {
          decrypted = decryptCredentialAes256Gcm(
            result.activeStock.credentials,
            this.encryptionSecret,
          );
        } catch (err: any) {
          decrypted = `[Decryption error: ${err.message}]`;
        }
      }

      await this.adminAudit.log({
        action: 'ADMIN_ORDER_RESEND',
        targetType: 'ORDER',
        targetId: orderId,
        actorDiscordId: user.id,
        actorUsername: user.username,
        metadata: {
          orderNumber: result.ord.orderNumber,
          serialCode: result.activeStock?.serialCode,
          replaced: result.replaced,
        },
        severity: 'MEDIUM',
        notifySecurity: true,
      });

      try {
        await this.discordWebhook.notifySystemAlert({
          title: `🔄 การส่งมอบรหัสซ้ำ (${result.ord.orderNumber})`,
          message: `แอดมิน ${user.username} ได้ดำเนินการ${result.replaced ? 'สลับไอดีใหม่' : 'ดึงรหัสเดิมส่งซ้ำ'} สำหรับออเดอร์ ${result.ord.orderNumber} (ลูกค้า: ${result.ord.user?.username})`,
          severity: 'INFO',
          alertKey: `resend_${result.ord.orderNumber}`,
        });
      } catch (err: any) {
        this.logger.error(`Resend webhook notify error: ${err.message}`);
      }

      return {
        type: 7,
        data: {
          embeds: [
            {
              title: result.replaced
                ? '✅ เปลี่ยนไอดีใหม่และส่งมอบซ้ำสำเร็จ (Stock Replaced & Re-delivered)'
                : '✅ ดึงข้อมูลรหัสเดิมสำหรับส่งมอบซ้ำสำเร็จ (Credential Retrieved)',
              description: `ออเดอร์: \`${result.ord.orderNumber}\` | ผู้ซื้อ: **${result.ord.user?.username}**`,
              color: DISCORD_COLORS.SUCCESS,
              fields: [
                {
                  name: 'Serial Code',
                  value: `\`${result.activeStock?.serialCode || '-'}\``,
                  inline: true,
                },
                {
                  name: 'การดำเนินการ',
                  value: result.replaced
                    ? '🔄 ดึงไอดีใหม่จากคลังมาสลับให้ลูกค้าแล้ว'
                    : '📋 ใช้ไอดีเดิม (ไม่มีสต็อกสำรองในคลัง)',
                  inline: true,
                },
                {
                  name: 'ข้อมูลรหัสสำหรับส่งให้ลูกค้า (Ephemeral)',
                  value: `\`\`\`\n${decrypted}\n\`\`\``,
                  inline: false,
                },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 กลับหน้าออเดอร์', custom_id: 'adm:nav:orders' },
                { type: 2, style: 2, label: '🏠 หน้าหลัก Admin', custom_id: 'adm:nav:hub' },
              ],
            },
          ],
        },
      };
    } catch (err: any) {
      return {
        type: 7,
        data: {
          content: `❌ ส่งรหัสซ้ำไม่สำเร็จ: ${err.message}`,
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 2, label: '🔙 กลับหน้าออเดอร์', custom_id: 'adm:nav:orders' },
              ],
            },
          ],
        },
      };
    }
  }

  // ============================================================================
  // SUMMARY VIEW (Financial Profit & Loss)
  // ============================================================================

  /**
   * Summary View (adm:nav:summary)
   */
  private async handleNavSummary(interaction: any, period: 'today' | 'week' | 'month' = 'today') {
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    let label = 'วันนี้';

    if (period === 'week') {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      label = '7 วันล่าสุด';
    } else if (period === 'month') {
      startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      label = 'เดือนนี้';
    }

    const [ordersAgg, expensesAgg, soldStocks] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          createdAt: { gte: startDate },
          status: 'COMPLETED',
        },
        _sum: { amount: true, costAmount: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: { paidAt: { gte: startDate } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.accountStock.findMany({
        where: {
          status: 'SOLD',
          orderId: null,
          soldAt: { gte: startDate },
        },
      }),
    ]);

    // Add discord manual sales
    let discordSales = 0;
    for (const stk of soldStocks) {
      if (stk.sellingPriceText) {
        const num = parseFloat(stk.sellingPriceText.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) discordSales += num;
      }
    }

    const revenue = Number(ordersAgg._sum.amount || 0) + discordSales;
    const expense = Number(expensesAgg._sum.amount || 0);
    const netProfit = revenue - expense;
    const ordersCount = ordersAgg._count + soldStocks.length;

    const embed = {
      title: `📊 สรุปผลประกอบการ (${label})`,
      description: `ภาพรวมรายรับ รายจ่าย และผลกำไรสุทธิ (${label})`,
      color: netProfit >= 0 ? DISCORD_COLORS.SUCCESS : DISCORD_COLORS.DANGER,
      fields: [
        {
          name: '💰 ยอดขายรวม (Revenue)',
          value: `**฿${revenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}**`,
          inline: true,
        },
        {
          name: '💸 ค่าใช้จ่ายรวม (Expenses)',
          value: `**฿${expense.toLocaleString('th-TH', { minimumFractionDigits: 2 })}**`,
          inline: true,
        },
        {
          name: netProfit >= 0 ? '📈 กำไรสุทธิ (Net Profit)' : '📉 ขาดทุนสุทธิ (Net Loss)',
          value: `**฿${netProfit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}**`,
          inline: true,
        },
        {
          name: '📦 จำนวนออเดอร์/การขาย',
          value: `**${ordersCount}** รายการ`,
          inline: true,
        },
        {
          name: '🧾 รายการค่าใช้จ่าย',
          value: `**${expensesAgg._count}** รายการ`,
          inline: true,
        },
        {
          name: '🎯 อัตรากำไร (Margin)',
          value: revenue > 0 ? `**${((netProfit / revenue) * 100).toFixed(1)}%**` : '0%',
          inline: true,
        },
      ],
      footer: { text: 'KaiZort Admin • Financial Analytics' },
      timestamp: new Date().toISOString(),
    };

    const components = [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: period === 'today' ? 1 : 2,
            label: '📅 วันนี้',
            custom_id: 'adm:summary:today',
          },
          {
            type: 2,
            style: period === 'week' ? 1 : 2,
            label: '📅 7 วันล่าสุด',
            custom_id: 'adm:summary:week',
          },
          {
            type: 2,
            style: period === 'month' ? 1 : 2,
            label: '📅 เดือนนี้',
            custom_id: 'adm:summary:month',
          },
          {
            type: 2,
            style: 2,
            label: '🔙 หน้าหลัก',
            custom_id: 'adm:nav:hub',
          },
        ],
      },
    ];

    return {
      type: 7,
      data: {
        embeds: [embed],
        components,
      },
    };
  }

  // ============================================================================
  // EXISTING COMMAND HANDLERS
  // ============================================================================

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
            title: isOk ? '🌐 ระบบทำงานปกติ (All Systems Operational)' : '⚠️ พบปัญหาบางส่วนของระบบ (System Degraded)',
            color: isOk ? DISCORD_COLORS.SUCCESS : DISCORD_COLORS.WARNING,
            fields,
            footer: { text: 'KaiZort Admin System' },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleStatusCheck() {
    const health = await this.healthService.getDeepHealth();
    const db = health.components.database;
    const outbox = health.components.outbox;
    const bots = health.components.discordBots;

    const fields = [
      {
        name: 'Supabase Database',
        value: `สถานะ: \`${db.status}\`\nLatency: \`${db.latencyMs ?? '-'}ms\``,
        inline: true,
      },
      {
        name: 'Discord Outbox',
        value: `สถานะ: \`${outbox.status}\`\nค้าง: \`${outbox.pending}\` | ล้มเหลว: \`${outbox.failed}\``,
        inline: true,
      },
      {
        name: 'Discord Bots',
        value: `NotifyBot: \`${bots.notifyBot.status}\`\nOpsBot: \`${bots.opsBot.status}\``,
        inline: true,
      },
      {
        name: 'Server Resource',
        value: `RSS: \`${health.system.memoryUsageMB.rss} MB\`\nHeap: \`${health.system.memoryUsageMB.heapUsed}/${health.system.memoryUsageMB.heapTotal} MB\``,
        inline: false,
      },
    ];

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: `📊 รายงานสถานะความพร้อมของระบบ (${health.status})`,
            color: health.status === 'HEALTHY' ? DISCORD_COLORS.SUCCESS : DISCORD_COLORS.WARNING,
            fields,
            footer: { text: 'KaiZort Ops & Admin' },
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
        _count: {
          select: {
            stocks: {
              where: { status: 'AVAILABLE' },
            },
          },
        },
      },
    });

    const lines = products.map((p) => {
      const count = p._count.stocks;
      const warn = count === 0 ? '❌ หมด' : count <= 3 ? '⚠️ ใกล้หมด' : '✅ ปกติ';
      return `• **${p.title}** (\`${p.code}\`): **${count}** ชิ้น (${warn})`;
    });

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: '📦 รายงานสต็อกสินค้าคงเหลือ (Stock Inventory)',
            description: lines.length > 0 ? lines.join('\n') : 'ไม่มีสินค้าในระบบ',
            color: DISCORD_COLORS.INFO,
            footer: { text: 'KaiZort Store Inventory' },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleStockLogs(hours: number) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        targetType: { in: ['STOCK', 'PRODUCT', 'ACCOUNT_STOCK'] },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const lines = logs.map(
      (l) => `• \`${l.action}\` [${l.targetType}] <t:${Math.floor(l.createdAt.getTime() / 1000)}:R>`,
    );

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: `📜 บันทึกความเคลื่อนไหวสต็อก (${hours} ชม. ล่าสุด)`,
            description: lines.length > 0 ? lines.join('\n') : 'ไม่มีบันทึกในช่วงเวลาที่ระบุ',
            color: DISCORD_COLORS.INFO,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleOrders(statusFilter?: string) {
    const where: any = {};
    if (statusFilter && statusFilter !== 'ALL') {
      where.status = statusFilter;
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: { user: true, product: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    const lines = orders.map(
      (o) =>
        `• \`${o.orderNumber}\` - **${o.product?.title}** (฿${Number(o.amount)}) - \`${o.status}\` โดย **${o.user?.username || '-'}** (<t:${Math.floor(o.createdAt.getTime() / 1000)}:R>)`,
    );

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: `🛒 รายการคำสั่งซื้อล่าสุด (Filter: ${statusFilter || 'ALL'})`,
            description: lines.length > 0 ? lines.join('\n') : 'ไม่พบคำสั่งซื้อ',
            color: DISCORD_COLORS.INFO,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleTopups(statusFilter?: string) {
    const where: any = {};
    if (statusFilter && statusFilter !== 'ALL') {
      where.status = statusFilter;
    }

    const topups = await this.prisma.topupTransaction.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    const lines = topups.map(
      (t) =>
        `• \`${t.transactionCode || t.id.slice(0, 8)}\` - **฿${Number(t.amount)}** (\`${t.status}\`) โดย **${t.user?.username || '-'}** (<t:${Math.floor(t.createdAt.getTime() / 1000)}:R>)`,
    );

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: `💳 ประวัติการเติมเงิน (Filter: ${statusFilter || 'ALL'})`,
            description: lines.length > 0 ? lines.join('\n') : 'ไม่พบรายการเติมเงิน',
            color: DISCORD_COLORS.INFO,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleTickets() {
    const tickets = await this.prisma.ticket.findMany({
      where: { status: { in: ['OPEN', 'PENDING'] } },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    const lines = tickets.map(
      (t) =>
        `• \`${t.id.slice(0, 8)}\` - **${t.subject || 'ไม่มีหัวข้อ'}** (\`${t.status}\`) โดย **${t.user?.username || '-'}** (<t:${Math.floor(t.createdAt.getTime() / 1000)}:R>)`,
    );

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: '🎫 รายการทิคเก็ตที่รอดำเนินการ (Open Tickets)',
            description: lines.length > 0 ? lines.join('\n') : 'ไม่มีทิคเก็ตค้างในขณะนี้',
            color: DISCORD_COLORS.INFO,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  private async handleSummary(period: string) {
    const p = period === 'month' ? 'month' : period === 'week' ? 'week' : 'today';
    return await this.handleNavSummary(null, p);
  }

  private async handleUpdates(hours: number) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const audits = await this.prisma.auditLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    const lines = audits.map(
      (a) => `• \`${a.action}\` [${a.targetType}] <t:${Math.floor(a.createdAt.getTime() / 1000)}:R>`,
    );

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: `📝 บันทึกการอัปเดตระบบ (${hours} ชม. ล่าสุด)`,
            description: lines.length > 0 ? lines.join('\n') : 'ไม่มีการเปลี่ยนแปลงล่าสุด',
            color: DISCORD_COLORS.INFO,
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
            title: '📬 สถานะคิวส่งข้อความ Discord Outbox',
            color: stats.failed > 0 ? DISCORD_COLORS.WARNING : DISCORD_COLORS.SUCCESS,
            fields: [
              { name: 'ค้างส่ง (Pending)', value: `\`${stats.pending}\``, inline: true },
              { name: 'ส่งสำเร็จ (Sent)', value: `\`${stats.sent}\``, inline: true },
              { name: 'ล้มเหลว (Failed)', value: `\`${stats.failed}\``, inline: true },
            ],
            footer: { text: 'KaiZort Ops Bot' },
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
          content: 'กรุณาระบุชื่อการแจ้งเตือนที่ต้องการปิดเสียง (เช่น system_watchdog_incident)',
        },
      };
    }

    const muteUntil = new Date(Date.now() + minutes * 60 * 1000);
    await this.prisma.alertState.upsert({
      where: { key: alertName },
      create: { key: alertName, mutedUntil: muteUntil },
      update: { mutedUntil: muteUntil },
    });

    return {
      type: 4,
      data: {
        flags: 64,
        embeds: [
          {
            title: `[Mute Alert] ปิดเสียงแจ้งเตือนสำเร็จ`,
            description: `ปิดเสียงแจ้งเตือน \`${alertName}\` เป็นเวลา **${minutes} นาที**`,
            color: DISCORD_COLORS.WARNING,
            footer: { text: 'KaiZort Ops Bot' },
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }
}
