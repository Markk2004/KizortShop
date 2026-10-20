import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { DiscordWebhookService } from "../../../common/webhook/discord-webhook.service";
import {
  CreateAdminCategoryDto,
  UpdateAdminCategoryDto,
} from "../dto/admin-product.dto";

@Controller("admin/categories")
export class AdminCategoriesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discordWebhook: DiscordWebhookService,
  ) {}

  @Get()
  async listCategories() {
    const categories = await this.prisma.category.findMany({
      include: {
        products: {
          select: {
            id: true,
            code: true,
            price: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    const data = categories.map((cat) => {
      const visibleProducts = cat.products.filter((p) => p.code !== "KAITUN-VAULT-POOL");
      const activeProducts = visibleProducts.filter((p) => p.isActive);
      const prices = activeProducts.map((p) => Number(p.price));
      const priceMin = prices.length > 0 ? Math.min(...prices) : 0;
      const priceMax = prices.length > 0 ? Math.max(...prices) : 0;

      return {
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        description: cat.description || "",
        image: cat.image,
        badge: cat.badge,
        sortOrder: cat.sortOrder,
        itemCount: visibleProducts.length,
        priceMin,
        priceMax,
        accent: "amber",
        status: cat.isActive ? "AVAILABLE" : "OUT_OF_STOCK",
        isActive: cat.isActive,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      };
    });

    return {
      message: "Categories fetched successfully",
      data,
    };
  }

  @Post()
  async createCategory(@Body() dto: CreateAdminCategoryDto) {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException("ชื่อหมวดหมู่เป็นข้อมูลบังคับ");
    }

    const cleanName = dto.name.trim();
    const rawSlug = dto.slug?.trim() || cleanName.toLowerCase().replace(/[^a-z0-9ก-๙]+/g, "-");
    const slug = rawSlug || `cat-${Date.now()}`;

    // Check slug uniqueness
    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });
    const finalSlug = existing ? `${slug}-${Date.now().toString().slice(-4)}` : slug;

    const category = await this.prisma.category.create({
      data: {
        name: cleanName,
        slug: finalSlug,
        description: dto.description?.trim() || null,
        image: dto.image?.trim() || "/assets/blox_fruits_category.jpg",
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    await this.discordWebhook.notifyCatalogAction({
      type: "CATEGORY",
      action: "CREATED",
      name: category.name,
      code: category.slug,
      status: category.isActive ? "AVAILABLE" : "OUT_OF_STOCK",
    });

    return {
      message: `สร้างหมวดหมู่ ${category.name} สำเร็จ`,
      data: {
        id: category.id,
        slug: category.slug,
        name: category.name,
        description: category.description || "",
        image: category.image,
        itemCount: 0,
        priceMin: 0,
        priceMax: 0,
        accent: "amber",
        status: category.isActive ? "AVAILABLE" : "OUT_OF_STOCK",
        isActive: category.isActive,
      },
    };
  }

  @Patch(":id")
  async updateCategory(
    @Param("id") id: string,
    @Body() dto: UpdateAdminCategoryDto,
  ) {
    // Find category by id or slug
    const cat = await this.prisma.category.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
    });

    if (!cat) {
      throw new NotFoundException("ไม่พบหมวดหมู่ที่ต้องการแก้ไข");
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.slug !== undefined && dto.slug.trim()) updateData.slug = dto.slug.trim();
    if (dto.description !== undefined) updateData.description = dto.description.trim();
    if (dto.image !== undefined && dto.image.trim()) updateData.image = dto.image.trim();
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updated = await this.prisma.category.update({
      where: { id: cat.id },
      data: updateData,
    });

    await this.discordWebhook.notifyCatalogAction({
      type: "CATEGORY",
      action: dto.isActive !== undefined && dto.name === undefined ? "STATUS_CHANGED" : "UPDATED",
      name: updated.name,
      code: updated.slug,
      status: updated.isActive ? "AVAILABLE" : "OUT_OF_STOCK",
    });

    return {
      message: `แก้ไขหมวดหมู่ ${updated.name} สำเร็จ`,
      data: {
        id: updated.id,
        slug: updated.slug,
        name: updated.name,
        description: updated.description || "",
        image: updated.image,
        status: updated.isActive ? "AVAILABLE" : "OUT_OF_STOCK",
        isActive: updated.isActive,
      },
    };
  }

  @Delete(":id")
  async deleteCategory(@Param("id") id: string) {
    const cat = await this.prisma.category.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!cat) {
      throw new NotFoundException("ไม่พบหมวดหมู่ที่ต้องการลบ");
    }

    // If there are products in this category, delete or reassign them
    if (cat._count.products > 0) {
      let otherCat = await this.prisma.category.findFirst({
        where: { slug: "other" },
      });
      if (!otherCat) {
        otherCat = await this.prisma.category.create({
          data: {
            slug: "other",
            name: "อื่น ๆ",
            description: "หมวดหมู่อื่น ๆ",
            image: "/assets/blox_fruits_category.jpg",
            isActive: true,
          },
        });
      }

      await this.prisma.product.updateMany({
        where: { categoryId: cat.id },
        data: { categoryId: otherCat.id },
      });
    }

    await this.prisma.category.delete({
      where: { id: cat.id },
    });

    await this.discordWebhook.notifyCatalogAction({
      type: "CATEGORY",
      action: "DELETED",
      name: cat.name,
      code: cat.slug,
    });

    return {
      message: `ลบหมวดหมู่ ${cat.name} เรียบร้อยแล้ว`,
      data: { id: cat.id },
    };
  }
}
