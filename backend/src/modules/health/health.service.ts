import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DiscordRestService } from '../../common/discord/discord-rest.service';
import { DiscordOutboxService } from '../../common/discord/discord-outbox.service';
import { DiscordWebhookService } from '../../common/webhook/discord-webhook.service';

export interface HealthCheckResult {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  timestamp: string;
  uptimeSeconds: number;
  components: {
    database: { status: 'UP' | 'DOWN'; latencyMs?: number; error?: string };
    discordBots: {
      notifyBot: { status: 'UP' | 'DOWN' | 'UNCONFIGURED'; details?: string };
      opsBot: { status: 'UP' | 'DOWN' | 'UNCONFIGURED'; details?: string };
    };
    outbox: {
      status: 'HEALTHY' | 'BACKLOG_WARNING' | 'FAILED_ITEMS';
      pending: number;
      failed: number;
      sent: number;
    };
    frontend: {
      status: 'UP' | 'DOWN' | 'UNCONFIGURED';
      url?: string;
      latencyMs?: number;
      error?: string;
    };
  };
  system: {
    nodeVersion: string;
    memoryUsageMB: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private previousSystemStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';

  constructor(
    private readonly prisma: PrismaService,
    private readonly discordRest: DiscordRestService,
    private readonly discordOutbox: DiscordOutboxService,
    private readonly webhookService: DiscordWebhookService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Lightweight liveness check for UptimeRobot and Render health checks
   */
  getLiveness(): { status: string; timestamp: string; uptime: number } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }

  /**
   * Deep diagnostics of all dependent services: Supabase, Discord, Outbox, Frontend
   */
  async getDeepHealth(): Promise<HealthCheckResult> {
    const mem = process.memoryUsage();
    const result: HealthCheckResult = {
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      components: {
        database: { status: 'DOWN' },
        discordBots: {
          notifyBot: { status: 'UNCONFIGURED' },
          opsBot: { status: 'UNCONFIGURED' },
        },
        outbox: {
          status: 'HEALTHY',
          pending: 0,
          failed: 0,
          sent: 0,
        },
        frontend: { status: 'UNCONFIGURED' },
      },
      system: {
        nodeVersion: process.version,
        memoryUsageMB: {
          rss: Math.round(mem.rss / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        },
      },
    };

    let issuesCount = 0;
    let criticalIssuesCount = 0;

    const frontendUrl =
      this.config.get<string>('FRONTEND_HEALTH_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'https://kizort-shop.vercel.app';

    // Execute all 4 checks concurrently in parallel for maximum speed (< 1.5s total)
    const [dbRes, botsRes, outboxRes, feRes] = await Promise.all([
      // 1. Supabase / Postgres Database Check
      (async () => {
        const dbStart = Date.now();
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return {
            status: 'UP' as const,
            latencyMs: Date.now() - dbStart,
          };
        } catch (err: any) {
          return {
            status: 'DOWN' as const,
            latencyMs: Date.now() - dbStart,
            error: err.message,
          };
        }
      })(),

      // 2. Discord Bots Check
      (async () => {
        const [notifyHealth, opsHealth] = await Promise.all([
          this.discordRest.checkBotHealth('notify'),
          this.discordRest.checkBotHealth('ops'),
        ]);
        return { notifyHealth, opsHealth };
      })(),

      // 3. Outbox Backlog Check
      (async () => {
        try {
          const stats = await this.discordOutbox.getStats();
          return { ok: true, stats };
        } catch (err: any) {
          return { ok: false, error: err.message };
        }
      })(),

      // 4. Frontend Ping Check (2000ms tight timeout to guarantee Discord 3s compliance)
      (async () => {
        if (!frontendUrl) {
          return { status: 'UNCONFIGURED' as const };
        }
        const feStart = Date.now();
        let timeoutId: NodeJS.Timeout | undefined;
        try {
          const controller = new AbortController();
          timeoutId = setTimeout(() => controller.abort(), 2000);
          const response = await fetch(frontendUrl, {
            method: 'GET',
            signal: controller.signal,
          });

          const isUp = response.status >= 200 && response.status < 400;
          return {
            status: isUp ? ('UP' as const) : ('DOWN' as const),
            url: frontendUrl,
            latencyMs: Date.now() - feStart,
            error: isUp ? undefined : `HTTP ${response.status} ${response.statusText}`,
          };
        } catch (err: any) {
          return {
            status: 'DOWN' as const,
            url: frontendUrl,
            latencyMs: Date.now() - feStart,
            error: err.name === 'AbortError' ? 'Timeout (>2s)' : err.message,
          };
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      })(),
    ]);

    // Apply DB component results
    result.components.database = dbRes;
    if (dbRes.status === 'DOWN') {
      criticalIssuesCount++;
    }

    // Apply Discord Bots component results
    const { notifyHealth, opsHealth } = botsRes;
    result.components.discordBots.notifyBot = {
      status: notifyHealth.ok
        ? 'UP'
        : notifyHealth.error?.includes('not configured')
        ? 'UNCONFIGURED'
        : 'DOWN',
      details: notifyHealth.ok
        ? `Logged in as ${notifyHealth.username}`
        : notifyHealth.error,
    };
    if (result.components.discordBots.notifyBot.status === 'DOWN') {
      issuesCount++;
    }

    result.components.discordBots.opsBot = {
      status: opsHealth.ok
        ? 'UP'
        : opsHealth.error?.includes('not configured')
        ? 'UNCONFIGURED'
        : 'DOWN',
      details: opsHealth.ok
        ? `Logged in as ${opsHealth.username}`
        : opsHealth.error,
    };
    if (result.components.discordBots.opsBot.status === 'DOWN') {
      issuesCount++;
    }

    // Apply Outbox component results
    if (outboxRes.ok && outboxRes.stats) {
      const stats = outboxRes.stats;
      let outboxStatus: 'HEALTHY' | 'BACKLOG_WARNING' | 'FAILED_ITEMS' = 'HEALTHY';
      if (stats.failed > 0) {
        outboxStatus = 'FAILED_ITEMS';
        issuesCount++;
      } else if (stats.pending > 20) {
        outboxStatus = 'BACKLOG_WARNING';
        issuesCount++;
      }

      result.components.outbox = {
        status: outboxStatus,
        pending: stats.pending,
        failed: stats.failed,
        sent: stats.sent,
      };
    } else {
      issuesCount++;
      this.logger.error(`Error reading outbox metrics: ${outboxRes.error}`);
    }

    // Apply Frontend component results
    result.components.frontend = feRes;
    if (feRes.status === 'DOWN') {
      issuesCount++;
    }

    // Determine overall status
    if (criticalIssuesCount > 0) {
      result.status = 'UNHEALTHY';
    } else if (issuesCount > 0) {
      result.status = 'DEGRADED';
    } else {
      result.status = 'HEALTHY';
    }

    return result;
  }

  /**
   * Health Watchdog running every 5 minutes: notifies admins if system breaks or recovers
   */
  @Cron('*/5 * * * *')
  async runHealthWatchdog(): Promise<void> {
    try {
      const health = await this.getDeepHealth();
      const currentStatus = health.status;

      // Status flipped to UNHEALTHY or DEGRADED
      if (
        currentStatus !== 'HEALTHY' &&
        this.previousSystemStatus === 'HEALTHY'
      ) {
        this.logger.warn(`Health Watchdog detected state transition: ${currentStatus}`);
        await this.webhookService.notifySystemAlert({
          title: `ระบบขัดข้อง (${currentStatus})`,
          message: `ตรวจสอบพบปัญหาในการทำงานของระบบ กรุณาตรวจสอบสถานะด่วน`,
          severity: currentStatus === 'UNHEALTHY' ? 'CRITICAL' : 'WARN',
          alertKey: 'system_watchdog_incident',
          metadata: {
            database: health.components.database.status,
            databaseLatency: `${health.components.database.latencyMs ?? '-'}ms`,
            notifyBot: health.components.discordBots.notifyBot.status,
            opsBot: health.components.discordBots.opsBot.status,
            outboxPending: health.components.outbox.pending,
            outboxFailed: health.components.outbox.failed,
            frontend: health.components.frontend.status,
          },
        });
      }
      // Status recovered back to HEALTHY
      else if (
        currentStatus === 'HEALTHY' &&
        this.previousSystemStatus !== 'HEALTHY'
      ) {
        this.logger.log(`Health Watchdog detected system recovery to HEALTHY`);
        await this.webhookService.notifySystemAlert({
          title: 'ระบบกลับมาทำงานตามปกติแล้ว (System Recovered)',
          message: 'ทุกบริการเชื่อมต่อ (Supabase, Discord, Web frontend) ทำงานได้ปกติเรียบร้อยแล้ว',
          severity: 'RESOLVED',
          alertKey: 'system_watchdog_incident',
          metadata: {
            databaseLatency: `${health.components.database.latencyMs ?? '-'}ms`,
            frontendLatency: `${health.components.frontend.latencyMs ?? '-'}ms`,
            outboxPending: health.components.outbox.pending,
          },
        });
      }

      this.previousSystemStatus = currentStatus;
    } catch (err: any) {
      this.logger.error(`Health Watchdog failed to execute: ${err.message}`, err.stack);
    }
  }
}
