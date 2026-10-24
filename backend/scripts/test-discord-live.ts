import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DiscordWebhookService } from '../src/common/webhook/discord-webhook.service';
import { DiscordOutboxService } from '../src/common/discord/discord-outbox.service';

async function testLive() {
  console.log('[Test Live] Bootstrapping Nest app...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const webhook = app.get(DiscordWebhookService);
  const outbox = app.get(DiscordOutboxService);

  console.log('[Test Live] Sending system test alert...');
  const enqueued = await webhook.notifySystemAlert({
    title: 'ทดสอบการเชื่อมต่อระบบ Discord สำเร็จ',
    message: 'ระบบ KaiZort Backend, Supabase Database และ Discord Integration เชื่อมต่อและทำงานร่วมกันได้อย่างสมบูรณ์',
    severity: 'INFO',
    alertKey: 'live_test_alert_' + Date.now(),
    metadata: {
      timestamp: new Date().toISOString(),
      environment: 'Verified Integration',
      status: 'ALL_SYSTEMS_OPERATIONAL',
    },
  });

  console.log('[Test Live] Enqueued to Outbox:', enqueued);

  console.log('[Test Live] Manually triggering Outbox processor...');
  await outbox.processOutboxQueue();

  console.log('[Test Live] Getting Outbox stats...');
  const stats = await outbox.getStats();
  console.log('[Test Live] Outbox stats:', stats);

  await app.close();
}

testLive().catch(console.error);
