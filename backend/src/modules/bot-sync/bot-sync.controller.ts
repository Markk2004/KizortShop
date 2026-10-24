import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DiscordWebhookService } from '../../common/webhook/discord-webhook.service';
import {
  encryptCredentialAes256Gcm,
  inspectAndHashCredential,
} from '../../common/crypto/stock-crypto.util';
import * as crypto from 'crypto';

export class BotUpsertKaitunDto {
  username!: string;
  password!: string;
  cookie?: string;
  discordUserId?: string;
  farmedMaps?: string;
  details?: string;
  price?: string;
}

export class BotSetSoldKaitunDto {
  username!: string;
  actor?: string;
}

export class BotRemoveKaitunDto {
  username!: string;
  actor?: string;
}

@Controller('bot/kaitun')
export class BotSyncController {
  private readonly logger = new Logger(BotSyncController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly discordWebhook: DiscordWebhookService,
  ) {}

  private verifyBotApiKey(apiKey?: string) {
    const configuredKey = this.config.get<string>('BOT_API_KEY');
    if (!configuredKey) {
      this.logger.error('BOT_API_KEY is not configured on server');
      throw new UnauthorizedException('BOT_API_KEY not configured');
    }

    if (!apiKey) {
      throw new UnauthorizedException('Missing x-bot-api-key header');
    }

    const bufA = Buffer.from(apiKey);
    const bufB = Buffer.from(configuredKey);

    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      throw new UnauthorizedException('Invalid bot API key');
    }
  }

  @Post('upsert')
  async upsertAccount(
    @Headers('x-bot-api-key') apiKey: string,
    @Body() dto: BotUpsertKaitunDto,
  ) {
    this.verifyBotApiKey(apiKey);

    if (!dto.username || !dto.password) {
      throw new BadRequestException('username and password are required');
    }

    const secret =
      this.config.get<string>('STOCK_ENCRYPTION_SECRET') ||
      'kz_store_aes256_gcm_stock_vault_secret_2026';
    const rawLine = dto.cookie
      ? `${dto.username}:${dto.password}:${dto.cookie}`
      : `${dto.username}:${dto.password}`;

    const inspection = inspectAndHashCredential(rawLine, dto.cookie ? 'USER_PASS_2FA' : 'USER_PASS', secret);
    const credHash = inspection.credentialHash;
    const encryptedCreds = encryptCredentialAes256Gcm(rawLine, secret);
    const masked = inspection.maskedIdentity;

    // Look up default product or vault product
    let product = await this.prisma.product.findFirst({
      where: { code: 'KAITUN-VAULT-POOL' },
    });

    if (!product) {
      product = await this.prisma.product.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!product) {
      // Find or create category for auto-created product
      let cat = await this.prisma.category.findFirst();
      if (!cat) {
        cat = await this.prisma.category.create({
          data: {
            name: 'ไก่ตันอัตโนมัติ',
            slug: 'kaitun-auto',
            image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e',
          },
        });
      }
      product = await this.prisma.product.create({
        data: {
          code: 'KAITUN-VAULT-POOL',
          title: 'คลังเก็บไอดีไก่ตัน (Bot Vault)',
          price: 0,
          image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e',
          categoryId: cat.id,
        },
      });
    }

    const existing = await this.prisma.accountStock.findFirst({
      where: { credentialHash: credHash },
    });

    if (existing) {
      // Update existing
      const updated = await this.prisma.accountStock.update({
        where: { id: existing.id },
        data: {
          credentials: encryptedCreds,
          username: dto.username,
          maskedIdentity: masked,
          farmedMaps: dto.farmedMaps || existing.farmedMaps,
          details: dto.details || existing.details,
          sellingPriceText: dto.price || existing.sellingPriceText,
        },
      });

      await this.discordWebhook.notifyKaitunSync('PASSWORD_UPDATED', {
        username: dto.username,
        actor: 'Discord Python Bot',
        details: dto.details,
        farmedMaps: dto.farmedMaps,
        price: dto.price,
      });

      return {
        status: 'updated',
        id: updated.id,
        serialCode: updated.serialCode,
      };
    }

    // Create new
    const serialCode = `STK-BOT-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      1000 + Math.random() * 9000,
    )}`;

    const created = await this.prisma.accountStock.create({
      data: {
        serialCode,
        productId: product.id,
        credentials: encryptedCreds,
        credentialHash: credHash,
        username: dto.username,
        maskedIdentity: masked,
        addedByDiscordId: dto.discordUserId,
        farmedMaps: dto.farmedMaps,
        details: dto.details,
        sellingPriceText: dto.price,
        addedSource: 'DISCORD_BOT',
        status: 'AVAILABLE',
      },
    });

    await this.discordWebhook.notifyKaitunSync('AVAILABLE', {
      username: dto.username,
      actor: 'Discord Python Bot',
      details: dto.details,
      farmedMaps: dto.farmedMaps,
      price: dto.price,
    });

    return {
      status: 'created',
      id: created.id,
      serialCode: created.serialCode,
    };
  }

  @Post('sold')
  async markSold(
    @Headers('x-bot-api-key') apiKey: string,
    @Body() dto: BotSetSoldKaitunDto,
  ) {
    this.verifyBotApiKey(apiKey);

    const secret =
      this.config.get<string>('STOCK_ENCRYPTION_SECRET') ||
      'kz_store_aes256_gcm_stock_vault_secret_2026';
    const inspection = inspectAndHashCredential(dto.username, 'USER_PASS', secret);
    const credHash = inspection.credentialHash;

    const stock = await this.prisma.accountStock.findFirst({
      where: {
        OR: [
          { credentialHash: credHash },
          { username: dto.username },
        ],
      },
    });

    if (!stock) {
      throw new BadRequestException(`Account ${dto.username} not found`);
    }

    const updated = await this.prisma.accountStock.update({
      where: { id: stock.id },
      data: {
        status: 'SOLD',
        soldAt: new Date(),
      },
    });

    await this.discordWebhook.notifyKaitunSync('SOLD', {
      username: dto.username,
      actor: dto.actor || 'Discord Python Bot',
    });

    return {
      status: 'success',
      id: updated.id,
      soldAt: updated.soldAt,
    };
  }

  @Post('remove')
  async removeAccount(
    @Headers('x-bot-api-key') apiKey: string,
    @Body() dto: BotRemoveKaitunDto,
  ) {
    this.verifyBotApiKey(apiKey);

    if (!dto.username) {
      throw new BadRequestException('username is required');
    }

    const secret =
      this.config.get<string>('STOCK_ENCRYPTION_SECRET') ||
      'kz_store_aes256_gcm_stock_vault_secret_2026';
    const inspection = inspectAndHashCredential(dto.username, 'USER_PASS', secret);
    const credHash = inspection.credentialHash;

    const stock = await this.prisma.accountStock.findFirst({
      where: {
        OR: [
          { credentialHash: credHash },
          { username: dto.username },
        ],
      },
      include: { product: true },
    });

    if (!stock) {
      throw new BadRequestException(`Account ${dto.username} not found`);
    }

    await this.prisma.accountStock.delete({
      where: { id: stock.id },
    });

    // Write AuditLog
    await this.prisma.auditLog.create({
      data: {
        action: 'BOT_STOCK_REMOVE',
        targetType: 'STOCK',
        targetId: stock.id,
        metadata: {
          serialCode: stock.serialCode,
          username: stock.username || stock.maskedIdentity,
          actor: dto.actor || 'Discord Python Bot',
        },
      },
    }).catch(() => {});

    await this.discordWebhook.notifyStockRemoved({
      serialCode: stock.serialCode,
      username: stock.username || stock.maskedIdentity,
      productTitle: stock.product?.title,
    });

    return {
      status: 'success',
      deletedSerial: stock.serialCode,
      deletedUsername: dto.username,
    };
  }
}
