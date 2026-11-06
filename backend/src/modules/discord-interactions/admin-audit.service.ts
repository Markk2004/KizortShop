import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DiscordWebhookService } from '../../common/webhook/discord-webhook.service';

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discordWebhook: DiscordWebhookService,
  ) {}

  /**
   * Record administrative actions in the AuditLog database table and optionally dispatch webhook alerts.
   */
  async log(params: {
    action: string;
    targetType: string;
    targetId?: string;
    actorDiscordId: string;
    actorUsername: string;
    metadata?: Record<string, any>;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    notifySecurity?: boolean;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: params.action,
          targetType: params.targetType,
          targetId: params.targetId || null,
          metadata: {
            actorDiscordId: params.actorDiscordId,
            actorUsername: params.actorUsername,
            ...(params.metadata || {}),
          },
        },
      });

      if (params.notifySecurity) {
        await this.discordWebhook.notifySecurityAudit({
          action: params.action,
          actor: `${params.actorUsername} (${params.actorDiscordId})`,
          target: `${params.targetType} [${params.targetId || '-'}] ${JSON.stringify(params.metadata || {})}`,
        });
      }
    } catch (err: any) {
      this.logger.error(`Failed to record audit log: ${err.message}`, err.stack);
    }
  }
}
