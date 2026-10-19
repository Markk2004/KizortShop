import asyncio
import os
import tempfile
from datetime import datetime
import discord
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_path)
token = os.getenv("DISCORD_TOKEN")
guild_id = 1559139838517710888

intents = discord.Intents.default()
client = discord.Client(intents=intents)

@client.event
async def on_ready():
    guild = client.get_guild(guild_id)
    if not guild:
        print(f"[ERROR] Guild {guild_id} not found")
        await client.close()
        return

    print(f"[INFO] Connected to Guild: {guild.name} ({guild.id})")

    # 1. Send sample log to #web-members
    members_ch = None
    for ch in guild.text_channels:
        if ch.name == "web-members" or "members" in ch.name.lower():
            members_ch = ch
            break

    if members_ch:
        embed_member = discord.Embed(
            title="[WEB NOTIFICATION] สมาชิกใหม่ลงทะเบียนสำเร็จ",
            description="มีผู้ใช้งานสมัครสมาชิกใหม่ผ่านหน้าเว็บไซต์ทางการ KaiZort Store",
            color=discord.Color.blue(),
        )
        embed_member.add_field(name="[ชื่อผู้ใช้งาน]", value="`KaiZortTester_01`", inline=True)
        embed_member.add_field(name="[ระดับสมาชิก]", value="`Member (ผู้ใช้งานทั่วไป)`", inline=True)
        embed_member.add_field(name="[อีเมล]", value="`tester01@kaizort.com`", inline=True)
        embed_member.add_field(name="[สถานะบัญชี]", value="เปิดใช้งานเรียบร้อย (Active)", inline=True)
        embed_member.add_field(name="[ช่องทาง]", value="เว็บไซต์ KaiZort Store (Web Registration)", inline=True)
        embed_member.add_field(name="[หมายเหตุ]", value="ตัวอย่างการแจ้งเตือนระบบสมาชิก (Sample Member Log)", inline=False)
        embed_member.set_footer(text=f"KaiZort Member System | เวลา: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        await members_ch.send(embed=embed_member)
        print(f"[SUCCESS] Sent sample member log to #{members_ch.name}")
    else:
        print("[WARN] Channel #web-members not found")

    # 2. Send sample audit log to #web-tickets-audit
    audit_ch = None
    for ch in guild.text_channels:
        if "web-tickets-audit" in ch.name.lower() or ("tickets" in ch.name.lower() and "audit" in ch.name.lower()) or "audit" in ch.name.lower():
            audit_ch = ch
            break

    if audit_ch:
        embed_ticket = discord.Embed(
            title="[AUDIT] ตั๋วบริการใหม่: #0001 (ตัวอย่างเคสเคลมไอดี)",
            description="บันทึกข้อมูลการเปิดตั๋วติดต่อฝ่ายบริการลูกค้าของ KaiZort Store",
            color=discord.Color.green(),
        )
        embed_ticket.add_field(name="[ห้องตั๋ว]", value="`#ticket-0001`", inline=True)
        embed_ticket.add_field(name="[ผู้แจ้ง]", value="`KaiZortTester_01`", inline=True)
        embed_ticket.add_field(name="[ประเภทรายการ]", value="เคสออเดอร์มีปัญหา (เคลมไอดี)", inline=True)
        embed_ticket.add_field(name="[หัวข้อเรื่อง]", value="`เคลมไอดี Blox Fruits เข้าสู่ระบบไม่ได้`", inline=False)
        embed_ticket.add_field(name="[เลขที่คำสั่งซื้อ]", value="`ORD-20261019-9821`", inline=True)
        embed_ticket.add_field(name="[สถานะตั๋ว]", value="OPEN (รอเจ้าหน้าที่ตรวจสอบ)", inline=True)
        embed_ticket.add_field(
            name="[รายละเอียดปัญหาที่ลูกค้าแจ้ง]",
            value="```ซื้อไอดีไก่ตันผลตื่นมาเมื่อ 10 นาทีที่แล้ว พอใส่รหัสผ่านในเกม Roblox แจ้งว่า Incorrect Password ลองล็อกอิน 3 ครั้งแล้วยังเข้าไม่ได้ รบกวนทีมงานตรวจสอบหรือเปลี่ยนไอดีใหม่ให้ด้วยครับ```",
            inline=False,
        )
        embed_ticket.add_field(name="[หมายเหตุ]", value="ตัวอย่างบันทึกการเปิดเคสตั๋วปัญหา (Sample Audit Log)", inline=False)
        embed_ticket.set_footer(text=f"KaiZort Ticket Audit System | เวลา: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        # Create sample transcript file
        sample_transcript = "\n".join([
            "=" * 70,
            "KAIZORT STORE - TICKET TRANSCRIPT LOG (SAMPLE CASE)",
            "Ticket ID: ticket-0001",
            "Subject: เคลมไอดี Blox Fruits เข้าสู่ระบบไม่ได้",
            "User: KaiZortTester_01 (ID: 1559139248194453535)",
            "Order ID: ORD-20261019-9821",
            "Created At: 2026-10-20 00:50:00",
            "Status: CLOSED",
            "Closed By: Admin_Support",
            "Close Reason: ตรวจสอบและเปลี่ยนรหัสผ่านใหม่ให้ลูกค้าเรียบร้อย",
            "=" * 70,
            "",
            "[MESSAGE HISTORY]",
            "-" * 70,
            "[2026-10-20 00:50:05] KaiZortTester_01: สวัสดีครับ รบกวนแอดมินช่วยดูไอดี Blox Fruits ที่เพิ่งซื้อให้หน่อยครับ",
            "[2026-10-20 00:50:40] KaiZortTester_01: Order ID: ORD-20261019-9821 รหัสผ่านเข้าเกมไม่ได้ครับ",
            "[2026-10-20 00:51:15] Admin_Support: สวัสดีครับ ทีมงาน KaiZort Store ได้รับข้อมูลแล้ว ขอเวลาตรวจสอบในระบบสักครู่ครับ",
            "[2026-10-20 00:52:30] Admin_Support: ทางเราตรวจสอบพบว่ารหัสผ่านมีตัวอักษรพิมพ์เล็ก-ใหญ่ผิดพลาด ได้ทำการรีเซ็ตรหัสผ่านใหม่ให้แล้วครับ",
            "[2026-10-20 00:53:10] KaiZortTester_01: เข้าสู่ระบบได้เรียบร้อยแล้วครับ ขอบคุณแอดมินมากครับ",
            "[2026-10-20 00:53:40] Admin_Support: ด้วยความยินดีครับ หากไม่มีปัญหาเพิ่มเติม แอดมินขออนุญาตปิดตั๋วนี้นะครับ",
            "-" * 70,
            f"End of Transcript | Logged at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        ])

        temp_path = os.path.join(tempfile.gettempdir(), "sample_transcript_ticket-0001.txt")
        with open(temp_path, "w", encoding="utf-8") as f:
            f.write(sample_transcript)

        try:
            d_file = discord.File(temp_path, filename="sample_transcript_ticket-0001.txt")
            await audit_ch.send(embed=embed_ticket, file=d_file)
            print(f"[SUCCESS] Sent sample ticket audit log and transcript file to #{audit_ch.name}")
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass
    else:
        print("[WARN] Channel #web-tickets-audit not found")

    await client.close()

if __name__ == "__main__":
    client.run(token)
