import { PrismaClient, Role, BannerSlot, StockMode, CredentialFormat, StockStatus } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function hashCredential(rawIdentity: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(rawIdentity.trim().toLowerCase())
    .digest('hex');
}

async function main() {
  console.log('Starting Supabase database seed for KaiZort Store...');

  const encryptionSecret = process.env.STOCK_ENCRYPTION_SECRET || 'kz_store_aes256_gcm_stock_vault_secret_2026';

  // 1. Upsert Admin & Demo Member Users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@kaizort.store' },
    update: {},
    create: {
      username: 'kaizort_admin',
      email: 'admin@kaizort.store',
      passwordHash: '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm',
      role: Role.ADMIN,
      isActive: true,
      wallet: {
        create: {
          balance: 99999.00,
          totalTopup: 99999.00,
          totalSpent: 0.00,
        },
      },
    },
  });

  const demoMember = await prisma.user.upsert({
    where: { email: 'member@kaizort.store' },
    update: {},
    create: {
      username: 'kz_player01',
      email: 'member@kaizort.store',
      passwordHash: '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm',
      role: Role.MEMBER,
      isActive: true,
      wallet: {
        create: {
          balance: 1500.00,
          totalTopup: 2000.00,
          totalSpent: 500.00,
        },
      },
    },
  });

  console.log(`Seeded users: ${adminUser.username}, ${demoMember.username}`);

  // 2. Upsert Storefront Banners
  const banners = [
    {
      title: 'BLOX FRUITS GODHUMAN V4 AWAKENING',
      subtitle: 'ไอดีไก่ตันพร้อมเล่น การันตีหมัด Godhuman เผ่า V4 เต็มขั้น ส่งอัตโนมัติทันที',
      tag: 'FEATURED DROP',
      image: '/assets/hero_banner_bloxfruits.png',
      linkUrl: '/categories/blox-fruits',
      slot: BannerSlot.HERO_MAIN,
      sortOrder: 1,
    },
    {
      title: 'ROBLOX PREMIUM & KAITUN VAULT',
      subtitle: 'คลังไอดีไก่ตันคุณภาพสูง คัดเกรดทุกไอดี ปลอดภัย 100% ไม่ติดเมลแดง',
      tag: 'VERIFIED STOCK',
      image: '/assets/hero_banner_roblox.png',
      linkUrl: '/categories',
      slot: BannerSlot.HERO_MAIN,
      sortOrder: 2,
    },
    {
      title: 'ZERO-TRUST ENCRYPTED DELIVERY',
      subtitle: 'ระบบจัดส่งรหัสผ่านอัตโนมัติเข้ารหัส AES-256-GCM ตรวจสอบสถานะได้ตลอด 24 ชม.',
      tag: 'SECURITY',
      image: '/assets/hero_banner_security.png',
      linkUrl: '/check-order',
      slot: BannerSlot.PROMO_SIDE,
      sortOrder: 1,
    },
  ];

  await prisma.banner.deleteMany({});
  await prisma.banner.createMany({ data: banners });
  console.log(`Seeded ${banners.length} banners`);

  // 3. Upsert Categories
  const categoriesData = [
    {
      name: 'Blox Fruits ไก่ตัน',
      slug: 'blox-fruits',
      description: 'ไอดีไก่ตัน Blox Fruits หมัด Godhuman ดาบคู่ Cursed Dual Katana เผ่า V4 พร้อมเล่น',
      image: '/assets/blox_fruits_category.jpg',
      badge: 'HOT',
      sortOrder: 1,
    },
    {
      name: 'Anime Defenders',
      slug: 'anime-defenders',
      description: 'ไอดีไก่ตันและยูนิตระดับ Secret / Mythical คัดเกรดพร้อมลงด่าน',
      image: '/assets/anime_defenders_category.jpg',
      badge: 'POPULAR',
      sortOrder: 2,
    },
    {
      name: 'Anime Dice & RNG',
      slug: 'anime-dice',
      description: 'ไอดีสายสุ่มออร่าหายาก เพชรและแต้มสะสมจำนวนมาก',
      image: '/assets/anime_dice_category.jpg',
      badge: 'NEW',
      sortOrder: 3,
    },
    {
      name: 'Robux & Gamepass',
      slug: 'robux-topup',
      description: 'บริการเติม Robux และส่ง Gamepass เรทคุ้มค่า ปลอดภัยรวดเร็ว',
      image: '/assets/robux_topup_category.jpg',
      badge: 'INSTANT',
      sortOrder: 4,
    },
    {
      name: 'คลังไก่ตันรอจัดหมวด (Discord Vault)',
      slug: 'kaitun-vault',
      description: 'คลังพักสต๊อกกลางสำหรับไอดีที่ส่งผ่านห้อง #kaitun-id ก่อนจัดแพ็กเกจขึ้นหน้าร้าน',
      image: '/assets/blox_fruits_category.jpg',
      badge: 'VAULT',
      sortOrder: 99,
      isActive: false,
    },
  ];

  const categoryMap: Record<string, string> = {};
  for (const cat of categoriesData) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        image: cat.image,
        badge: cat.badge,
        sortOrder: cat.sortOrder,
        isActive: cat.isActive !== undefined ? cat.isActive : true,
      },
      create: cat,
    });
    categoryMap[cat.slug] = created.id;
  }
  console.log(`Seeded ${Object.keys(categoryMap).length} categories`);

  // 4. Upsert Products
  const productsData = [
    {
      code: 'KAITUN-VAULT-POOL',
      title: '[คลังพักสต๊อก] ไอดีไก่ตันรอจัดหมวดหมู่',
      description: 'แพ็กเกจกลางสำหรับรับข้อมูลไอดีอัตโนมัติจากห้อง #kaitun-id ใน Discord (ไม่แสดงหน้าร้านจนกว่าจะเลือกผูกสินค้า)',
      price: 0.00,
      originalPrice: null,
      badge: 'VAULT',
      image: '/assets/blox_fruits_category.jpg',
      stockMode: StockMode.POOL,
      credentialFormat: CredentialFormat.USER_PASS,
      isFeatured: false,
      isActive: false,
      sortOrder: 999,
      categoryId: categoryMap['kaitun-vault'],
    },
    {
      code: 'BF-GH-CDK-01',
      title: 'ไก่ตัน Godhuman + ดาบคู่ CDK + กีตาร์บรู๊ค (การันตี Lv.2550)',
      description: 'เลเวลตัน 2550 หมัด Godhuman ดาบคู่ Cursed Dual Katana ปืน Soul Guitar สุ่มผลไม้ Mythical ในคลัง ไม่ติดเมลพร้อมเปลี่ยนรหัสทันที',
      price: 189.00,
      originalPrice: 290.00,
      badge: 'BEST SELLER',
      image: '/assets/blox_fruits_category.jpg',
      stockMode: StockMode.POOL,
      credentialFormat: CredentialFormat.USER_PASS,
      isFeatured: true,
      sortOrder: 1,
      categoryId: categoryMap['blox-fruits'],
    },
    {
      code: 'BF-V4-FULL-02',
      title: 'ไก่ตันเผ่า V4 Full Gear + หมัดสังเกต V2 + ดาบคู่ CDK',
      description: 'เผ่าตื่น V4 ครบทุกเกียร์ เลเวลตัน 2550 ของครบพร้อมลง PVP ทันที ปลอดภัยไร้เมลแดง',
      price: 450.00,
      originalPrice: 650.00,
      badge: 'LIMITED V4',
      image: '/assets/blox_fruits_category.jpg',
      stockMode: StockMode.POOL,
      credentialFormat: CredentialFormat.USER_PASS,
      isFeatured: true,
      sortOrder: 2,
      categoryId: categoryMap['blox-fruits'],
    },
    {
      code: 'BF-KITSUNE-UNQ-01',
      title: 'ไอดีคัดพิเศษ ผล Kitsune ถาวร + เผ่า Cyborg V4 Full',
      description: 'ไอดีคัดเฉพาะ 1:1 มีผล Kitsune ถาวรติดตัว ดาบคู่ CDK หมัด Godhuman เงินม่วง 50,000+ Fragments',
      price: 1290.00,
      originalPrice: 1590.00,
      badge: '1:1 EXCLUSIVE',
      image: '/assets/blox_fruits_category.jpg',
      stockMode: StockMode.UNIQUE_1TO1,
      credentialFormat: CredentialFormat.USER_PASS,
      isFeatured: true,
      sortOrder: 3,
      categoryId: categoryMap['blox-fruits'],
    },
    {
      code: 'AD-GEMS-50K-01',
      title: 'ไก่ตัน Anime Defenders เพชร 50,000+ Gems พร้อมสุ่ม Secret',
      description: 'ไอดีฟาร์มเพชรแท้ 50,000+ Gems เลเวลพร้อมเทรดและสุ่มตู้ใหม่ทันที',
      price: 220.00,
      originalPrice: 350.00,
      badge: 'HOT DROP',
      image: '/assets/anime_defenders_category.jpg',
      stockMode: StockMode.POOL,
      credentialFormat: CredentialFormat.USER_PASS,
      isFeatured: true,
      sortOrder: 1,
      categoryId: categoryMap['anime-defenders'],
    },
  ];

  const productMap: Record<string, string> = {};
  for (const prod of productsData) {
    const created = await prisma.product.upsert({
      where: { code: prod.code },
      update: {
        title: prod.title,
        description: prod.description,
        price: prod.price,
        originalPrice: prod.originalPrice,
        badge: prod.badge,
        image: prod.image,
        stockMode: prod.stockMode,
        credentialFormat: prod.credentialFormat,
        isFeatured: prod.isFeatured,
        sortOrder: prod.sortOrder,
        categoryId: prod.categoryId,
      },
      create: prod,
    });
    productMap[prod.code] = created.id;
  }
  console.log(`Seeded ${Object.keys(productMap).length} products`);

  // 5. Upsert Sample Stock Items (Idempotent by credentialHash)
  const sampleStocks = [
    {
      serialCode: 'STK-BFGH-261019-0001',
      productId: productMap['BF-GH-CDK-01'],
      rawUsername: 'kz_bf_godhuman_001',
      maskedIdentity: 'kz_bf_***001',
      credentials: 'ENCRYPTED_DEMO:kz_bf_godhuman_001:PassKz9901',
      farmedMaps: 'Blox Fruits',
      details: 'Godhuman + CDK + Soul Guitar + Lv.2550 + 35M Beli',
      batchCode: 'LOT-20261019-BF01',
      supplierName: 'KZ_FARM_TEAM_A',
      costPrice: 95.00,
      status: StockStatus.AVAILABLE,
    },
    {
      serialCode: 'STK-BFGH-261019-0002',
      productId: productMap['BF-GH-CDK-01'],
      rawUsername: 'kz_bf_godhuman_002',
      maskedIdentity: 'kz_bf_***002',
      credentials: 'ENCRYPTED_DEMO:kz_bf_godhuman_002:PassKz9902',
      farmedMaps: 'Blox Fruits',
      details: 'Godhuman + CDK + Soul Guitar + Dough Awk + Lv.2550',
      batchCode: 'LOT-20261019-BF01',
      supplierName: 'KZ_FARM_TEAM_A',
      costPrice: 95.00,
      status: StockStatus.AVAILABLE,
    },
    {
      serialCode: 'STK-BFV4-261019-0001',
      productId: productMap['BF-V4-FULL-02'],
      rawUsername: 'kz_bf_v4shark_001',
      maskedIdentity: 'kz_bf_***001',
      credentials: 'ENCRYPTED_DEMO:kz_bf_v4shark_001:PassV4Shark99',
      farmedMaps: 'Blox Fruits',
      details: 'Shark V4 Full Gear + Godhuman + CDK + Soul Guitar',
      batchCode: 'LOT-20261019-BFV4',
      supplierName: 'KZ_FARM_TEAM_B',
      costPrice: 240.00,
      status: StockStatus.AVAILABLE,
    },
  ];

  for (const stk of sampleStocks) {
    const credentialHash = hashCredential(stk.rawUsername, encryptionSecret);
    await prisma.accountStock.upsert({
      where: { credentialHash },
      update: {
        farmedMaps: stk.farmedMaps,
        details: stk.details,
        status: stk.status,
      },
      create: {
        serialCode: stk.serialCode,
        productId: stk.productId,
        credentialFormat: CredentialFormat.USER_PASS,
        credentialHash,
        maskedIdentity: stk.maskedIdentity,
        credentials: stk.credentials,
        farmedMaps: stk.farmedMaps,
        details: stk.details,
        batchCode: stk.batchCode,
        supplierName: stk.supplierName,
        costPrice: stk.costPrice,
        status: stk.status,
      },
    });
  }
  console.log(`Seeded ${sampleStocks.length} initial stock records`);

  // 6. Record Audit Log Entry
  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      action: 'INITIAL_DATABASE_SEED',
      targetType: 'SYSTEM',
      targetId: 'SUPABASE_KZ_COMPANY',
      metadata: {
        categoriesCount: Object.keys(categoryMap).length,
        productsCount: Object.keys(productMap).length,
        stocksCount: sampleStocks.length,
      },
    },
  });

  console.log('Supabase seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
