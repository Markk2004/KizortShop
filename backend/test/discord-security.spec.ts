import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DiscordInteractionsService } from '../src/modules/discord-interactions/discord-interactions.service';
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
            product: { findMany: jest.fn().mockResolvedValue([]) },
            accountStock: { findMany: jest.fn().mockResolvedValue([]) },
            order: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
            topupTransaction: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
            ticket: { findMany: jest.fn().mockResolvedValue([]) },
            expense: { findMany: jest.fn().mockResolvedValue([]) },
            user: { count: jest.fn().mockResolvedValue(0) },
            auditLog: { findMany: jest.fn().mockResolvedValue([]) },
            alertState: { upsert: jest.fn().mockResolvedValue({}) },
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
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (module) {
      await module.close();
    }
  });
});
