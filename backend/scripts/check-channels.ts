import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const configs = await prisma.webhookChannelConfig.findMany();
  console.log(`Found ${configs.length} webhook channel configs:`);
  for (const c of configs) {
    console.log(`- channelKey: ${c.channelKey}, channelName: ${c.channelName}, channelId: ${c.channelId || 'null'}, webhookUrl: ${c.webhookUrl ? c.webhookUrl.substring(0, 35) + '...' : 'null'}, active: ${c.isActive}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
