import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from '../src/modules/health/health.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { DiscordRestService } from '../src/common/discord/discord-rest.service';
import { DiscordOutboxService } from '../src/common/discord/discord-outbox.service';
import { DiscordWebhookService } from '../src/common/webhook/discord-webhook.service';

describe('HealthService Unit Tests', () => {
  let healthService: HealthService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue([{ ping: 1 }]),
          },
        },
        {
          provide: DiscordRestService,
          useValue: {
            checkBotHealth: jest.fn().mockImplementation((type: string) => {
              return Promise.resolve({ ok: true, botType: type, username: `${type}_bot` });
            }),
          },
        },
        {
          provide: DiscordOutboxService,
          useValue: {
            getStats: jest.fn().mockResolvedValue({ pending: 0, processing: 0, sent: 10, failed: 0, skipped: 2 }),
          },
        },
        {
          provide: DiscordWebhookService,
          useValue: {
            notifySystemAlert: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'FRONTEND_URL') return 'https://test-shop.vercel.app';
              return null;
            }),
          },
        },
      ],
    }).compile();

    healthService = module.get<HealthService>(HealthService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (module) {
      await module.close();
    }
  });

  it('should return UP and HEALTHY when frontend responds with 200 OK', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as any);

    const health = await healthService.getDeepHealth();
    expect(health.components.frontend.status).toBe('UP');
    expect(health.status).toBe('HEALTHY');
  });

  it('should return DOWN and DEGRADED when frontend responds with 404', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as any);

    const health = await healthService.getDeepHealth();
    expect(health.components.frontend.status).toBe('DOWN');
    expect(health.components.frontend.error).toContain('HTTP 404');
    expect(health.status).toBe('DEGRADED');
  });

  it('should return DOWN when frontend request times out', async () => {
    const abortErr = new Error('Timeout (>4s)');
    abortErr.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abortErr);

    const health = await healthService.getDeepHealth();
    expect(health.components.frontend.status).toBe('DOWN');
    expect(health.components.frontend.error).toContain('Timeout');
    expect(health.status).toBe('DEGRADED');
  });
});
