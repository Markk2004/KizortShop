import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  DiscordBotType,
  DiscordChannelKey,
  DiscordMessagePayload,
} from './discord.constants';

@Injectable()
export class DiscordRestService {
  private readonly logger = new Logger(DiscordRestService.name);
  private readonly baseUrl = 'https://discord.com/api/v10';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Get configured bot token for given bot type
   */
  getBotToken(botType: DiscordBotType): string | undefined {
    if (botType === 'ops') {
      return (
        this.config.get<string>('DISCORD_OPS_BOT_TOKEN') ||
        this.config.get<string>('DISCORD_NOTIFY_BOT_TOKEN') ||
        this.config.get<string>('DISCORD_BOT_TOKEN') ||
        this.config.get<string>('DISCORD_TOKEN')
      );
    }
    return (
      this.config.get<string>('DISCORD_NOTIFY_BOT_TOKEN') ||
      this.config.get<string>('DISCORD_OPS_BOT_TOKEN') ||
      this.config.get<string>('DISCORD_BOT_TOKEN') ||
      this.config.get<string>('DISCORD_TOKEN')
    );
  }

  /**
   * Verify Discord bot connectivity by checking @me endpoint
   */
  async checkBotHealth(botType: DiscordBotType): Promise<{
    ok: boolean;
    botType: DiscordBotType;
    username?: string;
    id?: string;
    error?: string;
  }> {
    const token = this.getBotToken(botType);
    if (!token) {
      return {
        ok: false,
        botType,
        error: `Bot token for [${botType}] is not configured`,
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/users/@me`, {
        headers: {
          Authorization: `Bot ${token}`,
          'User-Agent': 'DiscordBot (https://kaizort-shop.com, 1.0.0)',
        },
      });

      if (!res.ok) {
        return {
          ok: false,
          botType,
          error: `Discord API returned ${res.status} ${res.statusText}`,
        };
      }

      const data = await res.json();
      return {
        ok: true,
        botType,
        username: data.username,
        id: data.id,
      };
    } catch (err: any) {
      return {
        ok: false,
        botType,
        error: err.message || 'Unknown network error',
      };
    }
  }

  /**
   * Send a message payload to a specific channelKey
   * Automatically selects between Discord Bot REST or Webhook Fallback
   */
  async sendMessage(
    channelKey: DiscordChannelKey,
    payload: DiscordMessagePayload,
    botType: DiscordBotType = 'notify',
  ): Promise<{ success: boolean; error?: string; rateLimited?: boolean; skipped?: boolean }> {
    try {
      const config = await this.prisma.webhookChannelConfig.findUnique({
        where: { channelKey },
      });

      if (!config || !config.isActive) {
        this.logger.debug(
          `Channel config for '${channelKey}' not found or inactive. Skipping delivery.`,
        );
        return { success: false, skipped: true, error: `Channel '${channelKey}' inactive or unconfigured` };
      }

      const botToken = this.getBotToken(botType);

      // Strategy 1: Bot REST API if bot token and channelId exist
      if (botToken && config.channelId) {
        const botRes = await this.sendViaBotToken(
          config.channelId,
          payload,
          botToken,
          channelKey,
        );
        if (botRes.success) {
          return botRes;
        }
        this.logger.warn(
          `Discord REST failed for [${channelKey}] (${botRes.error}), falling back to Webhook...`,
        );
      }

      // Strategy 2: Webhook URL fallback
      if (config.webhookUrl) {
        return await this.sendViaWebhook(config.webhookUrl, payload, channelKey);
      }

      return {
        success: false,
        skipped: true,
        error: `Neither valid channelId+token nor webhookUrl configured for '${channelKey}'`,
      };
    } catch (err: any) {
      this.logger.error(
        `Error dispatching message to channel [${channelKey}]: ${err.message}`,
        err.stack,
      );
      return { success: false, error: err.message };
    }
  }

  /**
   * Send message via Discord REST API (Bot Token)
   */
  private async sendViaBotToken(
    channelId: string,
    payload: DiscordMessagePayload,
    token: string,
    channelKey: string,
  ): Promise<{ success: boolean; error?: string; rateLimited?: boolean }> {
    const url = `${this.baseUrl}/channels/${channelId}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://kaizort-shop.com, 1.0.0)',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 429) {
      const retryHeader = res.headers.get('retry-after');
      const retryAfter = retryHeader ? parseFloat(retryHeader) : 1;
      this.logger.warn(
        `Discord REST 429 Rate Limit on [${channelKey}]. Retry after ${retryAfter}s`,
      );
      return {
        success: false,
        error: `Rate limited, retry after ${retryAfter}s`,
        rateLimited: true,
      };
    }

    if (!res.ok) {
      const errText = await res.text();
      this.logger.warn(
        `Discord REST failed [${channelKey}]: ${res.status} ${res.statusText} - ${errText}`,
      );
      return {
        success: false,
        error: `Discord REST ${res.status}: ${errText}`,
      };
    }

    return { success: true };
  }

  /**
   * Send message via Discord Webhook
   */
  private async sendViaWebhook(
    webhookUrl: string,
    payload: DiscordMessagePayload,
    channelKey: string,
  ): Promise<{ success: boolean; error?: string; rateLimited?: boolean }> {
    const formattedPayload = {
      username: 'KaiZort System',
      avatar_url:
        'https://qidraqabrlnuurnlkwko.supabase.co/storage/v1/object/public/assets/kaizort_logo.png',
      ...payload,
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://kaizort-shop.com, 1.0.0)',
      },
      body: JSON.stringify(formattedPayload),
    });

    if (res.status === 429) {
      const retryHeader = res.headers.get('retry-after');
      const retryAfter = retryHeader ? parseFloat(retryHeader) : 1;
      this.logger.warn(
        `Discord Webhook 429 Rate Limit on [${channelKey}]. Retry after ${retryAfter}s`,
      );
      return {
        success: false,
        error: `Rate limited, retry after ${retryAfter}s`,
        rateLimited: true,
      };
    }

    if (!res.ok) {
      const errText = await res.text();
      this.logger.warn(
        `Discord Webhook failed [${channelKey}]: ${res.status} ${res.statusText} - ${errText}`,
      );
      return {
        success: false,
        error: `Discord Webhook ${res.status}: ${errText}`,
      };
    }

    return { success: true };
  }
}
