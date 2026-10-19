import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      this.logger.warn("DATABASE_URL is not configured; Prisma client will connect lazily when set.");
      return;
    }
    try {
      await this.$connect();
      this.logger.log("Connected to Supabase PostgreSQL database via Prisma.");
    } catch (error) {
      this.logger.warn(`Database connection deferred: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
