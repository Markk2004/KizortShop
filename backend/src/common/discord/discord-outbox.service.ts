import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordRestService } from './discord-rest.service';
import {
  DiscordBotType,
  DiscordChannelKey,
  DiscordMessagePayload,
} from './discord.constants';

@Injectable()
export class DiscordOutboxService {
  private readonly logger = new Logger(DiscordOutboxService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly restService: DiscordRestService,
  ) {}

  /**
   * Enqueue a Discord message into the outbox with optimistic immediate dispatch.
   * Row is created in PROCESSING status so background worker won't double-send.
   */
  async enqueue(
    channelKey: DiscordChannelKey,
    payload: DiscordMessagePayload,
    botType: DiscordBotType = 'notify',
  ): Promise<boolean> {
    try {
      // 1. Persist to outbox table in PROCESSING state
      const outbox = await this.prisma.discordOutbox.create({
        data: {
          channelKey,
          botType,
          payload: payload as any,
          status: 'PROCESSING',
          attempts: 0,
          maxAttempts: 5,
        },
      });

      // 2. Optimistic immediate dispatch
      const result = await this.restService.sendMessage(
        channelKey,
        payload,
        botType,
      );

      if (result.success) {
        await this.prisma.discordOutbox.update({
          where: { id: outbox.id },
          data: {
            status: 'SENT',
            attempts: 1,
            lastError: null,
          },
        });
        return true;
      }

      // If channel is unconfigured / inactive, mark SKIPPED so it does not retry
      if (result.skipped) {
        await this.prisma.discordOutbox.update({
          where: { id: outbox.id },
          data: {
            status: 'SKIPPED',
            attempts: 1,
            lastError: result.error || 'Channel unconfigured or inactive',
          },
        });
        return false;
      }

      // If immediate dispatch failed due to network / rate limit, queue for retry
      const backoffSeconds = result.rateLimited ? 10 : 15;
      const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);

      await this.prisma.discordOutbox.update({
        where: { id: outbox.id },
        data: {
          status: 'PENDING',
          attempts: 1,
          lastError: result.error || 'Initial delivery attempt failed',
          nextRetryAt,
        },
      });

      return false;
    } catch (err: any) {
      this.logger.error(
        `Failed to enqueue discord outbox message: ${err.message}`,
        err.stack,
      );
      return false;
    }
  }

  /**
   * Background worker running every 20 seconds to retry pending messages.
   * Atomically claims rows by transitioning PENDING -> PROCESSING before sending.
   */
  @Cron('*/20 * * * * *')
  async processOutboxQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Recovery: Unstick any row in PROCESSING for over 2 minutes (e.g. if server crashed)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      await this.prisma.discordOutbox.updateMany({
        where: {
          status: 'PROCESSING',
          updatedAt: { lte: twoMinutesAgo },
        },
        data: {
          status: 'PENDING',
        },
      });

      const now = new Date();
      const pendingItems = await this.prisma.discordOutbox.findMany({
        where: {
          status: 'PENDING',
          nextRetryAt: { lte: now },
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });

      if (pendingItems.length === 0) return;

      this.logger.log(
        `Processing ${pendingItems.length} pending Discord outbox items`,
      );

      for (const item of pendingItems) {
        // Atomic claim: only send if status was still PENDING
        const claimResult = await this.prisma.discordOutbox.updateMany({
          where: {
            id: item.id,
            status: 'PENDING',
          },
          data: {
            status: 'PROCESSING',
          },
        });

        if (claimResult.count === 0) {
          continue; // Already claimed by another worker or process
        }

        const payload = item.payload as unknown as DiscordMessagePayload;
        const channelKey = item.channelKey as DiscordChannelKey;
        const botType = item.botType as DiscordBotType;

        const result = await this.restService.sendMessage(
          channelKey,
          payload,
          botType,
        );

        if (result.success) {
          await this.prisma.discordOutbox.update({
            where: { id: item.id },
            data: {
              status: 'SENT',
              attempts: item.attempts + 1,
              lastError: null,
            },
          });
          this.logger.log(
            `Successfully delivered outbox message ${item.id} to [${channelKey}]`,
          );
        } else if (result.skipped) {
          await this.prisma.discordOutbox.update({
            where: { id: item.id },
            data: {
              status: 'SKIPPED',
              attempts: item.attempts + 1,
              lastError: result.error || 'Channel unconfigured or inactive',
            },
          });
        } else {
          const attempts = item.attempts + 1;
          const isFailed = attempts >= item.maxAttempts;

          // Exponential backoff: 30s * 2^(attempts-1), max 5 min
          const backoffSec = Math.min(300, 30 * Math.pow(2, attempts - 1));
          const nextRetryAt = new Date(Date.now() + backoffSec * 1000);

          await this.prisma.discordOutbox.update({
            where: { id: item.id },
            data: {
              status: isFailed ? 'FAILED' : 'PENDING',
              attempts,
              lastError: result.error || 'Delivery retry failed',
              nextRetryAt,
            },
          });

          if (isFailed) {
            this.logger.error(
              `Outbox item ${item.id} permanently failed after ${attempts} attempts: ${result.error}`,
            );
          }
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Error in outbox queue processor: ${err.message}`,
        err.stack,
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Daily housekeeping cron running at 03:00 AM:
   * Cleans up SENT/SKIPPED rows older than 7 days, and FAILED rows older than 30 days.
   */
  @Cron('0 3 * * *')
  async cleanOldOutboxRecords(): Promise<void> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [deletedSent, deletedFailed] = await Promise.all([
        this.prisma.discordOutbox.deleteMany({
          where: {
            status: { in: ['SENT', 'SKIPPED'] },
            createdAt: { lte: sevenDaysAgo },
          },
        }),
        this.prisma.discordOutbox.deleteMany({
          where: {
            status: 'FAILED',
            createdAt: { lte: thirtyDaysAgo },
          },
        }),
      ]);

      this.logger.log(
        `Outbox housekeeping: Purged ${deletedSent.count} completed records and ${deletedFailed.count} aged failed records`,
      );
    } catch (err: any) {
      this.logger.error(`Housekeeping outbox error: ${err.message}`);
    }
  }

  /**
   * Manually retry all FAILED messages
   */
  async retryAllFailed(): Promise<{ count: number }> {
    const updated = await this.prisma.discordOutbox.updateMany({
      where: { status: 'FAILED' },
      data: {
        status: 'PENDING',
        attempts: 0,
        nextRetryAt: new Date(),
        lastError: null,
      },
    });

    setTimeout(() => this.processOutboxQueue(), 500);

    return { count: updated.count };
  }

  /**
   * Get current outbox metrics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    skipped: number;
    total: number;
  }> {
    const [pending, processing, sent, failed, skipped] = await Promise.all([
      this.prisma.discordOutbox.count({ where: { status: 'PENDING' } }),
      this.prisma.discordOutbox.count({ where: { status: 'PROCESSING' } }),
      this.prisma.discordOutbox.count({ where: { status: 'SENT' } }),
      this.prisma.discordOutbox.count({ where: { status: 'FAILED' } }),
      this.prisma.discordOutbox.count({ where: { status: 'SKIPPED' } }),
    ]);

    return {
      pending,
      processing,
      sent,
      failed,
      skipped,
      total: pending + processing + sent + failed + skipped,
    };
  }
}
