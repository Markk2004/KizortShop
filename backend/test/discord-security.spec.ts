import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DiscordInteractionsService } from '../src/modules/discord-interactions/discord-interactions.service';
import { AdminGuardService } from '../src/modules/discord-interactions/admin-guard.service';
import { AdminAuditService } from '../src/modules/discord-interactions/admin-audit.service';
import { DiscordWebhookService } from '../src/common/webhook/discord-webhook.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { DiscordOutboxService } from '../src/common/discord/discord-outbox.service';
import { HealthService } from '../src/modules/health/health.service';
import * as nacl from 'tweetnacl';

describe('Discord Admin & Outbox Security Unit Tests', () => {
  let interactionsService: DiscordInteractionsService;
  let configService: ConfigService;
  let keyPair: nacl.SignKeyPair;
  let module: TestingModule;

  beforeAll(() => {
    keyPair = nacl.sign.keyPair();
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        DiscordInteractionsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'DISCORD_OPS_PUBLIC_KEY') {
                return Buffer.from(keyPair.publicKey).toString('hex');
              }
              if (key === 'NODE_ENV') return 'production';
              if (key === 'DISCORD_ADMIN_ROLE_ID') return '1122334455667788';
              return null;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            product: {
              findMany: jest.fn().mockResolvedValue([]),
              findFirst: jest.fn().mockResolvedValue(null),
            },
            accountStock: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn().mockResolvedValue(null),
              findFirst: jest.fn().mockResolvedValue(null),
              count: jest.fn().mockResolvedValue(12),
              create: jest.fn().mockResolvedValue({}),
              createMany: jest.fn().mockResolvedValue({ count: 1 }),
              update: jest.fn().mockResolvedValue({}),
              delete: jest.fn().mockResolvedValue({}),
            },
            order: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn().mockResolvedValue(null),
              findFirst: jest.fn().mockResolvedValue(null),
              count: jest.fn().mockResolvedValue(3),
              update: jest.fn().mockResolvedValue({}),
              aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 500, costAmount: 100 }, _count: 2 }),
            },
            topupTransaction: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn().mockResolvedValue(null),
              count: jest.fn().mockResolvedValue(1),
              update: jest.fn().mockResolvedValue({}),
            },
            wallet: {
              upsert: jest.fn().mockResolvedValue({}),
            },
            ticket: { findMany: jest.fn().mockResolvedValue([]) },
            expense: {
              findMany: jest.fn().mockResolvedValue([]),
              findFirst: jest.fn().mockResolvedValue(null),
              findUnique: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({ id: 'exp-1' }),
              update: jest.fn().mockResolvedValue({ id: 'exp-1' }),
              delete: jest.fn().mockResolvedValue({ id: 'exp-1' }),
              aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 150 }, _count: 1 }),
            },
            user: { count: jest.fn().mockResolvedValue(0) },
            auditLog: {
              findMany: jest.fn().mockResolvedValue([]),
              create: jest.fn().mockResolvedValue({}),
            },
            alertState: { upsert: jest.fn().mockResolvedValue({}) },
            $transaction: jest.fn().mockImplementation(async (cb) =>
              cb({
                topupTransaction: {
                  findUnique: jest.fn().mockResolvedValue({
                    id: 'top-1',
                    userId: 'u-1',
                    amount: 100,
                    bonusAmount: 0,
                    status: 'PENDING_VERIFY',
                    user: { username: 'tester' },
                  }),
                  update: jest.fn().mockResolvedValue({ id: 'top-1', status: 'SUCCESS' }),
                },
                wallet: { upsert: jest.fn().mockResolvedValue({}) },
                order: {
                  findUnique: jest.fn().mockImplementation(async ({ where }) => ({
                    id: where?.id || 'ord-1',
                    orderNumber: 'ORD-001',
                    userId: 'u-1',
                    productId: 'prod-1',
                    amount: 250,
                    status: where?.id === 'ord-cancel' ? 'PENDING' : 'COMPLETED',
                    user: { username: 'buyer1', email: 'buyer1@test.com' },
                    product: { title: 'Kaitun V4' },
                    deliveredKey: {
                      id: 'stk-1',
                      serialCode: 'STK-001',
                      status: 'RESERVED',
                      credentials: '',
                    },
                  })),
                  update: jest.fn().mockResolvedValue({ id: 'ord-1' }),
                },
                accountStock: {
                  findFirst: jest.fn().mockResolvedValue(null),
                  update: jest.fn().mockResolvedValue({
                    id: 'stk-1',
                    serialCode: 'STK-001',
                    credentials: '',
                  }),
                },
              }),
            ),
          },
        },
        {
          provide: DiscordOutboxService,
          useValue: {
            getStats: jest.fn().mockResolvedValue({ pending: 0, processing: 0, sent: 5, failed: 0, skipped: 1 }),
            retryAllFailed: jest.fn().mockResolvedValue({ count: 0 }),
          },
        },
        {
          provide: HealthService,
          useValue: {
            getDeepHealth: jest.fn().mockResolvedValue({
              status: 'HEALTHY',
              components: {
                database: { status: 'UP', latencyMs: 20 },
                discordBots: { notifyBot: { status: 'UP' }, opsBot: { status: 'UP' } },
                outbox: { status: 'HEALTHY', pending: 0, failed: 0, sent: 5 },
                frontend: { status: 'UP', url: 'https://test.shop', latencyMs: 15 },
              },
              system: { nodeVersion: 'v20', memoryUsageMB: { rss: 80, heapUsed: 30 } },
            }),
          },
        },
        {
          provide: AdminGuardService,
          useValue: {
            verifyAdmin: jest.fn().mockImplementation((interaction) => {
              const roles = interaction?.member?.roles || [];
              const allowed = roles.includes('1122334455667788');
              return Promise.resolve({
                allowed,
                user: { id: 'admin-1', username: 'Owner', globalName: 'Owner', roles },
                reason: allowed
                  ? undefined
                  : '[Access Denied] เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถใช้คำสั่งนี้ได้',
              });
            }),
            extractUser: jest.fn().mockReturnValue({ id: 'admin-1', username: 'Owner', globalName: 'Owner' }),
          },
        },
        {
          provide: AdminAuditService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DiscordWebhookService,
          useValue: {
            notifySecurityAudit: jest.fn().mockResolvedValue(true),
            notifyStockImport: jest.fn().mockResolvedValue(true),
            notifyStockRemoved: jest.fn().mockResolvedValue(true),
            notifyExpenseAction: jest.fn().mockResolvedValue(true),
            notifyTopupVerified: jest.fn().mockResolvedValue(true),
            notifySystemAlert: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    interactionsService = module.get<DiscordInteractionsService>(DiscordInteractionsService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('1. Ed25519 Security & Signature Verification', () => {
    it('should accept valid cryptographic Ed25519 signature', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({ type: 1 });
      const message = Buffer.concat([
        Buffer.from(timestamp, 'utf-8'),
        Buffer.from(rawBody, 'utf-8'),
      ]);
      const signature = Buffer.from(nacl.sign.detached(message, keyPair.secretKey)).toString('hex');

      const isValid = interactionsService.verifySignature(signature, timestamp, rawBody);
      expect(isValid).toBe(true);
    });

    it('should reject tampered message body with valid signature', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify({ type: 1 });
      const message = Buffer.concat([
        Buffer.from(timestamp, 'utf-8'),
        Buffer.from(rawBody, 'utf-8'),
      ]);
      const signature = Buffer.from(nacl.sign.detached(message, keyPair.secretKey)).toString('hex');

      const tamperedBody = JSON.stringify({ type: 2, malicious: true });
      const isValid = interactionsService.verifySignature(signature, timestamp, tamperedBody);
      expect(isValid).toBe(false);
    });

    it('should fail-closed in production if public key is not configured', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'DISCORD_OPS_PUBLIC_KEY') return null;
        if (key === 'NODE_ENV') return 'production';
        return null;
      });

      const isValid = interactionsService.verifySignature('any', 'any', '{}');
      expect(isValid).toBe(false);
    });
  });

  describe('2. Admin Permission Guard', () => {
    it('should deny non-admin users without admin role or admin permissions', () => {
      const nonAdminInteraction = {
        member: {
          roles: ['9999999999'],
          permissions: '0',
        },
      };

      const hasPerm = interactionsService.hasAdminPermission(nonAdminInteraction);
      expect(hasPerm).toBe(false);
    });

    it('should allow user with configured admin role', () => {
      const adminInteraction = {
        member: {
          roles: ['1122334455667788'],
          permissions: '0',
        },
      };

      const hasPerm = interactionsService.hasAdminPermission(adminInteraction);
      expect(hasPerm).toBe(true);
    });

    it('should allow user with Administrator permission bit (0x8)', () => {
      const adminInteraction = {
        member: {
          roles: ['some_other_role'],
          permissions: '8', // 0x8
        },
      };

      const hasPerm = interactionsService.hasAdminPermission(adminInteraction);
      expect(hasPerm).toBe(true);
    });
  });

  describe('3. Slash Command Execution & Mute Alert', () => {
    it('should return ephemeral error if non-admin attempts command execution', async () => {
      const interaction = {
        data: { name: 'status' },
        member: { roles: ['non_admin'], permissions: '0' },
      };

      const res = await interactionsService.handleCommand(interaction);
      expect(res.type).toBe(4);
      expect(res.data.flags).toBe(64);
      expect(res.data.content).toContain('Access Denied');
    });

    it('should execute /mute command and save mute duration to AlertState', async () => {
      const interaction = {
        data: {
          name: 'mute',
          options: [
            { name: 'alert', value: 'system_watchdog_incident' },
            { name: 'minutes', value: 30 },
          ],
        },
        member: { roles: ['1122334455667788'], permissions: '0' },
      };

      const res = await interactionsService.handleCommand(interaction);
      expect(res.type).toBe(4);
      expect(res.data.embeds[0].title).toContain('Mute Alert');
      expect(res.data.embeds[0].description).toContain('30 นาที');
    });

    it('should execute /ping wake-up command and return ephemeral pong', async () => {
      const interaction = {
        data: { name: 'ping' },
        member: { roles: ['1122334455667788'], permissions: '0' },
      };

      const res = await interactionsService.handleCommand(interaction);
      expect(res.type).toBe(4);
      expect(res.data.flags).toBe(64);
      expect(res.data.content).toContain('Pong!');
    });

    it('should open unified /admin hub with action buttons including Python bot shortcut', async () => {
      const interaction = {
        data: { name: 'admin' },
        member: { roles: ['1122334455667788'], permissions: '0' },
      };

      const res = await interactionsService.handleCommand(interaction);
      expect(res.type).toBe(4);
      expect(res.data.flags).toBe(64);
      expect(res.data.embeds[0].title).toContain('KaiZort Admin Control Hub');
      const allCustomIds = res.data.components.flatMap((row: any) =>
        row.components.map((c: any) => c.custom_id),
      );
      expect(allCustomIds).toEqual(
        expect.arrayContaining([
          'adm:nav:stock',
          'adm:nav:expense',
          'adm:nav:topups',
          'adm:nav:orders',
          'adm:nav:summary',
          'adm:nav:pybot',
        ]),
      );
    });
  });

  describe('4. Unified Admin Component & Modal Actions (Phase 1-4)', () => {
    it('should block unauthorized user from clicking adm:* buttons', async () => {
      const interaction = {
        data: { custom_id: 'adm:nav:stock' },
        member: { roles: ['non_admin'], permissions: '0' },
      };

      const res = await interactionsService.handleComponent(interaction);
      expect(res.type).toBe(4);
      expect(res.data.flags).toBe(64);
      expect(res.data.content).toContain('Access Denied');
    });

    it('should render Python Bot shortcut guide on adm:nav:pybot', async () => {
      const interaction = {
        data: { custom_id: 'adm:nav:pybot' },
        member: { roles: ['1122334455667788'], permissions: '0' },
      };

      const res = await interactionsService.handleComponent(interaction);
      expect(res.type).toBe(7);
      expect(res.data.embeds[0].title).toContain('KaiZort Support');
    });

    it('should open Edit Stock Modal on adm:stock:open_edit:<id>', async () => {
      const prisma = module.get<PrismaService>(PrismaService);
      (prisma.accountStock.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'stk-99',
        serialCode: 'STK-BF-99',
        maskedIdentity: 'us***99',
        details: 'Max Level',
        sellingPriceText: '150',
        product: { title: 'Blox Fruits V4', price: 150 },
      });

      const interaction = {
        data: { custom_id: 'adm:stock:open_edit:stk-99' },
        member: { roles: ['1122334455667788'], permissions: '0' },
      };

      const res = await interactionsService.handleComponent(interaction);
      expect(res.type).toBe(9);
      expect(res.data.custom_id).toBe('adm:stock:submit_edit:stk-99');
    });

    it('should open Edit Expense Modal on adm:expense:open_edit_latest', async () => {
      const prisma = module.get<PrismaService>(PrismaService);
      (prisma.expense.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'exp-55' });
      (prisma.expense.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'exp-55',
        title: 'VPS Server',
        amount: 450,
        category: 'VPS',
        note: 'Monthly',
      });

      const interaction = {
        data: { custom_id: 'adm:expense:open_edit_latest' },
        member: { roles: ['1122334455667788'], permissions: '0' },
      };

      const res = await interactionsService.handleComponent(interaction);
      expect(res.type).toBe(9);
      expect(res.data.custom_id).toBe('adm:expense:submit_edit:exp-55');
    });

    it('should execute Topup Approve, Order Refund, Order Cancel, and Order Resend', async () => {
      const adminMember = { roles: ['1122334455667788'], permissions: '0' };

      const approveRes = await interactionsService.handleComponent({
        data: { custom_id: 'adm:topup:approve:top-1' },
        member: adminMember,
      });
      expect(approveRes.type).toBe(7);

      const refundRes = await interactionsService.handleComponent({
        data: { custom_id: 'adm:order:do_refund:ord-1' },
        member: adminMember,
      });
      expect(refundRes.type).toBe(7);
      expect(refundRes.data.embeds[0].title).toContain('Refund Completed');

      const cancelRes = await interactionsService.handleComponent({
        data: { custom_id: 'adm:order:do_cancel:ord-cancel' },
        member: adminMember,
      });
      expect(cancelRes.type).toBe(7);
      expect(cancelRes.data.embeds[0].title).toContain('Order Cancelled');

      const resendRes = await interactionsService.handleComponent({
        data: { custom_id: 'adm:order:do_resend:ord-1' },
        member: adminMember,
      });
      expect(resendRes.type).toBe(7);
      expect(resendRes.data.embeds[0].title).toContain('Credential Retrieved');
    });

    it('should block cancelling a COMPLETED order and instruct admin to use refund', async () => {
      const prisma = module.get<PrismaService>(PrismaService);
      (prisma.order.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'ord-completed',
        orderNumber: 'ORD-999',
        status: 'COMPLETED',
      });

      const res = await interactionsService.handleComponent({
        data: { custom_id: 'adm:order:confirm_cancel:ord-completed' },
        member: { roles: ['1122334455667788'], permissions: '0' },
      });
      expect(res.type).toBe(7);
      expect(res.data.content).toContain('สามารถยกเลิกได้เฉพาะคำสั่งซื้อที่อยู่ในสถานะ PENDING เท่านั้น');
    });

    it('should support Stock Product SKU filter and Stock Search modal', async () => {
      const adminMember = { roles: ['1122334455667788'], permissions: '0' };
      const prisma = module.get<PrismaService>(PrismaService);
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 'p1', code: 'BF-V4', title: 'Blox Fruits V4', price: 150, _count: { stocks: 3 } },
      ]);

      const filterRes = await interactionsService.handleComponent({
        data: { custom_id: 'adm:stock:filter_product', values: ['BF-V4'] },
        member: adminMember,
      });
      expect(filterRes.type).toBe(7);
      expect(filterRes.data.embeds[0].description).toContain('กำลังกรองเฉพาะสินค้า');

      const searchModalRes = await interactionsService.handleComponent({
        data: { custom_id: 'adm:stock:open_search' },
        member: adminMember,
      });
      expect(searchModalRes.type).toBe(9);
      expect(searchModalRes.data.custom_id).toBe('adm:stock:submit_search');
    });

    it('should support Expense Select Menu for selecting any recent expense', async () => {
      const adminMember = { roles: ['1122334455667788'], permissions: '0' };
      const prisma = module.get<PrismaService>(PrismaService);
      (prisma.expense.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 'exp-1', title: 'VPS-1', amount: 300, category: 'VPS', paidAt: new Date() },
        { id: 'exp-2', title: 'Script-2', amount: 500, category: 'SCRIPT', paidAt: new Date() },
      ]);

      const selectRes = await interactionsService.handleComponent({
        data: { custom_id: 'adm:expense:select', values: ['exp-2'] },
        member: adminMember,
      });
      expect(selectRes.type).toBe(7);
      expect(selectRes.data.embeds[0].description).toContain('กำลังเลือก');
    });

    it('should display inline slip image preview and queue select menu on topups view', async () => {
      const adminMember = { roles: ['1122334455667788'], permissions: '0' };
      const prisma = module.get<PrismaService>(PrismaService);
      (prisma.topupTransaction.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'top-1',
          amount: 250,
          bonusAmount: 0,
          paymentMethod: 'PROMPTPAY',
          transactionCode: 'TX-1',
          createdAt: new Date(),
          slipUrl: 'https://images.unsplash.com/slip1.jpg',
          user: { username: 'buyer1', email: 'b1@test.com' },
        },
        {
          id: 'top-2',
          amount: 500,
          bonusAmount: 50,
          paymentMethod: 'TRUEWALLET',
          transactionCode: 'TX-2',
          createdAt: new Date(),
          slipUrl: 'https://images.unsplash.com/slip2.jpg',
          user: { username: 'buyer2', email: 'b2@test.com' },
        },
      ]);

      const topupsRes = await interactionsService.handleComponent({
        data: { custom_id: 'adm:nav:topups' },
        member: adminMember,
      });
      expect(topupsRes.type).toBe(7);
      expect(topupsRes.data.embeds[0].image?.url).toBe('https://images.unsplash.com/slip1.jpg');
      expect(topupsRes.data.components[0].components[0].custom_id).toBe('adm:topup:select');
    });
  });

  describe('5. AdminGuardService Dual-Layer Verification (Allowlist + Role)', () => {
    it('should enforce DISCORD_ADMIN_USER_IDS allowlist and notify security audit on violation', async () => {
      const webhookMock = { notifySecurityAudit: jest.fn().mockResolvedValue(true) };
      const realGuard = new AdminGuardService(
        {
          get: jest.fn((key: string) => {
            if (key === 'DISCORD_ADMIN_USER_IDS') return '282304584716779532';
            if (key === 'DISCORD_ADMIN_ROLE_ID') return '1122334455667788';
            return null;
          }),
        } as any,
        webhookMock as any,
      );

      // Unauthorized user ID even with admin role
      const denied = await realGuard.verifyAdmin(
        {
          member: {
            user: { id: '999999999999999999', username: 'intruder' },
            roles: ['1122334455667788'],
            permissions: '8',
          },
        },
        '/admin',
      );
      expect(denied.allowed).toBe(false);
      expect(webhookMock.notifySecurityAudit).toHaveBeenCalled();

      // Authorized user ID + Admin Role
      const allowed = await realGuard.verifyAdmin(
        {
          member: {
            user: { id: '282304584716779532', username: 'owner' },
            roles: ['1122334455667788'],
            permissions: '0',
          },
        },
        '/admin',
      );
      expect(allowed.allowed).toBe(true);
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (module) {
      await module.close();
    }
  });
});
