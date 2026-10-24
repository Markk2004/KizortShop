import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.webhookChannelConfig.findUnique({
    where: { channelKey: 'system_alerts' },
  });

  if (!existing) {
    // Find audit channel or stock channel to borrow webhook if available
    const audit = await prisma.webhookChannelConfig.findUnique({
      where: { channelKey: 'tickets_audit' },
    });

    const created = await prisma.webhookChannelConfig.create({
      data: {
        channelKey: 'system_alerts',
        channelName: '#web-system-alerts',
        channelId: audit?.channelId || '1561784172857786378',
        webhookUrl: audit?.webhookUrl || '',
        isActive: true,
        description: 'แจ้งเตือนสถานะความสมบูรณ์และเหตุขัดข้องของระบบ (Health Watchdog & Incident Alerts)',
      },
    });
    console.log('[Success] Created system_alerts channel config:', created);
  } else {
    console.log('[Info] system_alerts channel config already exists:', existing);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
