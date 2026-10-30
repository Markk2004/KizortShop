import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { PrismaService } from "../../../common/prisma/prisma.service";

interface AdjustBalanceDto {
  amount: number;
  reason?: string;
}

interface CreateUserDto {
  username: string;
  email: string;
  role?: "MEMBER" | "ADMIN";
  balance?: number;
  tier?: string;
}

@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        wallet: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = users.map((u) => {
      const balance = u.wallet ? Number(u.wallet.balance) : 0;
      const totalSpent = u.wallet ? Number(u.wallet.totalSpent) : 0;
      let tier = "Standard";
      if (totalSpent >= 3000) tier = "Diamond";
      else if (totalSpent >= 1000) tier = "VIP";

      return {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        tier,
        balance,
        status: u.isActive ? ("ACTIVE" as const) : ("BANNED" as const),
        registeredAt: u.createdAt.toISOString().slice(0, 10),
        totalOrders: u._count.orders,
      };
    });

    return {
      message: "Users retrieved successfully",
      data,
    };
  }

  @Patch(":id/role")
  async updateRole(
    @Param("id") id: string,
    @Body("role") role: "MEMBER" | "ADMIN",
  ) {
    if (!["MEMBER", "ADMIN"].includes(role)) {
      throw new BadRequestException("Invalid role");
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      include: { wallet: true },
    });
    return {
      message: `Updated role to ${role}`,
      data: updated,
    };
  }

  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body("status") status: "ACTIVE" | "BANNED",
  ) {
    if (!["ACTIVE", "BANNED"].includes(status)) {
      throw new BadRequestException("Invalid status");
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: status === "ACTIVE" },
      include: { wallet: true },
    });
    return {
      message: `Updated status to ${status}`,
      data: updated,
    };
  }

  @Patch(":id/balance")
  async adjustBalance(
    @Param("id") id: string,
    @Body() dto: AdjustBalanceDto,
  ) {
    const delta = Number(dto.amount);
    if (isNaN(delta) || delta === 0) {
      throw new BadRequestException("Valid delta amount required");
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const currentBalance = user.wallet ? Number(user.wallet.balance) : 0;
    const nextBalance = Math.max(0, currentBalance + delta);

    const updatedWallet = await this.prisma.wallet.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        balance: nextBalance,
        totalTopup: delta > 0 ? delta : 0,
        totalSpent: 0,
      },
      update: {
        balance: nextBalance,
        totalTopup: delta > 0 ? { increment: delta } : undefined,
      },
    });

    return {
      message: `Balance adjusted by ${delta > 0 ? `+${delta}` : delta} THB`,
      data: {
        userId: user.id,
        balance: Number(updatedWallet.balance),
      },
    };
  }

  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    if (!dto.username || !dto.email) {
      throw new BadRequestException("Username and email are required");
    }

    const user = await this.prisma.user.create({
      data: {
        username: dto.username.trim(),
        email: dto.email.trim().toLowerCase(),
        passwordHash: "$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm",
        role: dto.role || "MEMBER",
        isActive: true,
        wallet: {
          create: {
            balance: dto.balance || 0,
            totalTopup: dto.balance || 0,
            totalSpent: 0,
          },
        },
      },
      include: { wallet: true },
    });

    return {
      message: `Created user ${user.username}`,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        tier: dto.tier || "Standard",
        balance: Number(user.wallet?.balance || 0),
        status: "ACTIVE",
        registeredAt: user.createdAt.toISOString().slice(0, 10),
        totalOrders: 0,
      },
    };
  }
}
