import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const item = await prisma.discordOutbox.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  console.log('[Latest Outbox Item]');
  console.log('ID:', item?.id);
  console.log('ChannelKey:', item?.channelKey);
  console.log('Status:', item?.status);
  console.log('Attempts:', item?.attempts);
  console.log('UpdatedAt:', item?.updatedAt);
  console.log('LastError:', item?.lastError);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
