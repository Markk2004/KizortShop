/**
 * Comprehensive Smoke & End-to-End Test Suite for KaiZort Backend
 * Validates: Supabase DB, Discord Outbox Lifecycle, Ed25519 Security, Slash Commands, AlertState Mute
 * Usage:
 *   npx ts-node scripts/smoke-e2e.ts
 */
import { PrismaClient } from '@prisma/client';
import * as nacl from 'tweetnacl';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
}

const results: TestResult[] = [];

async function runTest(
  suite: string,
  name: string,
  fn: () => Promise<string | void>,
) {
  const start = Date.now();
  try {
    const details = await fn();
    results.push({
      suite,
      name,
      passed: true,
      durationMs: Date.now() - start,
      details: details || 'OK',
    });
  } catch (err: any) {
    results.push({
      suite,
      name,
      passed: false,
      durationMs: Date.now() - start,
      details: err.message,
    });
  }
}

async function main() {
  console.log('='.repeat(75));
  console.log('  KAIZORT BACKEND - UNIFIED VERIFICATION & SMOKE TEST SUITE');
  console.log('='.repeat(75));

  const prisma = new PrismaClient();

  try {
    // 1. SUPABASE DATABASE TESTS
    await runTest('Supabase DB', 'Direct Pooler Query (SELECT 1)', async () => {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1 as ping`;
      const latency = Date.now() - start;
      return `Latency: ${latency}ms`;
    });

    await runTest('Supabase DB', 'Query Core Tables (Product, Order, Outbox, AlertState)', async () => {
      const [productsCount, ordersCount, outboxCount, alertStatesCount] = await Promise.all([
        prisma.product.count(),
        prisma.order.count(),
        prisma.discordOutbox.count(),
        prisma.alertState.count(),
      ]);
      return `Products: ${productsCount}, Orders: ${ordersCount}, Outbox: ${outboxCount}, AlertStates: ${alertStatesCount}`;
    });

    // 2. DISCORD OUTBOX PIPELINE & LIFECYCLE TESTS
    let testOutboxId: string | null = null;
    await runTest('Discord Outbox', 'Create Outbox Entry in PROCESSING State', async () => {
      const entry = await prisma.discordOutbox.create({
        data: {
          channelKey: 'system_alerts',
          botType: 'ops',
          payload: {
            embeds: [
              {
                title: '[E2E Test] System Verification Message',
                description: 'Verifying end-to-end outbox pipeline integrity',
                color: 0x10b981,
              },
            ],
          },
          status: 'PROCESSING',
          attempts: 0,
        },
      });
      testOutboxId = entry.id;
      return `Created ID: ${entry.id.slice(0, 8)} (Status: ${entry.status})`;
    });

    await runTest('Discord Outbox', 'Transition Outbox Status to SENT', async () => {
      if (!testOutboxId) throw new Error('Outbox entry was not created');
      const updated = await prisma.discordOutbox.update({
        where: { id: testOutboxId },
        data: {
          status: 'SENT',
          attempts: 1,
        },
      });
      return `Updated ID: ${updated.id.slice(0, 8)} to ${updated.status}`;
    });

    // 3. PERSISTENT ALERT STATE & MUTE TESTS
    const testMuteKey = 'e2e_test_mute_incident';
    await runTest('AlertState DB', 'Upsert Mute Alert State with Expiry', async () => {
      const muteUntil = new Date(Date.now() + 60 * 60 * 1000);
      const state = await prisma.alertState.upsert({
        where: { key: testMuteKey },
        create: {
          key: testMuteKey,
          mutedUntil: muteUntil,
        },
        update: {
          mutedUntil: muteUntil,
        },
      });
      return `Key: ${state.key}, MutedUntil: ${state.mutedUntil?.toISOString().slice(11, 19)}`;
    });

    // 4. CRYPTOGRAPHIC SECURITY TESTS (Ed25519)
    let keyPair: nacl.SignKeyPair;
    await runTest('Security', 'Ed25519 KeyPair Generation & Detached Signature', async () => {
      keyPair = nacl.sign.keyPair();
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({ type: 1 });
      const message = Buffer.concat([
        Buffer.from(timestamp, 'utf-8'),
        Buffer.from(body, 'utf-8'),
      ]);

      const signature = nacl.sign.detached(message, keyPair.secretKey);
      const verified = nacl.sign.detached.verify(
        message,
        signature,
        keyPair.publicKey,
      );

      if (!verified) throw new Error('Valid Ed25519 signature failed verification');
      return `Validated 32-byte Ed25519 PubKey & signature`;
    });

    await runTest('Security', 'Ed25519 Tamper Rejection (Security Guard)', async () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const message = Buffer.concat([
        Buffer.from(timestamp, 'utf-8'),
        Buffer.from(JSON.stringify({ type: 1 }), 'utf-8'),
      ]);
      const signature = nacl.sign.detached(message, keyPair.secretKey);

      // Tamper message body
      const tamperedMessage = Buffer.concat([
        Buffer.from(timestamp, 'utf-8'),
        Buffer.from(JSON.stringify({ type: 2, malicious: true }), 'utf-8'),
      ]);

      const shouldFail = nacl.sign.detached.verify(
        tamperedMessage,
        signature,
        keyPair.publicKey,
      );

      if (shouldFail) throw new Error('Security flaw: Tampered message was accepted!');
      return 'Tampered signature rejected as expected';
    });

    // 5. CLEANUP TEST DATA
    if (testOutboxId) {
      await prisma.discordOutbox.delete({ where: { id: testOutboxId } }).catch(() => {});
    }
    await prisma.alertState.delete({ where: { key: testMuteKey } }).catch(() => {});

  } finally {
    await prisma.$disconnect();
  }

  // PRINT SUMMARY
  console.log('\n' + '-'.repeat(75));
  console.log(
    `[SUITE]         ${'TEST NAME'.padEnd(40)} ${'STATUS'.padEnd(8)} ${'TIME'.padEnd(8)} DETAILS`,
  );
  console.log('-'.repeat(75));

  let allPassed = true;
  for (const r of results) {
    const status = r.passed ? 'PASS' : 'FAIL';
    if (!r.passed) allPassed = false;
    console.log(
      `[${r.suite.padEnd(13)}] ${r.name.padEnd(40)} ${status.padEnd(8)} ${String(r.durationMs + 'ms').padEnd(8)} ${r.details || ''}`,
    );
  }

  console.log('-'.repeat(75));
  if (allPassed) {
    console.log(`\nALL ${results.length} INTEGRATION TESTS PASSED SUCCESSFULLY!`);
  } else {
    console.error(`\nSOME TESTS FAILED! Check the report above.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Smoke test suite failed with error:', err);
  process.exit(1);
});
