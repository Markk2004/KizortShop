/**
 * Script to register Discord Slash Commands for KaiZort Ops Bot
 * Usage:
 *   npx ts-node scripts/register-commands.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

const OPS_BOT_TOKEN =
  process.env.DISCORD_OPS_BOT_TOKEN ||
  process.env.DISCORD_NOTIFY_BOT_TOKEN ||
  process.env.DISCORD_BOT_TOKEN ||
  process.env.DISCORD_TOKEN;

let OPS_APP_ID = process.env.DISCORD_OPS_APP_ID || process.env.DISCORD_APP_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const USER_AGENT = 'DiscordBot (https://kaizort-shop.com, 1.0.0)';

if (!OPS_BOT_TOKEN) {
  console.error('[Error] Missing Discord Bot Token in environment (DISCORD_OPS_BOT_TOKEN / DISCORD_NOTIFY_BOT_TOKEN / DISCORD_TOKEN)');
  process.exit(1);
}

const opsCommands = [
  {
    name: 'web',
    description: 'ตรวจสอบสถานะหน้าร้าน (Frontend), API Latency และ Supabase Database',
  },
  {
    name: 'status',
    description: 'ดูภาพรวมสุขภาพระบบทั้งหมด (Render, DB, Bots, Outbox, Memory)',
  },
  {
    name: 'stock',
    description: 'ดูสต็อกสินค้าคงเหลือทุกรายการในระบบแบบเรียลไทม์',
  },
  {
    name: 'stock-log',
    description: 'ติดตามประวัติการลงของเข้าสู่คลังสินค้า',
    options: [
      {
        name: 'hours',
        description: 'จำนวนชั่วโมงย้อนหลัง (ค่าเริ่มต้น 24 ชั่วโมง)',
        type: 4, // INTEGER
        required: false,
      },
    ],
  },
  {
    name: 'orders',
    description: 'ดูคำสั่งซื้อล่าสุดและยอดรวมประจำวัน',
    options: [
      {
        name: 'status',
        description: 'กรองตามสถานะ (COMPLETED, PENDING, FAILED)',
        type: 3, // STRING
        required: false,
        choices: [
          { name: 'สำเร็จ (COMPLETED)', value: 'COMPLETED' },
          { name: 'รอดำเนินการ (PENDING)', value: 'PENDING' },
          { name: 'ล้มเหลว (FAILED)', value: 'FAILED' },
        ],
      },
    ],
  },
  {
    name: 'topups',
    description: 'ดูรายการแจ้งโอนเงินและคำขอเติมเงิน',
    options: [
      {
        name: 'status',
        description: 'กรองตามสถานะ (PENDING_VERIFY, SUCCESS, REJECTED)',
        type: 3,
        required: false,
        choices: [
          { name: 'รอตรวจสอบ (PENDING_VERIFY)', value: 'PENDING_VERIFY' },
          { name: 'สำเร็จ (SUCCESS)', value: 'SUCCESS' },
          { name: 'ปฏิเสธ (REJECTED)', value: 'REJECTED' },
        ],
      },
    ],
  },
  {
    name: 'tickets',
    description: 'ดูตั๋วติดต่อสอบถามของลูกค้าที่ยังเปิดค้างอยู่ (OPEN)',
  },
  {
    name: 'summary',
    description: 'สรุปภาพรวมยอดขาย กำไร คำสั่งซื้อ และสมาชิกใหม่',
    options: [
      {
        name: 'period',
        description: 'ช่วงเวลาที่ต้องการสรุป',
        type: 3,
        required: false,
        choices: [
          { name: 'วันนี้ (today)', value: 'today' },
          { name: 'สัปดาห์นี้ (week)', value: 'week' },
        ],
      },
    ],
  },
  {
    name: 'updates',
    description: 'ตรวจสอบความเปลี่ยนแปลงของสินค้า หมวดหมู่ และราคาบนเว็บ',
    options: [
      {
        name: 'hours',
        description: 'จำนวนชั่วโมงย้อนหลัง (ค่าเริ่มต้น 24 ชั่วโมง)',
        type: 4,
        required: false,
      },
    ],
  },
  {
    name: 'outbox',
    description: 'ตรวจสอบสถานะคิวการแจ้งเตือน Discord Outbox',
  },
  {
    name: 'retry-outbox',
    description: 'สั่งลองส่งข้อความแจ้งเตือนที่เคยล้มเหลวใหม่อีกครั้งทันที',
  },
  {
    name: 'mute',
    description: 'ปิดเสียงการแจ้งเตือนระบบชั่วคราว',
    options: [
      {
        name: 'alert',
        description: 'ชื่อประเภทการแจ้งเตือน (เช่น system_watchdog_incident, stale_tickets_alert)',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'minutes',
        description: 'ระยะเวลาที่ต้องการปิดเสียง (นาที ค่าเริ่มต้น 60)',
        type: 4, // INTEGER
        required: true,
      },
    ],
  },
];

async function register() {
  // 1. Auto-discover App ID if omitted
  if (!OPS_APP_ID) {
    console.log('[Info] Auto-discovering Application ID via Discord API...');
    const meRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bot ${OPS_BOT_TOKEN}`,
        'User-Agent': USER_AGENT,
      },
    });
    if (!meRes.ok) {
      throw new Error(`Failed to fetch @me: ${meRes.status} ${await meRes.text()}`);
    }
    const meData = await meRes.json();
    OPS_APP_ID = meData.id;
    console.log(`[Info] Resolved App ID: ${OPS_APP_ID} (${meData.username})`);
  }

  const endpointBase = GUILD_ID
    ? `https://discord.com/api/v10/applications/${OPS_APP_ID}/guilds/${GUILD_ID}/commands`
    : `https://discord.com/api/v10/applications/${OPS_APP_ID}/commands`;

  console.log(`[Registering Commands] Target: ${GUILD_ID ? `Guild ${GUILD_ID}` : 'Global'}`);

  // 2. Fetch existing commands so we don't wipe out non-ops commands (e.g. Python bot commands)
  let existingCommands: any[] = [];
  try {
    const getRes = await fetch(endpointBase, {
      headers: {
        Authorization: `Bot ${OPS_BOT_TOKEN}`,
        'User-Agent': USER_AGENT,
      },
    });
    if (getRes.ok) {
      existingCommands = await getRes.json();
      console.log(`[Info] Found ${existingCommands.length} existing commands on target.`);
    }
  } catch (err: any) {
    console.warn(`[Warn] Could not fetch existing commands: ${err.message}`);
  }

  // 3. Merge: keep existing commands that aren't in opsCommands, add/update opsCommands
  const opsNames = new Set(opsCommands.map((c) => c.name));
  const retainedExisting = existingCommands.filter((c) => !opsNames.has(c.name));
  const finalCommands = [...retainedExisting, ...opsCommands];

  console.log(`[Info] Registering total ${finalCommands.length} commands (${retainedExisting.length} retained + ${opsCommands.length} ops commands)...`);

  const res = await fetch(endpointBase, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${OPS_BOT_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify(finalCommands),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[Error] Failed to register commands (${res.status}): ${errorText}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`[Success] Successfully registered/updated ${data.length} slash commands!`);
}

register().catch(console.error);
