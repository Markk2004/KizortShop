import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from '../src/modules/orders/orders.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { TicketsService } from '../src/modules/tickets/tickets.service';
import { BotSyncController } from '../src/modules/bot-sync/bot-sync.controller';
import { DiscordWebhookService } from '../src/common/webhook/discord-webhook.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

describe('Business Events & Discord Notifications Unit Tests', () => {
  let ordersService: OrdersService;
  let paymentsService: PaymentsService;
  let ticketsService: TicketsService;
  let botSyncController: BotSyncController;
  let webhookService: DiscordWebhookService;
  let prismaService: PrismaService;
  let module: TestingModule;

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'user-1') {
            return Promise.resolve({
              id: 'user-1',
              username: 'player_one',
              wallet: { balance: 1000 },
            });
          }
          return Promise.resolve(null);
        }),
      },
      product: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'prod-1') {
            return Promise.resolve({
              id: 'prod-1',
              code: 'BF-V4',
              title: 'Blox Fruits V4',
              price: 350,
              isActive: true,
              stocks: [{ id: 'stock-1', serialCode: 'STK-001', costPrice: 150 }],
            });
          }
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'prod-1',
          code: 'KAITUN-VAULT-POOL',
          title: 'Vault Pool',
        }),
      },
      accountStock: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue({
          id: 'stk-1',
          serialCode: 'STK-001',
          username: 'bot_acc_1',
          maskedIdentity: 'bo***',
          product: { title: 'Blox Fruits V4' },
        }),
        update: jest.fn().mockResolvedValue({ id: 'stk-1', status: 'SOLD' }),
        delete: jest.fn().mockResolvedValue({ id: 'stk-1' }),
        create: jest.fn().mockResolvedValue({ id: 'stk-2', serialCode: 'STK-002' }),
      },
      wallet: {
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
      },
      order: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'ord-1', ...data, createdAt: new Date() }),
        ),
      },
      topupTransaction: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'top-1', ...data, createdAt: new Date() }),
        ),
        findUnique: jest.fn().mockResolvedValue({
          id: 'top-1',
          userId: 'user-1',
          amount: 500,
          status: 'PENDING_VERIFY',
          user: { username: 'player_one' },
        }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'top-1', ...data }),
        ),
      },
      ticket: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'tick-1', ...data, createdAt: new Date() }),
        ),
        findUnique: jest.fn().mockResolvedValue({ id: 'tick-1', status: 'OPEN' }),
        update: jest.fn().mockResolvedValue({ id: 'tick-1', status: 'CLOSED' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      }),
    };

    const mockWebhook = {
      notifyOrderCreated: jest.fn().mockResolvedValue(true),
      notifyLowStock: jest.fn().mockResolvedValue(true),
      notifyTopupSubmitted: jest.fn().mockResolvedValue(true),
      notifyTopupVerified: jest.fn().mockResolvedValue(true),
      notifyTicketCreated: jest.fn().mockResolvedValue(true),
      notifyStockRemoved: jest.fn().mockResolvedValue(true),
      notifyKaitunSync: jest.fn().mockResolvedValue(true),
    };

    module = await Test.createTestingModule({
      controllers: [BotSyncController],
      providers: [
        OrdersService,
        PaymentsService,
        TicketsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DiscordWebhookService, useValue: mockWebhook },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'BOT_API_KEY') return 'secret_test_bot_key_12345';
              if (key === 'LOW_STOCK_THRESHOLD') return '2';
              if (key === 'LARGE_TOPUP_AMOUNT') return '2000';
              return null;
            }),
          },
        },
      ],
    }).compile();

    ordersService = module.get<OrdersService>(OrdersService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
    ticketsService = module.get<TicketsService>(TicketsService);
    botSyncController = module.get<BotSyncController>(BotSyncController);
    webhookService = module.get<DiscordWebhookService>(DiscordWebhookService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('1. Orders Service & Notifications', () => {
    it('should successfully checkout order and trigger notifyOrderCreated & notifyLowStock', async () => {
      const result = await ordersService.checkout({
        userId: 'user-1',
        productId: 'prod-1',
      });

      expect(result.orderNumber).toBeDefined();
      expect(result.deliveredSerial).toBe('STK-001');
      expect(webhookService.notifyOrderCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'player_one',
          productTitle: 'Blox Fruits V4',
          amount: 350,
          stockSerial: 'STK-001',
        }),
      );
      // Since remaining count is 1 <= threshold 2, notifyLowStock must be triggered
      expect(webhookService.notifyLowStock).toHaveBeenCalledWith(
        expect.objectContaining({
          productTitle: 'Blox Fruits V4',
          remaining: 1,
          threshold: 2,
        }),
      );
    });

    it('should throw error when user balance is insufficient', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValueOnce({
        id: 'user-poor',
        username: 'poor_user',
        wallet: { balance: 50 },
      } as any);

      await expect(
        ordersService.checkout({ userId: 'user-poor', productId: 'prod-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Payments Service & Large Topup Flag', () => {
    it('should submit topup and trigger notifyTopupSubmitted', async () => {
      const topup = await paymentsService.submitTopup({
        userId: 'user-1',
        amount: 2500,
        paymentMethod: 'PROMPTPAY_QR',
        slipRef: 'SLIP-999',
      });

      expect(topup.id).toBe('top-1');
      expect(webhookService.notifyTopupSubmitted).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'player_one',
          amount: 2500,
          slipRef: 'SLIP-999',
        }),
      );
    });

    it('should verify topup and credit wallet on SUCCESS', async () => {
      const verified = await paymentsService.verifyTopup('top-1', {
        status: 'SUCCESS',
        verifiedBy: 'admin_test',
      });

      expect(verified.status).toBe('SUCCESS');
      expect(webhookService.notifyTopupVerified).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'player_one',
          amount: 500,
          status: 'SUCCESS',
          verifiedBy: 'admin_test',
        }),
      );
    });
  });

  describe('3. Tickets Service', () => {
    it('should open ticket and trigger notifyTicketCreated', async () => {
      const ticket = await ticketsService.createTicket({
        userId: 'user-1',
        subject: 'รหัสผ่านเข้าไม่ได้',
        detail: 'ช่วยตรวจไอดีที่ซื้อไปด้วยครับ',
        orderId: 'ord-100',
      });

      expect(ticket.id).toBe('tick-1');
      expect(webhookService.notifyTicketCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'player_one',
          subject: 'รหัสผ่านเข้าไม่ได้',
          orderId: 'ord-100',
        }),
      );
    });
  });

  describe('4. Bot Sync Controller (upsert, sold, remove)', () => {
    const validKey = 'secret_test_bot_key_12345';

    it('should reject requests with invalid bot API key', async () => {
      await expect(
        botSyncController.upsertAccount('wrong_key', {
          username: 'test_user',
          password: 'test_pass',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should mark account as sold via POST /bot/kaitun/sold', async () => {
      const res = await botSyncController.markSold(validKey, {
        username: 'bot_acc_1',
      });

      expect(res.status).toBe('success');
      expect(webhookService.notifyKaitunSync).toHaveBeenCalledWith(
        'SOLD',
        expect.objectContaining({ username: 'bot_acc_1' }),
      );
    });

    it('should remove account via POST /bot/kaitun/remove', async () => {
      const res = await botSyncController.removeAccount(validKey, {
        username: 'bot_acc_1',
      });

      expect(res.status).toBe('success');
      expect(webhookService.notifyStockRemoved).toHaveBeenCalledWith(
        expect.objectContaining({
          serialCode: 'STK-001',
          productTitle: 'Blox Fruits V4',
        }),
      );
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (module) {
      await module.close();
    }
  });
});
