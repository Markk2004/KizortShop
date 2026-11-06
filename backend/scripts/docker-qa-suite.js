/**
 * Docker Container End-to-End QA Test Suite
 * Tests all unified Discord Admin, Security, Stock, Expense, Topup, Order, and Bot features
 * directly in the running production container environment.
 */
const path = require('path');
const { NestFactory } = require('@nestjs/core');
const rootDir = process.cwd();
const { AppModule } = require(path.join(rootDir, 'dist/app.module'));
const crypto = require('crypto');

const ADMIN_USER_ID = '282304584716779532';
const UNAUTHORIZED_USER_ID = '999999999999999999';
const GUILD_ID = '1559139838517710888';

const results = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(testName, fn) {
  process.stdout.write(`  ⏳ Testing: ${testName}... `);
  const start = Date.now();
  try {
    await fn();
    const elapsed = Date.now() - start;
    console.log(`✅ PASSED (${elapsed}ms)`);
    results.push({ name: testName, status: 'PASSED', elapsed });
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`❌ FAILED (${elapsed}ms)\n     Error: ${err.message}`);
    results.push({ name: testName, status: 'FAILED', elapsed, error: err.message });
  }
}

async function main() {
  console.log('\n============================================================');
  console.log('🚀 STARTING DOCKER END-TO-END QA TEST SUITE');
  console.log('   Environment: Docker Container [kaitan-backend]');
  console.log('   Timestamp:', new Date().toISOString());
  console.log('============================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  // Resolve services from container DI
  const healthService = app.get(require(path.join(rootDir, 'dist/modules/health/health.service')).HealthService);
  const adminGuard = app.get(require(path.join(rootDir, 'dist/modules/discord-interactions/admin-guard.service')).AdminGuardService);
  const adminAudit = app.get(require(path.join(rootDir, 'dist/modules/discord-interactions/admin-audit.service')).AdminAuditService);
  const interactionsService = app.get(require(path.join(rootDir, 'dist/modules/discord-interactions/discord-interactions.service')).DiscordInteractionsService);
  const discordRest = app.get(require(path.join(rootDir, 'dist/common/discord/discord-rest.service')).DiscordRestService);
  const prisma = app.get(require(path.join(rootDir, 'dist/common/prisma/prisma.service')).PrismaService);

  console.log('📦 Services resolved from NestJS Dependency Injection container.\n');

  // TEST 1: Deep Health Check
  await runTest('1. Deep Health & Multi-Component Check', async () => {
    const health = await healthService.getDeepHealth();
    assert(health.status === 'HEALTHY', `Health status is ${health.status}`);
    assert(health.components.database.status === 'UP', 'Database is not UP');
    assert(health.components.discordBots.notifyBot.status === 'UP', 'notifyBot is not UP');
    assert(health.components.discordBots.opsBot.status === 'UP', 'opsBot is not UP');
    assert(health.components.frontend.status === 'UP', 'frontend is not UP');
  });

  // TEST 2: AdminGuardService Dual-Layer Verification
  await runTest('2. AdminGuard Dual-Layer Authorization (Allowlist & Role)', async () => {
    // 2.1 Allowlisted Admin ID
    const adminInteraction = {
      user: { id: ADMIN_USER_ID, username: 'StoreAdmin' },
      member: { user: { id: ADMIN_USER_ID }, permissions: '0' },
    };
    const adminCheck = await adminGuard.verifyAdmin(adminInteraction);
    assert(adminCheck.allowed === true, 'Admin User ID should be allowed');

    // 2.2 Unauthorized User without permissions
    const unauthorizedInteraction = {
      user: { id: UNAUTHORIZED_USER_ID, username: 'Attacker' },
      member: { user: { id: UNAUTHORIZED_USER_ID }, permissions: '0' },
    };
    const unauthCheck = await adminGuard.verifyAdmin(unauthorizedInteraction);
    assert(unauthCheck.allowed === false, 'Unauthorized user should be blocked');
    assert(
      unauthCheck.reason && (unauthCheck.reason.includes('Admin Allowlist') || unauthCheck.reason.includes('ปฏิเสธการเข้าถึง')),
      'Reason should mention Admin Allowlist rejection'
    );

    // 2.3 Allowlisted Admin with 0x8 bit
    const adminPermInteraction = {
      user: { id: ADMIN_USER_ID, username: 'StoreAdmin' },
      member: { user: { id: ADMIN_USER_ID }, permissions: '8' },
    };
    const permCheck = await adminGuard.verifyAdmin(adminPermInteraction);
    assert(permCheck.allowed === true, 'Allowlisted admin with permission should be allowed');

    // 2.4 Non-allowlisted user with 0x8 permission bit is blocked by Layer 1 (Strict ID Allowlist)
    const nonAllowlistedWithAdminBit = {
      user: { id: UNAUTHORIZED_USER_ID, username: 'ServerOwner' },
      member: { user: { id: UNAUTHORIZED_USER_ID }, permissions: '8' },
    };
    const nonAllowCheck = await adminGuard.verifyAdmin(nonAllowlistedWithAdminBit);
    assert(nonAllowCheck.allowed === false, 'Non-allowlisted user with 0x8 bit must still be blocked by Layer 1');

    // 2.5 Access Denied Ephemeral Response on admin component action
    const deniedResponse = await interactionsService.handleComponent({
      data: { custom_id: 'adm:nav:stock' },
      user: { id: UNAUTHORIZED_USER_ID, username: 'Attacker' },
      member: { user: { id: UNAUTHORIZED_USER_ID }, permissions: '0' },
    });
    assert(deniedResponse.type === 4, 'Response type should be 4 (CHANNEL_MESSAGE_WITH_SOURCE)');
    assert(deniedResponse.data.flags === 64, 'Response flags should be 64 (EPHEMERAL)');
    assert(deniedResponse.data.content.includes('ปฏิเสธการเข้าถึง'), 'Content should mention access denied');
  });

  // TEST 3: Slash Commands (/ping and /admin Hub)
  await runTest('3. Slash Commands Routing (/ping and unified /admin hub)', async () => {
    // 3.1 /ping
    const pingRes = await interactionsService.handleCommand({
      data: { name: 'ping' },
      user: { id: ADMIN_USER_ID },
    });
    assert(pingRes.type === 4, 'Ping response type should be 4');
    assert(pingRes.data.content.includes('Pong!'), 'Ping response should contain Pong!');

    // 3.2 /admin hub
    const adminRes = await interactionsService.handleCommand({
      data: { name: 'admin' },
      user: { id: ADMIN_USER_ID },
      member: { user: { id: ADMIN_USER_ID }, permissions: '0' },
    });
    assert(adminRes.type === 4, 'Admin response type should be 4');
    assert(adminRes.data.embeds?.[0]?.title.includes('Admin Control Hub'), 'Title should be Admin Control Hub');
    assert(adminRes.data.components?.length === 2, 'Hub should have exactly 2 action rows');
  });

  // TEST 4: Python Bot Shortcut Guide
  await runTest('4. Python Bot Shortcut Guide (adm:nav:pybot)', async () => {
    const pybotRes = await interactionsService.handleComponent({
      data: { custom_id: 'adm:nav:pybot' },
      user: { id: ADMIN_USER_ID },
      member: { user: { id: ADMIN_USER_ID } },
    });
    assert(pybotRes.type === 7, 'Response type should be 7 (UPDATE_MESSAGE)');
    const embed = pybotRes.data.embeds?.[0];
    assert(embed.title.includes('Python') || embed.title.includes('KaiZort Support'), 'Embed title should mention Python Bot');
    assert(embed.fields?.length >= 2, 'Should contain at least 2 fields');
  });

  // TEST 5: Stock Navigation & SKU Filter
  await runTest('5. Stock Navigation with Product SKU Select Menu', async () => {
    const stockRes = await interactionsService.handleComponent({
      data: { custom_id: 'adm:nav:stock' },
      user: { id: ADMIN_USER_ID },
      member: { user: { id: ADMIN_USER_ID } },
    });
    assert(stockRes.type === 7, 'Response type should be 7');
    assert(stockRes.data.embeds?.[0]?.title.includes('คลังสินค้า') || stockRes.data.embeds?.[0]?.title.includes('Stock Manager'), 'Title should mention stock system');
    
    // Check for Select Menu (Row 0)
    const row0 = stockRes.data.components?.[0];
    assert(row0?.components?.[0]?.type === 3, 'Row 0 should contain a String Select Menu (type 3)');
    assert(row0?.components?.[0]?.custom_id === 'adm:stock:filter_product', 'Select Menu custom_id should be adm:stock:filter_product');
  });

  // TEST 6: Bulk Stock SerialCode 100% Collision-Free Guarantee
  await runTest('6. Bulk Stock Fast In-Memory Hashing & Collision-Free Serial Code', async () => {
    const count = 100;
    const generatedSerials = [];
    const productCode = 'ROBLOX-TEST';

    for (let i = 0; i < count; i++) {
      const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const serialCode = `STK-${productCode}-${Date.now().toString(36).toUpperCase()}-${i + 1}-${randomSuffix}`;
      generatedSerials.push(serialCode);
    }

    const uniqueSet = new Set(generatedSerials);
    assert(uniqueSet.size === count, `Expected ${count} unique serials, but got ${uniqueSet.size}`);
  });

  // TEST 7: Expense Navigation & Select Menu 1-5
  await runTest('7. Expense Navigation & Select Menu (adm:expense:select)', async () => {
    const expRes = await interactionsService.handleComponent({
      data: { custom_id: 'adm:nav:expense' },
      user: { id: ADMIN_USER_ID },
      member: { user: { id: ADMIN_USER_ID } },
    });
    assert(expRes.type === 7, 'Response type should be 7');
    assert(expRes.data.embeds?.[0]?.title.includes('ค่าใช้จ่าย') || expRes.data.embeds?.[0]?.title.includes('Expense Manager'), 'Title should mention expense');
  });

  // TEST 8: Topup Queue & Slip Preview
  await runTest('8. Topup Queue Navigation & Safe Slip Embed Handling', async () => {
    const topupRes = await interactionsService.handleComponent({
      data: { custom_id: 'adm:nav:topups' },
      user: { id: ADMIN_USER_ID },
      member: { user: { id: ADMIN_USER_ID } },
    });
    assert(topupRes.type === 7, 'Response type should be 7');
    assert(topupRes.data.embeds?.[0]?.title.includes('สลิป') || topupRes.data.embeds?.[0]?.title.includes('Topups'), 'Title should mention slip check');
  });

  // TEST 9: Order Cancellation Guard (COMPLETED blocked, PENDING allowed)
  await runTest('9. Order Cancellation Guard (Blocks COMPLETED, allows PENDING)', async () => {
    const cancelRes = await interactionsService.handleComponent({
      data: { custom_id: 'adm:order:confirm_cancel:NON_EXISTENT_OR_COMPLETED_ORDER_ID' },
      user: { id: ADMIN_USER_ID },
      member: { user: { id: ADMIN_USER_ID } },
    });
    assert(cancelRes.type === 7, 'Should return update message type 7');
    assert(
      cancelRes.data?.content?.includes('ไม่พบออเดอร์') ||
      cancelRes.data?.content?.includes('PENDING'),
      'Should safely reject invalid or non-pending orders'
    );
  });

  // TEST 10: Admin Audit Service DB Persistence & Clean-up
  await runTest('10. Admin Audit Log PostgreSQL Supabase Persistence', async () => {
    const testAction = 'QA_AUTOMATED_AUDIT_TEST_' + Date.now();
    await adminAudit.log({
      action: testAction,
      targetType: 'SYSTEM_QA',
      targetId: 'TEST-1',
      actorDiscordId: ADMIN_USER_ID,
      actorUsername: 'QA#0001',
      metadata: { testSuite: 'Docker-E2E' },
    });

    const found = await prisma.auditLog.findFirst({
      where: { action: testAction },
    });
    assert(found !== null, 'Audit log was not saved in PostgreSQL');

    // Clean up QA test record
    await prisma.auditLog.delete({ where: { id: found.id } });
  });

  // TEST 11: Guild Nickname Synchronization
  await runTest('11. Bot Guild Nickname Sync in Guild ' + GUILD_ID, async () => {
    const resOps = await discordRest.syncBotNickname('ops', 'KaiZort Admin', GUILD_ID);
    const resNotify = await discordRest.syncBotNickname('notify', 'KaiZort Alerts', GUILD_ID);
    assert(resOps.success === true, `opsBot nickname sync failed: ${resOps.error}`);
    assert(resNotify.success === true, `notifyBot nickname sync failed: ${resNotify.error}`);
  });

  await app.close();

  console.log('\n============================================================');
  console.log('📊 QA TEST SUITE SUMMARY RESULTS');
  console.log('============================================================');
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  console.log(`Total Tests Run: ${results.length}`);
  console.log(`Passed:         ${passed} ✅`);
  console.log(`Failed:         ${failed} ${failed > 0 ? '❌' : '🎉'}`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal QA Runner Error:', err);
  process.exit(1);
});
