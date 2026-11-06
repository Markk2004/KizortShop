import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscordWebhookService } from '../../common/webhook/discord-webhook.service';

export interface InteractionUserContext {
  id: string;
  username: string;
  globalName?: string;
  roles?: string[];
  permissions?: string;
}

@Injectable()
export class AdminGuardService {
  private readonly logger = new Logger(AdminGuardService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly discordWebhook: DiscordWebhookService,
  ) {}

  /**
   * Extract user and member details safely from any Discord interaction payload
   */
  extractUser(interaction: any): InteractionUserContext {
    const member = interaction?.member;
    const user = member?.user || interaction?.user || {};
    return {
      id: user.id || '',
      username: user.username || user.tag || 'UnknownUser',
      globalName: user.global_name || user.username || 'Admin',
      roles: member?.roles || [],
      permissions: member?.permissions || '0',
    };
  }

  /**
   * Enforce dual-layer authorization:
   * 1. Discord User ID allowlist (DISCORD_ADMIN_USER_IDS in env, comma-separated)
   * 2. Discord Admin Role ID (DISCORD_ADMIN_ROLE_ID) or Administrator permission flag (0x8)
   */
  async verifyAdmin(interaction: any, actionName: string = 'ADMIN_ACTION'): Promise<{
    allowed: boolean;
    user: InteractionUserContext;
    reason?: string;
  }> {
    const user = this.extractUser(interaction);

    if (!user.id) {
      return { allowed: false, user, reason: 'Could not identify Discord user.' };
    }

    const adminUserIdsRaw =
      this.config.get<string>('DISCORD_ADMIN_USER_IDS') ||
      process.env.DISCORD_ADMIN_USER_IDS ||
      '';
    const adminUserIds = adminUserIdsRaw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const adminRoleId =
      this.config.get<string>('DISCORD_ADMIN_ROLE_ID') ||
      process.env.DISCORD_ADMIN_ROLE_ID ||
      '';

    let userMatchesAllowlist = true;
    if (adminUserIds.length > 0) {
      userMatchesAllowlist = adminUserIds.includes(user.id);
    }

    let roleOrPermissionMatches = true;
    if (adminRoleId) {
      const hasRole = user.roles?.includes(adminRoleId);
      const permissions = BigInt(user.permissions || '0');
      const hasAdminBit = (permissions & BigInt(0x8)) === BigInt(0x8);
      roleOrPermissionMatches = hasRole || hasAdminBit;
    }

    const allowed = userMatchesAllowlist && roleOrPermissionMatches;

    if (!allowed) {
      this.logger.warn(
        `[ACCESS_DENIED] Discord user ${user.username} (${user.id}) attempted ${actionName} without proper admin privileges.`,
      );

      // Notify Discord Security Audit channel
      try {
        await this.discordWebhook.notifySecurityAudit({
          action: 'UNAUTHORIZED_ADMIN_PANEL_ACCESS',
          actor: `${user.username} (${user.id})`,
          target: `${actionName} (Blocked unauthorized attempt)`,
        });
      } catch (err: any) {
        this.logger.error(`Failed to send security audit notification: ${err.message}`);
      }

      return {
        allowed: false,
        user,
        reason:
          'ปฏิเสธการเข้าถึง: บัญชี Discord ของคุณไม่อยู่ในรายชื่อผู้ดูแลระบบ (Admin Allowlist) หรือขาดสิทธิ์ Admin Role',
      };
    }

    return { allowed: true, user };
  }
}
