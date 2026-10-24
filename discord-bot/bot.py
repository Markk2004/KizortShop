import asyncio
import logging
import time
import os
import json
import urllib.request
import urllib.error
import tempfile
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv

# Ensure .env is loaded before importing database or other modules
_base_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_base_dir, ".env"))

import discord
from discord import app_commands
from discord.ext import tasks
from config import Settings, load_settings
from database import Database
from key_service import KeyService
from process_service import ProcessService
from provider_client import ProviderClient
from roblox_service import RobloxService
from kaitun_service import KaitunService
from ticket_service import TicketService
from agy_service import AgyService, load_agy_settings, split_for_discord

logger = logging.getLogger(__name__)


def generate_bot_reply(user_message: str, prefix: str, hex_length: int) -> str:
    msg = user_message.lower().strip()

    if any(w in msg for w in ["สวัสดี", "หวัดดี", "ดีครับ", "ดีค่ะ", "hello", "hi", "hey"]):
        return (
            "[INFO] สวัสดีครับ ผมเป็นบอทผู้ช่วยสำหรับเซิร์ฟเวอร์นี้ครับ\n"
            "คุณสามารถพิมพ์คำสั่ง `/getkey` เพื่อรับคีย์ หรือพิมพ์ `/process` เพื่อส่งลิงก์ หรือพิมพ์ `/help` เพื่อดูคำสั่งทั้งหมดครับ"
        )

    if any(w in msg for w in ["process", "ลิงก์", "link", "โปรเซส"]):
        return (
            "[LINK] **วิธีประมวลผลลิงก์:**\n"
            "ใช้คำสั่ง `/process link:<URL>` เพื่อส่งลิงก์จากผู้ให้บริการที่ได้รับอนุญาตเข้าสู่ระบบ\n"
            "บอทจะแสดงสถานะ Processing... และสรุปผลลัพธ์พร้อมเวลาที่ใช้ให้ทันทีครับ"
        )

    if any(w in msg for w in ["key", "คีย์", "redeem", "รีดีม", "เติมคีย์", "ใส่คีย์", "ขอคีย์", "เอาคีย์"]):
        return (
            f"[KEY] **วิธีรับและใช้งานคีย์:**\n"
            f"1. พิมพ์คำสั่ง `/getkey` หรือ `/redeem` แล้วกด Enter ได้ทันที (ไม่ต้องกรอกคีย์)\n"
            f"2. บอทจะประมวลผล (Processing) พร้อมแถบความคืบหน้า\n"
            f"3. บอทจะสร้างคีย์ `{prefix}...` ให้คุณทันที พร้อมปุ่มกดคัดลอกคีย์ครับ"
        )

    if any(w in msg for w in ["ใคร", "บอทคือใคร", "ทำอะไรได้", "who are you", "help", "คำสั่ง"]):
        return (
            "[BOT] **เกี่ยวกับบอท:**\n"
            "ผมเป็นบอทผู้ช่วยดูแลระบบคีย์และตอบคำถามทั่วไปในเซิร์ฟเวอร์\n"
            "• ใช้ `/getkey` หรือ `/redeem` เพื่อรับคีย์ของคุณทันที\n"
            "• ใช้ `/process` เพื่อประมวลผลลิงก์ผ่านระบบที่ได้รับอนุญาต\n"
            "• ใช้ `/help` เพื่อดูคำสั่งทั้งหมด\n"
            "• ใช้ `/ask` เพื่อพูดคุยหรือสอบถามผมได้ตลอดเวลาครับ"
        )

    return (
        f"[REPLY] ขอบคุณสำหรับข้อความครับ: *\"{user_message}\"*\n\n"
        f"หากต้องการรับคีย์ ให้พิมพ์คำสั่ง `/getkey` ได้ทันทีเลยครับ"
    )


def get_channel_section(channel_name: str, channel_id: int = 0, category_name: str = "") -> str:
    c_name = channel_name.lower()
    cat_name = category_name.upper()

    if "kaitun" in c_name or channel_id == 1561017098094772264:
        return "kaitun"
    if any(k in c_name for k in ["ticket", "claim", "เคลม", "support"]) or channel_id in (1561760734554226688, 1561760772063895552):
        return "support"
    if any(k in c_name for k in ["vouch", "review", "รีวิว", "เครดิต"]) or channel_id == 1561760727155478659:
        return "vouch"
    if any(k in c_name for k in ["store", "website", "เว็บ", "ร้าน"]) or channel_id == 1561760711539953721:
        return "store"
    if any(k in c_name for k in ["announcement", "ประกาศ"]) or channel_id == 1561760706850721792:
        return "announcements"
    if any(k in c_name for k in ["rule", "กฎ"]) or channel_id == 1561760709044473958:
        return "rules"
    if any(k in c_name for k in ["order", "topup", "stock-log", "catalog", "audit"]) or "WEB LOGS" in cat_name:
        return "web_logs"
    if any(k in c_name for k in ["general", "แชท", "คุย"]) or channel_id == 1561760717051265034:
        return "general"
    return "general"


def build_channel_help_embed(section: str, channel_name: str = "", user_name: str = "") -> discord.Embed:
    sec = section.lower().strip()

    if sec == "kaitun":
        embed = discord.Embed(
            title="[คู่มือ] คำสั่งลัดประจำห้อง #kaitun-id (Kaitun Stock Vault)",
            description=(
                "ห้องจัดการคลังสต็อกไอดีไก่ตัน เชื่อมต่อกับฐานข้อมูล Supabase และหน้าเว็บ KaiZort 2 ทางแบบ Real-time\n"
                "*(ข้อมูลจะซิงค์กับเว็บไซต์และระบบตรวจสอบความปลอดภัยทันที)*"
            ),
            color=discord.Color.blue(),
        )
        embed.add_field(
            name="[คำสั่งข้อความด่วน (พิมพ์ในห้องนี้ได้ทันที)]",
            value=(
                "• `gen [จำนวน]` หรือ `gen [prefix] [จำนวน]` - สุ่มข้อมูลสำหรับนำไปสมัคร (เช่น `gen 5` หรือ `gen kaimhaShozp 3`)\n"
                "• `update <ชื่อไอดี> [ข้อมูล]` - อัปเดตรายละเอียดไอดี เช่น:\n"
                "  - `update kaimhaShozp_baa รหัส: NewPass123` (เปลี่ยนรหัสผ่าน)\n"
                "  - `update kaimhaShozp_baa ขายแล้ว` หรือ `ยังไม่ขาย` (เปลี่ยนสถานะขาย)\n"
                "  - `update kaimhaShozp_baa แมพ: Blox Fruits ข้อมูล: เวลตัน ผลโมจิ ราคา: 150 บาท`\n"
                "• `info <ชื่อไอดี>` - ดูรายละเอียดเชิงลึก รหัสผ่าน ประวัติ และราคาของไอดีนั้น\n"
                "• `stock` - ตรวจสอบสรุปจำนวนสต็อกรวมในคลัง (พร้อมขาย, ขายแล้ว, ทั้งหมด)\n"
                "• `stock list` - แสดงรายชื่อไอดีทั้งหมดในคลัง (สูงสุด 50 รายการ)\n"
                "• `stock unsold` (หรือ `ยังไม่ขาย`) - ดูเฉพาะไอดีที่พร้อมขาย\n"
                "• `stock sold` (หรือ `ขายแล้ว` / `ประวัติ`) - ดูเฉพาะไอดีที่ขายแล้ว\n"
                "• `get [จำนวน]` (หรือ `เบิก [จำนวน]`) - เบิกไอดีออกจากสต็อกพร้อมตัดยอดอัตโนมัติ\n"
                "• วางข้อความ `<user>|<pass>|<cookie>` - นำเข้าสต็อกอัตโนมัติ (หากไอดีมีอยู่แล้วจะอัปเดตรหัสผ่านให้ทันที ไม่เพิ่มสต็อกซ้ำ)\n"
                "• พิมพ์ `<ชื่อไอดี> ขายแล้ว` - ตัดสถานะเป็นขายแล้วทันที"
            ),
            inline=False,
        )
        embed.add_field(
            name="[คำสั่ง Slash Commands]",
            value=(
                "• `/stock_check` - ตรวจสอบจำนวนสต็อกคงเหลือ\n"
                "• `/stock_list [filter]` - ดูรายการไอดีทั้งหมดหรือแยกตามสถานะ\n"
                "• `/stock_info [username]` - ดูข้อมูลไอดีอย่างละเอียด\n"
                "• `/stock_update [username]` - เปิดฟอร์ม Modal Tab เพื่อแก้ไข\n"
                "• `/stock_password [username] [new_pass]` - เปลี่ยนรหัสผ่านของไอดี\n"
                "• `/stock_dispense [amount]` - เบิกไอดีจากสต็อก\n"
                "• `/gen_id [prefix] [amount]` - สุ่ม Username + Password สำหรับนำไปสมัคร"
            ),
            inline=False,
        )
        embed.set_footer(text="ระบบซิงค์สต็อก KaiZort 2-Way Sync | Supabase Connected")
        return embed

    if sec in ("support", "tickets"):
        embed = discord.Embed(
            title="[คู่มือ] ศูนย์ช่วยเหลือและแจ้งปัญหา #support-tickets",
            description=(
                "ช่องทางบริการลูกค้าสำหรับแจ้งปัญหาการสั่งซื้อ ติดต่อทีมงาน และส่งเรื่องเคลมไอดี\n"
                "ทีมงานพร้อมให้ความช่วยเหลือตลอด 24 ชั่วโมง"
            ),
            color=discord.Color.gold(),
        )
        embed.add_field(
            name="[คำสั่งข้อความด่วน (พิมพ์ในห้องนี้ได้ทันที)]",
            value=(
                "• `help` / `วิธีใช้` / `คำสั่ง` - แสดงคู่มือช่วยเหลือและขั้นตอนการเคลม\n"
                "• `claim` / `เคลม` / `แจ้งเคลม` - แสดงขั้นตอนและแบบฟอร์มการส่งเรื่องเคลมไอดี\n"
                "• `ticket` / `เปิดตั๋ว` / `ติดต่อแอดมิน` - แจ้งเตือนทีมงานเพื่อเข้าช่วยเหลือ\n"
                "• `status` / `สถานะ` - ตรวจสอบสถานะการทำงานของระบบ"
            ),
            inline=False,
        )
        embed.add_field(
            name="[เงื่อนไขและขั้นตอนการเคลมไอดี (Warranty Policy)]",
            value=(
                "1. ระยะเวลารับประกัน: 24 ชั่วโมงหลังได้รับไอดีจากเว็บไซต์\n"
                "2. กรณีที่รับเคลม: ไอดีเข้าสู่ระบบไม่ได้, รหัสผ่านไม่ถูกต้อง, หรือข้อมูลไม่ตรงตามที่ระบุในรายการสั่งซื้อ\n"
                "3. ข้อมูลที่ต้องเตรียมส่งให้ทีมงาน:\n"
                "   - เลขที่คำสั่งซื้อ (Order ID) จากหน้าเว็บไซต์\n"
                "   - อีเมลที่ใช้ทำรายการสั่งซื้อ\n"
                "   - ภาพหน้าจอหรือคลิปวิดีโอหลักฐานปัญหาที่พบ"
            ),
            inline=False,
        )
        embed.set_footer(text="ฝ่ายบริการลูกค้า KaiZort Store | ให้บริการตลอด 24 ชม.")
        return embed

    if sec == "general":
        embed = discord.Embed(
            title="[คู่มือ] คำสั่งลัดประจำห้อง #general-chat",
            description="ห้องพูดคุยแลกเปลี่ยนทั่วไปของคอมมูนิตี้ ทดสอบคำสั่ง และสั่งการระบบบอทผู้ช่วย",
            color=discord.Color.teal(),
        )
        embed.add_field(
            name="[คำสั่งข้อความด่วน (ไม่ต้องพิมพ์ /)]",
            value=(
                "• `help` / `วิธีใช้` / `คำสั่ง` - แสดงหน้ารวมคำสั่งลัดนี้\n"
                "• `status` / `สถานะ` - ตรวจเช็คสถานะการทำงานของ Roblox, Uptime และโปรเซสบนเครื่อง\n"
                "• `screen` / `จอ` / `แคป` - ขอภาพถ่ายหน้าจอสด (Live Screenshot) จากเครื่องโฮสต์\n"
                "• `reconnect` / `เข้าเกม` - สั่งเปิด Roblox PC และเข้าสู่เกมทันทีจากระยะไกล\n"
                "• `getkey` / `ขอคีย์` / `คีย์` - ขอรับ Access Key ฟรีประจำวัน"
            ),
            inline=False,
        )
        embed.add_field(
            name="[คำสั่ง Slash Commands]",
            value=(
                "• `/status` - ตรวจสอบสถานะ Roblox และ Uptime อย่างละเอียด\n"
                "• `/screen` - บันทึกภาพหน้าจอส่งกลับมาใน Discord ทันที\n"
                "• `/reconnect [place_id]` - เปิดเกม Roblox และเชื่อมต่อเข้าแมพที่กำหนด\n"
                "• `/getkey` - รับคีย์ประจำวันสำหรับเข้าใช้งานระบบ\n"
                "• `/process [link]` - ประมวลผลลิงก์ผ่านระบบที่ได้รับอนุญาต\n"
                "• `/ask [message]` - พูดคุย สอบถามข้อมูล หรือปรึกษาบอทผู้ช่วย\n"
                "• `/help [section]` - ดูคู่มือคำสั่งลัดเฉพาะห้องหรือภาพรวมทั้งหมด"
            ),
            inline=False,
        )
        embed.set_footer(text="KaiZort Assistant Bot | พิมพ์ข้อความหรือใช้ Slash Command ได้ทันที")
        return embed

    if sec in ("vouch", "reviews"):
        embed = discord.Embed(
            title="[คู่มือ] การส่งรีวิวและให้เครดิตร้าน #reviews-vouch",
            description="ห้องสำหรับลูกค้าแชร์ความประทับใจ ให้คะแนนการบริการ และตรวจสอบเครดิตความน่าเชื่อถือของ KaiZort Store",
            color=discord.Color.green(),
        )
        embed.add_field(
            name="[คำสั่งข้อความด่วน]",
            value=(
                "• `help` / `วิธีใช้` / `คำสั่ง` - แสดงคำแนะนำการส่งรีวิวและเครดิตร้าน\n"
                "• `review` / `รีวิว` / `เครดิต` / `vouch` - ดูตัวอย่างรูปแบบการโพสต์รีวิวที่ถูกต้อง"
            ),
            inline=False,
        )
        embed.add_field(
            name="[รูปแบบการส่งรีวิวแนะนำ]",
            value=(
                "1. ระบุสินค้าหรือบริการที่ได้รับ (เช่น ไก่ตัน Blox Fruits ผลตื่น, รหัส Robux)\n"
                "2. ให้คะแนนความพึงพอใจ (1 ถึง 5 ดาว)\n"
                "3. เขียนความประทับใจ เช่น การจัดส่งรวดเร็ว สินค้าตรงปก\n"
                "4. แนบรูปภาพสินค้า หรือหลักฐานการได้รับสินค้าจากหน้าเว็บ\n"
                "*หมายเหตุ: ลูกค้าสามารถรีวิวและให้คะแนนผ่านหน้า Order บนเว็บไซต์ได้อีกช่องทางหนึ่ง*"
            ),
            inline=False,
        )
        embed.set_footer(text="KaiZort Store Vouch & Review Community")
        return embed

    if sec in ("store", "website"):
        embed = discord.Embed(
            title="[คู่มือ] ช่องทางร้านค้าและสั่งซื้อสินค้า #store-website",
            description="ข้อมูลร้านค้า ลิงก์เข้าสู่เว็บไซต์ทางการ แคตตาล็อกสินค้า และวิธีการชำระเงิน",
            color=discord.Color.purple(),
        )
        embed.add_field(
            name="[คำสั่งข้อความด่วน]",
            value=(
                "• `help` / `วิธีใช้` / `คำสั่ง` - แสดงข้อมูลช่องทางการสั่งซื้อ\n"
                "• `web` / `เว็บ` / `store` - ขอรับลิงก์เว็บไซต์ทางการ KaiZort Store\n"
                "• `pay` / `ชำระเงิน` / `เติมเงิน` - ตรวจสอบช่องทางการชำระเงินที่รองรับ\n"
                "• `catalog` / `สินค้า` - ดูหมวดหมู่สินค้าและบริการที่มีจำหน่าย"
            ),
            inline=False,
        )
        embed.add_field(
            name="[ข้อมูลระบบร้านค้าและบริการ]",
            value=(
                "• เว็บไซต์ทางการ: KaiZort Store (เปิดบริการตลอด 24 ชั่วโมง)\n"
                "• ระบบจัดส่ง: ระบบส่งมอบไอดีและสินค้าอัตโนมัติทันทีหลังชำระเงิน\n"
                "• ช่องทางชำระเงิน: สแกน PromptPay QR Code, บัญชีธนาคาร, TrueMoney Wallet, ซองของขวัญ\n"
                "• สินค้าที่มีจำหน่าย: ไอดีไก่ตัน Roblox (Blox Fruits, King Legacy, Anime Vanguards), เติม Robux, ไอเทมพิเศษ"
            ),
            inline=False,
        )
        embed.set_footer(text="KaiZort Store Official | ร้านค้าไอดีและบริการเกม Roblox อัตโนมัติ")
        return embed

    if sec == "announcements":
        embed = discord.Embed(
            title="[คู่มือ] ข้อมูลห้องประกาศข่าวสาร #announcements",
            description="ห้องสำหรับติดตามข่าวสารทางการ อัปเดตสินค้าใหม่ แพตช์เกม และโปรโมชั่นพิเศษจาก KaiZort Store",
            color=discord.Color.blurple(),
        )
        embed.add_field(
            name="[ข้อกำหนดและการใช้งาน]",
            value=(
                "• เฉพาะทีมงานและผู้ดูแลระบบเท่านั้นที่สามารถประกาศข้อความได้\n"
                "• สมาชิกทั่วไปสามารถกดรีแอคชันและเปิดแจ้งเตือนห้องนี้เพื่อไม่ให้พลาดกิจกรรมแจกคีย์และโค้ดส่วนลดพิเศษ\n"
                "• พิมพ์ `help` เพื่อดูคำสั่งลัดของเซิร์ฟเวอร์"
            ),
            inline=False,
        )
        embed.set_footer(text="KaiZort Official Announcements")
        return embed

    if sec == "rules":
        embed = discord.Embed(
            title="[คู่มือ] กฎระเบียบและข้อตกลงของเซิร์ฟเวอร์ #rules",
            description="กฎเกณฑ์การอยู่ร่วมกันในเซิร์ฟเวอร์เพื่อความเรียบร้อยและปลอดภัยของทุกคน",
            color=discord.Color.orange(),
        )
        embed.add_field(
            name="[กฎระเบียบสำคัญ]",
            value=(
                "1. สุภาพและเคารพซึ่งกันและกัน ห้ามใช้ถ้อยคำหยาบคาย รุนแรง หรือเหยียดผู้อื่น\n"
                "2. ห้ามสแปมข้อความ แท็กบุคคล หรือโปรโมทเซิร์ฟเวอร์/ร้านค้าอื่นโดยไม่ได้รับอนุญาต\n"
                "3. ห้ามเผยแพร่ข้อมูลส่วนบุคคล ลิงก์ไวรัส หรือเนื้อหาที่ผิดกฎหมายทุกชนิด\n"
                "4. สำหรับการซื้อขาย กรุณาทำรายการผ่านเว็บไซต์ทางการของ KaiZort Store เท่านั้น เพื่อความปลอดภัยของท่าน\n"
                "5. หากพบปัญหาในการสั่งซื้อ ให้ติดต่อในห้อง #support-tickets เท่านั้น"
            ),
            inline=False,
        )
        embed.set_footer(text="KaiZort Server Rules & Policy")
        return embed

    if sec in ("web_logs", "admin_logs"):
        embed = discord.Embed(
            title="[คู่มือ Admin] ระบบบันทึก Webhook แจ้งเตือนจากเว็บไซต์ (KAIZORT WEB LOGS)",
            description="หมวดหมู่สำหรับผู้ดูแลระบบ เชื่อมต่อ Webhook จาก Backend NestJS เพื่อแจ้งเตือนกิจกรรมทั้งหมดแบบ Real-time",
            color=discord.Color.dark_grey(),
        )
        embed.add_field(
            name="[รายชื่อห้องและหน้าที่การแจ้งเตือน]",
            value=(
                "• `#web-orders` - แจ้งเตือนคำสั่งซื้อใหม่ การชำระเงิน และการส่งมอบไอดี\n"
                "• `#web-topups` - แจ้งเตือนการแจ้งเติมเงิน ผลการตรวจสลิป และยอดเงินคงเหลือ\n"
                "• `#web-stock-logs` - บันทึกการเพิ่ม แก้ไข นำเข้า และตัดสต็อกสินค้า\n"
                "• `#web-catalog` - แจ้งเตือนการปรับเปลี่ยนสินค้า หมวดหมู่ แบนเนอร์ และแท็ก\n"
                "• `#web-tickets-audit` - แจ้งเตือนตั๋วปัญหา การเคลมไอดี และบันทึก Audit Log ความปลอดภัย\n"
                "• `#kaitun-id` - จัดการสต็อกไอดีไก่ตัน ซิงค์ข้อมูลกับ Supabase 2 ทาง"
            ),
            inline=False,
        )
        embed.add_field(
            name="[คำสั่งจัดการ Webhook]",
            value="• `/setup_web_channels` - สั่งตรวจสอบและเชื่อมโยง Webhook ทั้งหมดเข้าสู่ Supabase อัตโนมัติ",
            inline=False,
        )
        embed.set_footer(text="KAIZORT SYSTEM LOGS | สำหรับทีมงานและผู้ดูแลระบบ")
        return embed

    # all / default
    embed = discord.Embed(
        title="[คู่มือรวม] โครงสร้างห้องและคำสั่งลัดทั้งหมดในเซิร์ฟเวอร์",
        description="สรุปโครงสร้างห้องและคำสั่งลัดสำหรับใช้งานบอทในแต่ละช่องทางของเซิร์ฟเวอร์ KaiZort",
        color=discord.Color.blue(),
    )
    embed.add_field(
        name="[1. INFORMATION & RULES]",
        value=(
            "• `#announcements` - ประกาศข่าวสารและโปรโมชั่น\n"
            "• `#rules` - กฎระเบียบและข้อตกลงของเซิร์ฟเวอร์\n"
            "• `#store-website` - ข้อมูลร้าน ลิงก์เว็บทางการ และวิธีชำระเงิน (พิมพ์ `help` หรือ `web`)"
        ),
        inline=False,
    )
    embed.add_field(
        name="[2. COMMUNITY & VOUCH]",
        value=(
            "• `#general-chat` - พูดคุยทั่วไป คำสั่งสตรีมจอ สถานะบอท และรับคีย์ (พิมพ์ `help`, `status`, `screen`, `getkey`)\n"
            "• `#reviews-vouch` - ห้องส่งรีวิวและให้เครดิตร้าน (พิมพ์ `help` หรือ `review`)"
        ),
        inline=False,
    )
    embed.add_field(
        name="[3. CUSTOMER SUPPORT]",
        value="• `#support-tickets` - แจ้งปัญหาการสั่งซื้อและเคลมประกันไอดี 24 ชม. (พิมพ์ `help`, `claim` หรือ `ticket`)",
        inline=False,
    )
    embed.add_field(
        name="[4. KAIZORT WEB LOGS (Admin)]",
        value=(
            "• `#kaitun-id` - จัดการคลังไอดีไก่ตัน ซิงค์ 2 ทาง (พิมพ์ `gen`, `update`, `info`, `stock`, `get`)\n"
            "• `#web-orders`, `#web-topups`, `#web-stock-logs`, `#web-catalog`, `#web-tickets-audit` - บันทึก Webhook แจ้งเตือนอัตโนมัติ"
        ),
        inline=False,
    )
    embed.set_footer(text="พิมพ์ help ในแต่ละห้องเพื่อดูคำสั่งลัดเฉพาะห้องนั้นได้ทันที")
    return embed


class CopyKeyView(discord.ui.View):
    def __init__(self, key: str):
        super().__init__(timeout=180)
        self.key = key

    @discord.ui.button(
        label="📋 คัดลอกคีย์ (Copy Key)",
        style=discord.ButtonStyle.primary,
        custom_id="btn_copy_key",
    )
    async def copy_key_button(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        await interaction.response.send_message(
            f"```{self.key}```\n*(แตะค้างหรือคลิกที่กล่องข้อความด้านบนเพื่อ Copy คีย์ได้ทันที)*",
            ephemeral=True,
        )


class ReconnectView(discord.ui.View):
    def __init__(self, place_id: Optional[str] = None):
        super().__init__(timeout=None)  # persistent view
        self.place_id = place_id

    @discord.ui.button(
        label="🔄 Reconnect (เปิดเกมใหม่ทันที)",
        style=discord.ButtonStyle.success,
        custom_id="btn_reconnect_game",
    )
    async def reconnect_button(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        from roblox_service import launch_roblox
        await interaction.response.defer(ephemeral=False)
        ok, msg = launch_roblox(self.place_id)
        if ok:
            embed = discord.Embed(
                title="🚀 ดำเนินการเปิดเกมใหม่เรียบร้อย",
                description=f"{msg}\nระบบกำลังรัน Roblox PC บนเครื่องคอมพิวเตอร์ของคุณ",
                color=discord.Color.green(),
            )
            embed.set_footer(text=f"สั่งการโดย {interaction.user.name} • {datetime.now().strftime('%H:%M:%S')}")
            await interaction.followup.send(embed=embed)
        else:
            await interaction.followup.send(f"❌ {msg}", ephemeral=True)

class StockUpdateModal(discord.ui.Modal, title="📝 ฟอร์มอัปเดตข้อมูลไอดี"):
    def __init__(self, kaitun_service: KaitunService, prefill_account: Optional[dict] = None):
        super().__init__()
        self.kaitun_service = kaitun_service

        default_user = prefill_account.get("username", "") if prefill_account else ""
        default_maps = prefill_account.get("farmed_maps", "") if prefill_account else ""
        default_details = prefill_account.get("details", "") if prefill_account else ""
        default_price = prefill_account.get("price", "") if prefill_account else ""
        default_status = "ขายแล้ว" if (prefill_account and prefill_account.get("sale_status") == "sold") else "ยังไม่ขาย"

        self.username_input = discord.ui.TextInput(
            label="ชื่อไอดี (Username)",
            placeholder="เช่น kaimhaShozp_baa",
            default=default_user,
            required=True,
            max_length=50,
        )
        self.maps_input = discord.ui.TextInput(
            label="แมพที่ฟาร์ม (Farmed Maps)",
            placeholder="เช่น Blox Fruits, King Legacy, Anime Vanguards",
            default=default_maps,
            required=False,
            max_length=100,
        )
        self.details_input = discord.ui.TextInput(
            label="รายละเอียดของในไอดี (Details)",
            placeholder="เช่น เวลตัน 2550 หมัดก็อด ดาบคู่ ผลโมจิตื่น",
            default=default_details,
            style=discord.TextStyle.paragraph,
            required=False,
            max_length=500,
        )
        self.price_input = discord.ui.TextInput(
            label="ราคาขาย (Price)",
            placeholder="เช่น 150 บาท",
            default=default_price,
            required=False,
            max_length=40,
        )
        self.status_input = discord.ui.TextInput(
            label="สถานะการขาย (ยังไม่ขาย / ขายแล้ว)",
            placeholder="พิมพ์: ขายแล้ว หรือ ยังไม่ขาย",
            default=default_status,
            required=False,
            max_length=30,
        )

        self.add_item(self.username_input)
        self.add_item(self.maps_input)
        self.add_item(self.details_input)
        self.add_item(self.price_input)
        self.add_item(self.status_input)

    async def on_submit(self, interaction: discord.Interaction):
        # 1. Immediate deferral to prevent Discord 3-second timeout (Error 10062)
        await interaction.response.defer(ephemeral=False)

        u = self.username_input.value.strip()
        acc = self.kaitun_service.get_account(u)
        if not acc:
            await interaction.followup.send(
                f"❌ ไม่พบไอดี `{u}` ในระบบ กรุณาตรวจสอบชื่อ Username อีกครั้ง",
                ephemeral=True,
            )
            return

        status_val = self.status_input.value.strip().lower()
        sale_status = "sold" if any(w in status_val for w in ["ขายแล้ว", "sold", "yes"]) else "unsold"

        self.kaitun_service.update_account(
            username=u,
            farmed_maps=self.maps_input.value.strip(),
            details=self.details_input.value.strip(),
            sale_status=sale_status,
            price=self.price_input.value.strip(),
        )

        acc_updated = self.kaitun_service.get_account(u) or acc
        embed = discord.Embed(
            title=f"✅ อัปเดตข้อมูลไอดีเรียบร้อย: {u}",
            color=discord.Color.green(),
        )
        embed.add_field(
            name="🏷️ สถานะการขาย",
            value="🔴 **ขายแล้ว (Sold)**" if acc_updated.get("sale_status") == "sold" else "🟢 **ยังไม่ขาย (Unsold)**",
            inline=True,
        )
        if acc_updated.get("price"):
            embed.add_field(name="💰 ราคา", value=f"`{acc_updated['price']}`", inline=True)
        embed.add_field(
            name="🗺️ แมพที่ฟาร์ม",
            value=f"`{acc_updated.get('farmed_maps') or 'ยังไม่ได้ระบุ'}`",
            inline=False,
        )
        embed.add_field(
            name="📝 รายละเอียดของในไอดี",
            value=f"```{acc_updated.get('details') or 'ยังไม่ได้ระบุ'}```",
            inline=False,
        )
        embed.set_footer(text=f"อัปเดตผ่านฟอร์มโดย {interaction.user.name} • {datetime.now().strftime('%H:%M:%S')}")
        await interaction.followup.send(embed=embed)


EXPENSE_CAT_MAP = {
    "SCRIPT": {"label": "ค่าสคริปต์ฟาร์ม", "emoji": "📜"},
    "VPS": {"label": "ค่า VPS / เซิร์ฟเวอร์", "emoji": "💻"},
    "ELECTRICITY": {"label": "ค่าไฟ / ฮาร์ดแวร์", "emoji": "⚡"},
    "BOT_HOST": {"label": "ค่าโฮสต์บอท Discord", "emoji": "🤖"},
    "OTHER": {"label": "รายจ่ายอื่นๆ", "emoji": "📦"},
}


def build_accounting_embed(db: Database) -> discord.Embed:
    stats = db.get_financial_stats()

    revenue = stats.get("total_revenue", 0.0)
    cost = stats.get("total_cost", 0.0)
    expenses = stats.get("operating_expenses", 0.0)
    profit = stats.get("net_profit", 0.0)
    margin = stats.get("profit_margin", 100.0)
    inv_val = stats.get("inventory_value", 0.0)
    sold = stats.get("sold_count", 0)
    avail = stats.get("available_count", 0)

    is_loss = profit < 0
    profit_str = (
        "฿0.00"
        if profit == 0
        else (f"-฿{abs(profit):,.2f}" if is_loss else f"+฿{profit:,.2f}")
    )

    embed = discord.Embed(
        title="📊 สรุปบัญชีการเงิน KaiZort (Cost & Profit Accounting)",
        description="คำนวณจากยอดขายจริง ต้นทุนไอดี และค่าใช้จ่ายร้านใน Supabase Database",
        color=discord.Color.red() if is_loss else discord.Color.green(),
    )
    embed.add_field(name="💰 ยอดขายจริงรวม (รายรับ)", value=f"฿{revenue:,.2f} ({sold} รายการ)", inline=True)
    embed.add_field(name="📦 ต้นทุนไอดี (COGS)", value=f"฿{cost:,.2f}", inline=True)
    embed.add_field(name="⚡ ค่าใช้จ่ายร้าน (รายจ่าย)", value=f"฿{expenses:,.2f}", inline=True)
    embed.add_field(
        name="📉 ขาดทุนสุทธิ (Net Loss)" if is_loss else "📈 กำไรสุทธิแท้จริง (Net Profit)",
        value=f"**{profit_str}** ({margin}%)",
        inline=True,
    )
    embed.add_field(name="💎 มูลค่าสต็อกคงเหลือ", value=f"฿{inv_val:,.2f} ({avail} บัญชี)", inline=True)
    embed.add_field(name="📦 สถานะคลังรวม", value=f"🟢 พร้อมขาย: {avail} | 🔴 ขายแล้ว: {sold}", inline=True)
    embed.set_footer(text="ระบบบัญชีอัตโนมัติ Real-Time Sync • /accounting • /admin/expense")
    return embed


def build_expense_list_embed(db: Database, limit: int = 15) -> Optional[discord.Embed]:
    expenses = db.list_expenses(limit=limit)
    if not expenses:
        return None

    total = sum(float(e.get("amount") or 0.0) for e in expenses)
    lines = []
    for i, e in enumerate(expenses):
        d_str = e.get("paidAt", "")[:10]
        cat_k = e.get("category", "OTHER")
        cat_info = EXPENSE_CAT_MAP.get(cat_k, {"label": cat_k, "emoji": "📦"})
        lines.append(f"`{i+1}.` **{e['title']}** — ฿{float(e['amount']):,.2f} ({cat_info['emoji']} `{cat_info['label']}`) • {d_str}")

    embed = discord.Embed(
        title=f"💸 รายการค่าใช้จ่ายร้านล่าสุด ({len(expenses)} รายการ)",
        description="\n".join(lines),
        color=discord.Color.gold(),
    )
    embed.add_field(name="⚡ ยอดค่าใช้จ่ายรวม", value=f"**฿{total:,.2f}**", inline=False)
    embed.set_footer(text="จัดการค่าใช้จ่ายเพิ่มเติมได้ที่หน้าเว็บ /admin/expense")
    return embed


class ExpenseModal(discord.ui.Modal):
    def __init__(self, db: Database, category: str = "OTHER"):
        cat_info = EXPENSE_CAT_MAP.get(category, {"label": "รายจ่ายทั่วไป", "emoji": "💸"})
        super().__init__(title=f"💸 บันทึก: {cat_info['label'][:25]}")
        self.db = db
        self.category = category

        # เติมชื่อรายการ (หัวข้อ) อัตโนมัติตามหมวดหมู่ที่เลือกมา
        default_title = cat_info["label"] if category != "OTHER" else ""

        self.title_input = discord.ui.TextInput(
            label="ชื่อรายการค่าใช้จ่าย (Title / หัวข้อ)",
            default=default_title,
            placeholder="เช่น ค่าสคริปต์ฟาร์ม, ค่า VPS, ค่าไฟ",
            required=True,
            max_length=100,
        )
        self.amount_input = discord.ui.TextInput(
            label="จำนวนเงิน (บาท / THB)",
            placeholder="เช่น 150 หรือ 300.50",
            required=True,
            max_length=20,
        )
        self.note_input = discord.ui.TextInput(
            label="หมายเหตุเพิ่มเติม (เว้นว่างได้)",
            placeholder="เช่น ซื้อจากร้าน Dev XYZ หรือ รอบบิล 20 ต.ค.",
            style=discord.TextStyle.paragraph,
            required=False,
            max_length=500,
        )

        self.add_item(self.title_input)
        self.add_item(self.amount_input)
        self.add_item(self.note_input)

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=False)
        title = self.title_input.value.strip()
        raw_amt = self.amount_input.value.strip()
        cat = self.category
        note = self.note_input.value.strip() or None

        import re
        nums = re.findall(r"[\d.]+", raw_amt)
        if not nums:
            await interaction.followup.send("❌ กรุณาระบุจำนวนเงินเป็นตัวเลขที่ถูกต้อง (เช่น `150`)", ephemeral=True)
            return

        try:
            amt = float(nums[0])
        except Exception:
            await interaction.followup.send("❌ จำนวนเงินไม่ถูกต้อง", ephemeral=True)
            return

        exp = self.db.add_expense(title=title, amount=amt, category=cat, note=note)
        if not exp:
            await interaction.followup.send("❌ ไม่สามารถบันทึกค่าใช้จ่ายลงฐานข้อมูลได้", ephemeral=True)
            return

        cat_info = EXPENSE_CAT_MAP.get(cat, {"label": cat, "emoji": "💸"})
        embed = discord.Embed(
            title=f"💸 บันทึกค่าใช้จ่ายร้านสำเร็จ: {title}",
            description="บันทึกข้อมูลเข้าสู่ฐานข้อมูลและหักลบจากกำไรสุทธิบนหน้าเว็บเรียบร้อยแล้ว",
            color=discord.Color.gold(),
        )
        embed.add_field(name="💰 จำนวนเงิน", value=f"**฿{amt:,.2f}**", inline=True)
        embed.add_field(name="🏷️ หมวดหมู่", value=f"{cat_info['emoji']} `{cat_info['label']}`", inline=True)
        if note:
            embed.add_field(name="📝 หมายเหตุ", value=f"```{note}```", inline=False)
        embed.set_footer(text=f"บันทึกโดย {interaction.user.name} • ซิงค์กับระบบบัญชีเว็บ /admin/expense ทันที")

        await interaction.followup.send(embed=embed)


class ExpenseCategorySelect(discord.ui.Select):
    def __init__(self, db: Database):
        self.db = db
        options = [
            discord.SelectOption(
                label="ค่าสคริปต์ฟาร์ม",
                value="SCRIPT",
                emoji="📜",
                description="สคริปต์ฟาร์มออโต้รายเดือน/รายวัน",
            ),
            discord.SelectOption(
                label="ค่า VPS / Cloud Server",
                value="VPS",
                emoji="💻",
                description="ค่าเครื่องรันฟาร์ม VPS หรือ Cloud",
            ),
            discord.SelectOption(
                label="ค่าไฟ / อุปกรณ์ฮาร์ดแวร์",
                value="ELECTRICITY",
                emoji="⚡",
                description="ค่าไฟฟาร์ม, อุปกรณ์คอมพิวเตอร์",
            ),
            discord.SelectOption(
                label="ค่าโฮสต์บอท Discord",
                value="BOT_HOST",
                emoji="🤖",
                description="ค่าเซิร์ฟเวอร์รันบอท Discord",
            ),
            discord.SelectOption(
                label="รายจ่ายอื่นๆ ของร้าน",
                value="OTHER",
                emoji="📦",
                description="ค่าใช้จ่ายเบ็ดเตล็ดอื่นๆ",
            ),
        ]
        super().__init__(
            custom_id="expense:category_select",
            placeholder="👇 เลือกหมวดหมู่ค่าใช้จ่ายเพื่อเปิดฟอร์มกรอก...",
            min_values=1,
            max_values=1,
            options=options,
        )

    async def callback(self, interaction: discord.Interaction):
        try:
            selected_cat = self.values[0] if self.values else "OTHER"
            modal = ExpenseModal(db=self.db, category=selected_cat)
            await interaction.response.send_modal(modal)
        except Exception as e:
            logger.error("Error sending ExpenseModal: %s", e, exc_info=True)
            try:
                if not interaction.response.is_done():
                    await interaction.response.send_message(f"❌ เกิดข้อผิดพลาดในการเปิดฟอร์ม: {e}", ephemeral=True)
            except Exception:
                pass


class ExpenseInteractiveView(discord.ui.View):
    def __init__(self, db: Database):
        super().__init__(timeout=None)
        self.db = db
        self.add_item(ExpenseCategorySelect(db=db))

    @discord.ui.button(
        label="กรอกฟอร์มด่วน (ค่าใช้จ่ายทั่วไป)",
        style=discord.ButtonStyle.secondary,
        emoji="📝",
        custom_id="expense:quick_button",
    )
    async def quick_form_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        try:
            modal = ExpenseModal(db=self.db, category="OTHER")
            await interaction.response.send_modal(modal)
        except Exception as e:
            logger.error("Error sending Quick ExpenseModal: %s", e, exc_info=True)
            try:
                if not interaction.response.is_done():
                    await interaction.response.send_message(f"❌ เกิดข้อผิดพลาดในการเปิดฟอร์ม: {e}", ephemeral=True)
            except Exception:
                pass


def build_ticket_panel_embed() -> discord.Embed:
    embed = discord.Embed(
        title="KAIZORT STORE SUPPORT",
        description=(
            "ศูนย์บริการลูกค้าและแจ้งปัญหา KaiZort Store\n"
            "กดปุ่ม **Create ticket** ด้านล่างเพื่อเปิดห้องสนทนากับฝ่ายซัพพอร์ตได้ทันที"
        ),
        color=discord.Color.green(),
    )
    embed.add_field(
        name="[เคสที่เปิดรับเรื่องช่วยเหลือ]",
        value=(
            "• เคสออเดอร์ที่มีปัญหา: ไม่ได้รับสินค้า, รหัสผ่านไม่ถูกต้อง, ข้อมูลไม่ตรงตามรายการ, เคลมประกันไอดี 24 ชม.\n"
            "• แจ้งปัญหาระบบขัดข้อง: เติมเงินไม่เข้า, สแกนสลิปขัดข้อง, ข้อผิดพลาดบนหน้าเว็บไซต์\n"
            "• ตอบคำถามและซัพพอร์ตทั่วไป: สอบถามข้อมูลการใช้งาน หรือขอความช่วยเหลือจากเจ้าหน้าที่"
        ),
        inline=False,
    )
    embed.add_field(
        name="[ข้อมูลที่ต้องเตรียมส่งในตั๋ว]",
        value=(
            "1. เลขที่คำสั่งซื้อ (Order ID) หรือชื่อผู้ใช้บนเว็บไซต์ (กรณีปัญหาเกี่ยวกับออเดอร์)\n"
            "2. ภาพถ่ายหน้าจอหลักฐาน หรือสลิปการโอนเงินที่พบปัญหา"
        ),
        inline=False,
    )
    embed.set_footer(text="KaiZort Store Support - Ticketing without clutter")
    return embed


class CreateTicketModal(discord.ui.Modal, title="เปิดตั๋วแจ้งเรื่อง (Support Ticket)"):
    def __init__(self, ticket_service: TicketService):
        super().__init__()
        self.ticket_service = ticket_service

        self.subject_input = discord.ui.TextInput(
            label="หัวข้อเรื่องที่ต้องการแจ้ง (Subject)",
            placeholder="เช่น เคลมไอดี / สลิปไม่เข้า / รหัสผ่านไม่ถูกต้อง / สอบถามข้อมูล",
            required=True,
            max_length=100,
        )
        self.order_id_input = discord.ui.TextInput(
            label="เลขที่คำสั่งซื้อ Order ID (ไม่บังคับ)",
            placeholder="เว้นว่างได้หากสอบถามทั่วไป (กรอกเฉพาะเคสออเดอร์ เช่น ORD-12345)",
            required=False,
            max_length=50,
        )
        self.detail_input = discord.ui.TextInput(
            label="รายละเอียดปัญหา หรือ คำถาม (Details)",
            placeholder="ระบุข้อความคำถาม หรือรายละเอียดปัญหาที่ต้องการให้ทีมงานช่วยเหลือ",
            style=discord.TextStyle.paragraph,
            required=True,
            max_length=1000,
        )

        self.add_item(self.subject_input)
        self.add_item(self.order_id_input)
        self.add_item(self.detail_input)

    async def on_submit(self, interaction: discord.Interaction):
        # 1. Immediate deferral upon modal submit
        try:
            await interaction.response.defer(ephemeral=True)
        except Exception as e:
            logger.warning("Failed to defer modal submit interaction: %s", e)

        if not interaction.guild:
            await interaction.followup.send("[ข้อผิดพลาด] คำสั่งนี้สามารถใช้งานได้เฉพาะภายในเซิร์ฟเวอร์เท่านั้น", ephemeral=True)
            return

        guild = interaction.guild
        user = interaction.user
        subject = self.subject_input.value.strip()
        order_id = self.order_id_input.value.strip() or None
        detail = self.detail_input.value.strip()

        logger.info("Create ticket modal submitted by user %s (ID: %s) with subject '%s'", user.name, user.id, subject)

        try:
            # 2. Check for active open ticket
            active = self.ticket_service.get_active_ticket_by_user(
                str(user.id), str(guild.id)
            )
            if active:
                existing_ch = guild.get_channel(int(active["channel_id"]))
                if existing_ch:
                    await interaction.followup.send(
                        f"[แจ้งเตือน] คุณมีตั๋วบริการที่เปิดค้างอยู่แล้วในช่อง: {existing_ch.mention}\nกรุณาใช้ห้องเดิมหรือกดยืนยันปิดตั๋วก่อนเปิดใหม่",
                        ephemeral=True,
                    )
                    return
                else:
                    # Previous channel was deleted manually from Discord, close stale ticket
                    self.ticket_service.close_ticket(
                        active["ticket_id"],
                        closed_by="system",
                        reason="Previous ticket channel was deleted from Discord",
                    )

            # 3. Channel name and category
            num = self.ticket_service.get_next_ticket_number()
            ticket_id = f"ticket-{num:04d}"
            channel_name = f"ticket-{num:04d}"

            target_cat = discord.utils.get(guild.categories, name="CUSTOMER SUPPORT")
            if not target_cat and hasattr(interaction.channel, "category"):
                target_cat = interaction.channel.category

            overwrites = {
                guild.default_role: discord.PermissionOverwrite(view_channel=False),
                user: discord.PermissionOverwrite(
                    view_channel=True,
                    send_messages=True,
                    attach_files=True,
                    embed_links=True,
                    read_message_history=True,
                ),
                guild.me: discord.PermissionOverwrite(
                    view_channel=True,
                    send_messages=True,
                    manage_channels=True,
                    manage_messages=True,
                    attach_files=True,
                ),
            }

            for role in guild.roles:
                if role.permissions.administrator or "admin" in role.name.lower() or "staff" in role.name.lower():
                    overwrites[role] = discord.PermissionOverwrite(
                        view_channel=True,
                        send_messages=True,
                        attach_files=True,
                        read_message_history=True,
                    )

            ticket_ch = await guild.create_text_channel(
                name=channel_name,
                category=target_cat,
                overwrites=overwrites,
                topic=f"Ticket {ticket_id} | Subject: {subject} | Created by: {user.name} ({user.id})",
            )

            self.ticket_service.create_ticket(
                ticket_id=ticket_id,
                channel_id=str(ticket_ch.id),
                guild_id=str(guild.id),
                user_id=str(user.id),
                user_name=user.name,
                category="support",
                subject=subject,
                detail=detail,
                order_id=order_id,
            )

            # Inside the ticket channel: Embed showing the submitted subject and detail!
            embed = discord.Embed(
                title=f"Support Ticket #{num:04d}",
                description=(
                    f"ยินดีต้อนรับคุณ {user.mention} เข้าสู่ห้องติดต่อฝ่ายบริการลูกค้า\n"
                    "เจ้าหน้าที่ฝ่ายซัพพอร์ตได้รับข้อมูลปัญหาของคุณเรียบร้อยแล้ว และจะเข้ามาตรวจสอบโดยเร็วที่สุด"
                ),
                color=discord.Color.green(),
            )
            order_text = f"`{order_id}`" if order_id else "ไม่ได้ระบุ (สอบถามทั่วไป)"
            embed.add_field(name="[หัวข้อเรื่อง]", value=f"`{subject}`", inline=False)
            embed.add_field(name="[เลขที่คำสั่งซื้อ]", value=order_text, inline=True)
            embed.add_field(name="[รายละเอียด / ข้อความ]", value=f"```{detail}```", inline=False)
            embed.add_field(
                name="[คำแนะนำเพิ่มเติม]",
                value="สามารถแนบภาพถ่ายหน้าจอหลักฐาน หรือสลิปการโอนเงินลงในช่องนี้ได้ทันที\nเมื่อดำเนินการแก้ไขเสร็จสิ้น สามารถกดปุ่ม Close ด้านล่างเพื่อปิดตั๋ว",
                inline=False,
            )
            embed.set_footer(text="KaiZort Store Support | กด Close เพื่อปิดตั๋ว")

            ctrl_view = TicketControlView(self.ticket_service)
            await ticket_ch.send(content=f"{user.mention} Welcome!", embed=embed, view=ctrl_view)

            # Audit log in #web-tickets-audit with full subject and detail visible to staff!
            audit_ch = None
            for ch in guild.text_channels:
                if "audit" in ch.name.lower() or "แจ้งปัญหา" in ch.name.lower():
                    audit_ch = ch
                    break

            if audit_ch:
                audit_embed = discord.Embed(
                    title=f"[AUDIT] ตั๋วบริการใหม่: #{num:04d}",
                    description=f"Channel: {ticket_ch.mention}\nผู้แจ้ง: {user.mention} (`{user.name}`)",
                    color=discord.Color.green(),
                )
                audit_embed.add_field(name="หัวข้อเรื่อง", value=f"`{subject}`", inline=False)
                audit_embed.add_field(name="เลขที่คำสั่งซื้อ", value=order_text, inline=True)
                audit_embed.add_field(name="รายละเอียด", value=f"```{detail[:600]}```", inline=False)
                audit_embed.set_footer(text=f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                try:
                    await audit_ch.send(embed=audit_embed)
                except Exception as e:
                    logger.warning("Failed to send audit log: %s", e)

            await interaction.followup.send(
                f"[สำเร็จ] สร้างห้องตั๋วบริการเรียบร้อยแล้ว: {ticket_ch.mention}",
                ephemeral=True,
            )
            logger.info("Successfully created ticket %s in channel #%s for user %s", ticket_id, channel_name, user.name)

        except Exception as e:
            logger.error("Failed to create ticket: %s", e, exc_info=True)
            await interaction.followup.send(f"[ข้อผิดพลาด] ไม่สามารถสร้างห้องตั๋วบริการได้: {e}", ephemeral=True)


class SupportTicketPanelView(discord.ui.View):
    def __init__(self, ticket_service: TicketService):
        super().__init__(timeout=None)
        self.ticket_service = ticket_service

    @discord.ui.button(
        label="Create ticket",
        style=discord.ButtonStyle.secondary,
        custom_id="btn_create_ticket",
    )
    async def create_ticket_button(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        modal = CreateTicketModal(self.ticket_service)
        await interaction.response.send_modal(modal)

    async def on_error(
        self, interaction: discord.Interaction, error: Exception, item: discord.ui.Item
    ) -> None:
        logger.error("Error in SupportTicketPanelView: %s", error, exc_info=True)
        try:
            if interaction.response.is_done():
                await interaction.followup.send(f"[ข้อผิดพลาด] ไม่สามารถดำเนินการได้: {error}", ephemeral=True)
            else:
                await interaction.response.send_message(f"[ข้อผิดพลาด] ไม่สามารถดำเนินการได้: {error}", ephemeral=True)
        except Exception:
            pass


class TicketControlView(discord.ui.View):
    def __init__(self, ticket_service: TicketService):
        super().__init__(timeout=None)
        self.ticket_service = ticket_service

    @discord.ui.button(
        label="Close",
        style=discord.ButtonStyle.secondary,
        custom_id="btn_ticket_close",
    )
    async def close_button(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        confirm_embed = discord.Embed(
            title="Close Ticket",
            description="Are you sure you want to close this ticket?",
            color=discord.Color.red(),
        )
        view = ConfirmCloseView(self.ticket_service)
        await interaction.response.send_message(embed=confirm_embed, view=view)

    @discord.ui.button(
        label="Transcript",
        style=discord.ButtonStyle.secondary,
        custom_id="btn_ticket_transcript",
    )
    async def transcript_button(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        await interaction.response.defer(ephemeral=True)
        ticket_info = self.ticket_service.get_ticket_by_channel(str(interaction.channel_id))
        if not ticket_info:
            ticket_info = {"ticket_id": interaction.channel.name, "subject": "Ticket"}

        messages = [msg async for msg in interaction.channel.history(limit=500, oldest_first=True)]
        transcript_text = TicketService.generate_transcript_text(ticket_info, messages)

        temp_file = os.path.join(tempfile.gettempdir(), f"transcript_{interaction.channel.name}.txt")
        with open(temp_file, "w", encoding="utf-8") as f:
            f.write(transcript_text)

        d_file = discord.File(temp_file, filename=f"transcript_{interaction.channel.name}.txt")
        await interaction.followup.send(
            content=f"Transcript for {interaction.channel.name}:",
            file=d_file,
            ephemeral=True,
        )
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except Exception:
                pass

    async def on_error(
        self, interaction: discord.Interaction, error: Exception, item: discord.ui.Item
    ) -> None:
        logger.error("Error in TicketControlView: %s", error, exc_info=True)
        try:
            if interaction.response.is_done():
                await interaction.followup.send(f"[ข้อผิดพลาด] ไม่สามารถดำเนินการได้: {error}", ephemeral=True)
            else:
                await interaction.response.send_message(f"[ข้อผิดพลาด] ไม่สามารถดำเนินการได้: {error}", ephemeral=True)
        except Exception:
            pass


class ConfirmCloseView(discord.ui.View):
    def __init__(self, ticket_service: TicketService):
        super().__init__(timeout=None)
        self.ticket_service = ticket_service

    async def on_error(
        self, interaction: discord.Interaction, error: Exception, item: discord.ui.Item
    ) -> None:
        logger.error("Error in ConfirmCloseView: %s", error, exc_info=True)
        try:
            if interaction.response.is_done():
                await interaction.followup.send(f"[ข้อผิดพลาด] ไม่สามารถดำเนินการได้: {error}", ephemeral=True)
            else:
                await interaction.response.send_message(f"[ข้อผิดพลาด] ไม่สามารถดำเนินการได้: {error}", ephemeral=True)
        except Exception:
            pass

    @discord.ui.button(
        label="Close",
        style=discord.ButtonStyle.danger,
        custom_id="btn_confirm_close_ticket",
    )
    async def confirm_close_button(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        await interaction.response.defer(ephemeral=False)
        ch = interaction.channel
        guild = interaction.guild
        closer = interaction.user

        ticket_info = self.ticket_service.get_ticket_by_channel(str(ch.id))
        t_id = ticket_info.get("ticket_id") if ticket_info else ch.name

        # 1. Generate transcript
        messages = [msg async for msg in ch.history(limit=500, oldest_first=True)]
        t_data = ticket_info or {"ticket_id": t_id, "subject": "Ticket"}
        transcript_text = TicketService.generate_transcript_text(t_data, messages)

        temp_file = os.path.join(tempfile.gettempdir(), f"transcript_{t_id}.txt")
        with open(temp_file, "w", encoding="utf-8") as f:
            f.write(transcript_text)

        # 2. Send transcript to audit channel
        audit_ch = None
        if guild:
            for c in guild.text_channels:
                if "audit" in c.name.lower() or "แจ้งปัญหา" in c.name.lower():
                    audit_ch = c
                    break

        if audit_ch:
            audit_embed = discord.Embed(
                title=f"[AUDIT] Ticket Closed: {t_id}",
                description=f"Channel: `{ch.name}`\nClosed by: {closer.mention} (`{closer.name}`)",
                color=discord.Color.red(),
            )
            audit_embed.set_footer(text=f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            try:
                d_file = discord.File(temp_file, filename=f"transcript_{t_id}.txt")
                await audit_ch.send(embed=audit_embed, file=d_file)
            except Exception as e:
                logger.warning("Could not send transcript to audit channel: %s", e)

        # 3. Update database
        if ticket_info:
            self.ticket_service.close_ticket(t_id, closed_by=closer.name, reason="Closed by user/staff")

        # 4. Countdown and delete channel
        close_embed = discord.Embed(
            title="Ticket Closed",
            description=f"Ticket closed by {closer.mention}.\nThis channel will be deleted in 5 seconds...",
            color=discord.Color.red(),
        )
        await ch.send(embed=close_embed)

        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except Exception:
                pass

        await asyncio.sleep(5)
        try:
            await ch.delete(reason=f"Ticket closed by {closer.name}")
        except Exception as e:
            logger.error("Failed to delete ticket channel %s: %s", ch.name, e)

    @discord.ui.button(
        label="Cancel",
        style=discord.ButtonStyle.secondary,
        custom_id="btn_cancel_close_ticket",
    )
    async def cancel_close_button(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        await interaction.message.delete()


class KeyValidationBot(discord.Client):
    def __init__(
        self,
        settings: Settings,
        service: KeyService,
        process_service: Optional[ProcessService] = None,
        kaitun_service: Optional[KaitunService] = None,
        ticket_service: Optional[TicketService] = None,
        database: Optional[Database] = None,
    ):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(intents=intents)
        self.settings = settings
        self.service = service
        self.db = database or getattr(service, "database", None) or Database(settings.database_path)
        self.process_service = process_service or ProcessService(
            ProviderClient(), service
        )
        self.roblox_service = RobloxService()
        self.kaitun_service = kaitun_service or KaitunService(self.service.database)
        base_dir = os.path.dirname(os.path.abspath(__file__))
        default_ticket_db = os.path.join(base_dir, "data", "tickets.sqlite3")
        self.ticket_service = ticket_service or TicketService(default_ticket_db)
        self.tree = app_commands.CommandTree(self)
        self.agy_service = AgyService(load_agy_settings())

        self._register_commands()

    async def setup_hook(self):
        # Register persistent views inside the active asyncio event loop
        self.add_view(SupportTicketPanelView(self.ticket_service))
        self.add_view(TicketControlView(self.ticket_service))
        self.add_view(ConfirmCloseView(self.ticket_service))
        self.add_view(ExpenseInteractiveView(self.db))
        logger.info("Persistent views successfully registered in setup_hook with active event loop.")

    def _register_commands(self) -> None:
        async def _execute_get_key_flow(
            interaction: discord.Interaction, ephemeral: bool
        ):
            start_time = time.time()

            # Step 1: Initial Processing
            embed = discord.Embed(
                title="🔄 กำลังประมวลผล (Processing...)",
                description=(
                    "```text\n"
                    "[▓▓░░░░░░░░] 20% กำลังเริ่มประมวลผลคำขอ...\n"
                    "```"
                ),
                color=discord.Color.gold(),
            )
            embed.set_footer(text="กำลังวิเคราะห์และเชื่อมต่อระบบ...")
            await interaction.response.send_message(embed=embed, ephemeral=ephemeral)

            # Step 2: Progress step
            await asyncio.sleep(0.7)
            embed.description = (
                "```text\n"
                "[▓▓▓▓▓▓░░░░] 60% กำลังจัดเตรียมคีย์และบันทึกสถานะลงระบบ...\n"
                "```"
            )
            embed.set_footer(text="กำลังสร้างและตรวจสอบสถานะคีย์...")
            try:
                await interaction.edit_original_response(embed=embed)
            except Exception:
                pass

            # Step 3: Generate key
            await asyncio.sleep(0.7)
            ok, new_key = self.service.generate_key(interaction.user.id)
            elapsed = round(time.time() - start_time, 2)

            # Step 4: Success Result Embed
            embed = discord.Embed(
                title="✅ รับคีย์สำเร็จ (Success)",
                description="คีย์ของคุณได้รับการจัดเตรียมและเปิดใช้งานในระบบเรียบร้อยแล้ว",
                color=discord.Color.green(),
            )
            embed.add_field(
                name="📦 Provider",
                value="`Ouroboros Key System`",
                inline=True,
            )
            embed.add_field(
                name="⏱️ เวลาที่ใช้ (Time Taken)",
                value=f"`{elapsed}s`",
                inline=True,
            )
            embed.add_field(
                name="📌 สถานะ (Status)",
                value="`🟢 พร้อมใช้งาน (Active)`",
                inline=False,
            )
            embed.add_field(
                name="🔑 Key ที่ได้",
                value=f"```{new_key}```",
                inline=False,
            )
            embed.set_footer(text="คลิกปุ่มด้านล่างเพื่อคัดลอกคีย์ได้อย่างรวดเร็ว")

            view = CopyKeyView(new_key)
            await interaction.edit_original_response(embed=embed, view=view)

        # Command: /process link:<str>
        @self.tree.command(
            name="process",
            description="ประมวลผลลิงก์จากระบบที่ได้รับอนุญาต พร้อมแสดง Provider และเวลาที่ใช้",
        )
        @app_commands.describe(
            link="ลิงก์ https:// ที่ต้องการประมวลผล",
            ephemeral="แสดงผลเฉพาะคุณหรือไม่ (ค่าเริ่มต้น: True)",
        )
        @app_commands.checks.cooldown(1, 10.0, key=lambda i: (i.guild_id, i.user.id))
        async def process_cmd(
            interaction: discord.Interaction, link: str, ephemeral: bool = True
        ):
            # Step 1: Initial Processing Embed
            embed = discord.Embed(
                title="🔄 กำลังประมวลผลลิงก์ (Processing...)",
                description=(
                    "```text\n"
                    "[▓▓░░░░░░░░] 20% กำลังตรวจสอบโครงสร้างลิงก์และความปลอดภัย...\n"
                    "```"
                ),
                color=discord.Color.gold(),
            )
            embed.set_footer(text="กำลังเริ่มต้นเชื่อมต่อ Provider...")
            await interaction.response.send_message(embed=embed, ephemeral=ephemeral)

            # Step 2: Progress step
            await asyncio.sleep(0.7)
            embed.description = (
                "```text\n"
                "[▓▓▓▓▓▓░░░░] 60% กำลังติดต่อ Provider และตรวจสอบความถูกต้องของคีย์...\n"
                "```"
            )
            embed.set_footer(text="กำลังประมวลผลข้อมูล...")
            try:
                await interaction.edit_original_response(embed=embed)
            except Exception:
                pass

            # Step 3: Execute process
            result = self.process_service.process(link, interaction.user.id)

            # Step 4: Final Result Embed (Never leak full URL, tokens, or secrets)
            if result.ok:
                embed = discord.Embed(
                    title="✅ ประมวลผลลิงก์สำเร็จ (Success)",
                    description="คีย์จากระบบของคุณได้รับการยืนยันและเปิดใช้งานเรียบร้อยแล้ว",
                    color=discord.Color.green(),
                )
                embed.add_field(
                    name="📦 Provider",
                    value=f"`{result.provider}`",
                    inline=True,
                )
                embed.add_field(
                    name="⏱️ เวลาที่ใช้ (Time Taken)",
                    value=f"`{result.elapsed_seconds}s`",
                    inline=True,
                )
                embed.add_field(
                    name="📌 สถานะ (Status)",
                    value="`🟢 พร้อมใช้งาน (Active)`",
                    inline=False,
                )
                embed.add_field(
                    name="🔑 Key ที่ได้",
                    value=f"```{result.key}```",
                    inline=False,
                )
                embed.set_footer(text="คลิกปุ่มด้านล่างเพื่อคัดลอกคีย์ได้อย่างรวดเร็ว")
                view = CopyKeyView(result.key)
                await interaction.edit_original_response(embed=embed, view=view)
            else:
                embed = discord.Embed(
                    title="❌ การประมวลผลไม่สำเร็จ (Process Failed)",
                    description=f"**สาเหตุ:** {result.message}",
                    color=discord.Color.red(),
                )
                embed.add_field(
                    name="📦 Provider",
                    value=f"`{result.provider}`",
                    inline=True,
                )
                embed.add_field(
                    name="⏱️ เวลาที่ใช้ (Time Taken)",
                    value=f"`{result.elapsed_seconds}s`",
                    inline=True,
                )
                embed.add_field(
                    name="⚠️ รหัสข้อผิดพลาด",
                    value=f"`{result.code}`",
                    inline=False,
                )
                embed.set_footer(text="กรุณาตรวจสอบว่าลิงก์มาจากโฮสต์ที่ได้รับอนุญาต")
                await interaction.edit_original_response(embed=embed, view=None)

        # Command: /getkey (ไม่ต้องกรอกคีย์เลย)
        @self.tree.command(
            name="getkey",
            description="รับคีย์ใหม่ทันทีโดยไม่ต้องกรอกอะไรเลย พร้อมแถบ Processing และปุ่ม Copy Key",
        )
        @app_commands.describe(
            ephemeral="แสดงผลเฉพาะคุณหรือไม่ (ค่าเริ่มต้น: True)",
        )
        @app_commands.checks.cooldown(1, 10.0, key=lambda i: (i.guild_id, i.user.id))
        async def getkey(interaction: discord.Interaction, ephemeral: bool = True):
            await _execute_get_key_flow(interaction, ephemeral)

        # Command: /redeem (รองรับทั้งไม่ใส่คีย์ หรือใส่คีย์/ลิงก์เพื่อตรวจสอบ)
        @self.tree.command(
            name="redeem",
            description="รับคีย์หรือตรวจสอบคีย์ของคุณ (กด Enter เพื่อรับคีย์ได้ทันที)",
        )
        @app_commands.describe(
            key="คีย์หรือลิงก์ของคุณ (เว้นว่างไว้เพื่อรับคีย์ใหม่ทันที)",
            ephemeral="แสดงผลเฉพาะคุณหรือไม่ (ค่าเริ่มต้น: True)",
        )
        @app_commands.checks.cooldown(1, 10.0, key=lambda i: (i.guild_id, i.user.id))
        async def redeem(
            interaction: discord.Interaction,
            key: Optional[str] = None,
            ephemeral: bool = True,
        ):
            # หากผู้ใช้ไม่กรอกคีย์ ให้สร้างและแจกคีย์ใหม่ทันที!
            if not key or not key.strip():
                await _execute_get_key_flow(interaction, ephemeral)
                return

            start_time = time.time()

            # Step 1: Initial Processing Embed
            embed = discord.Embed(
                title="🔄 กำลังประมวลผล (Processing...)",
                description=(
                    "```text\n"
                    "[▓▓░░░░░░░░] 20% เริ่มต้นการประมวลผลคำขอ...\n"
                    "```"
                ),
                color=discord.Color.gold(),
            )
            embed.set_footer(text="กำลังวิเคราะห์และเชื่อมต่อระบบ...")
            await interaction.response.send_message(embed=embed, ephemeral=ephemeral)

            # Step 2: Progress step
            await asyncio.sleep(0.7)
            embed.description = (
                "```text\n"
                "[▓▓▓▓▓▓░░░░] 60% กำลังตรวจสอบรูปแบบและเช็คประวัติในฐานข้อมูล...\n"
                "```"
            )
            embed.set_footer(text="กำลังตรวจสอบสถานะคีย์...")
            try:
                await interaction.edit_original_response(embed=embed)
            except Exception:
                pass

            # Step 3: Execute verification
            await asyncio.sleep(0.7)
            result = self.service.redeem(key, interaction.user.id)
            elapsed = round(time.time() - start_time, 2)

            # Step 4: Final Result Embed
            if result.ok:
                final_key = result.extracted_key or key.strip()
                embed = discord.Embed(
                    title="✅ ดำเนินการสำเร็จ (Processed Successfully)",
                    description="คีย์ของคุณได้รับการยืนยันความถูกต้องและเปิดใช้งานเรียบร้อยแล้ว",
                    color=discord.Color.green(),
                )
                embed.add_field(
                    name="📦 Provider",
                    value="`Ouroboros Key System`",
                    inline=True,
                )
                embed.add_field(
                    name="⏱️ เวลาที่ใช้ (Time Taken)",
                    value=f"`{elapsed}s`",
                    inline=True,
                )
                embed.add_field(
                    name="📌 สถานะ (Status)",
                    value="`🟢 พร้อมใช้งาน (Active)`",
                    inline=False,
                )
                embed.add_field(
                    name="🔑 Key ที่ได้",
                    value=f"```{final_key}```",
                    inline=False,
                )
                embed.set_footer(text="คลิกปุ่มด้านล่างเพื่อคัดลอกคีย์ได้อย่างรวดเร็ว")

                view = CopyKeyView(final_key)
                await interaction.edit_original_response(embed=embed, view=view)
            else:
                embed = discord.Embed(
                    title="❌ การประมวลผลไม่สำเร็จ (Process Failed)",
                    description=f"**สาเหตุ:** {result.message}",
                    color=discord.Color.red(),
                )
                embed.add_field(
                    name="📦 Provider",
                    value="`Ouroboros Key System`",
                    inline=True,
                )
                embed.add_field(
                    name="⏱️ เวลาที่ใช้ (Time Taken)",
                    value=f"`{elapsed}s`",
                    inline=True,
                )
                embed.add_field(
                    name="💡 คำแนะนำ",
                    value=(
                        f"• ตรวจสอบว่าคีย์ขึ้นต้นด้วย `{self.service.prefix}` หรือไม่\n"
                        f"• สามารถพิมพ์ `/getkey` เพื่อรับคีย์ใหม่ได้ทันทีครับ"
                    ),
                    inline=False,
                )
                embed.set_footer(text="หากต้องการความช่วยเหลือเพิ่มเติม สามารถพิมพ์ /ask ได้ครับ")
                await interaction.edit_original_response(embed=embed, view=None)

        # Command: /help
        @self.tree.command(name="help", description="แสดงคำแนะนำวิธีใช้งานและรายการคำสั่งลัดประจำห้อง")
        @app_commands.describe(
            section="เลือกหมวดหมู่ที่ต้องการดู (หากเว้นว่างจะแสดงคำสั่งของห้องปัจจุบันอัตโนมัติ)",
            ephemeral="แสดงผลเฉพาะคุณหรือไม่ (ค่าเริ่มต้น: True)",
        )
        @app_commands.choices(
            section=[
                app_commands.Choice(name="ห้องปัจจุบัน (Current Channel)", value="current"),
                app_commands.Choice(name="คลังไอดีไก่ตัน (#kaitun-id)", value="kaitun"),
                app_commands.Choice(name="พูดคุยและคำสั่งทั่วไป (#general-chat)", value="general"),
                app_commands.Choice(name="แจ้งปัญหาและเคลม (#support-tickets)", value="support"),
                app_commands.Choice(name="รีวิวและเครดิต (#reviews-vouch)", value="vouch"),
                app_commands.Choice(name="ร้านค้าและเว็บไซต์ (#store-website)", value="store"),
                app_commands.Choice(name="ระบบบันทึก Webhook (KAIZORT WEB LOGS)", value="web_logs"),
                app_commands.Choice(name="รวมโครงสร้างทุกห้องทั้งหมด (All Sections)", value="all"),
            ]
        )
        async def help_command(
            interaction: discord.Interaction,
            section: str = "current",
            ephemeral: bool = True,
        ):
            target_sec = section
            ch_name = getattr(interaction.channel, "name", "")
            ch_id = getattr(interaction.channel, "id", 0)
            cat_name = ""
            if hasattr(interaction.channel, "category") and interaction.channel.category:
                cat_name = getattr(interaction.channel.category, "name", "")

            if target_sec == "current":
                target_sec = get_channel_section(ch_name, ch_id, cat_name)

            embed = build_channel_help_embed(target_sec, channel_name=ch_name, user_name=interaction.user.name)
            await interaction.response.send_message(embed=embed, ephemeral=ephemeral)

        # Command: /ask
        @self.tree.command(name="ask", description="พูดคุย สอบถาม หรือขอคำแนะนำจากบอท")
        @app_commands.describe(
            message="ข้อความหรือคำถามที่ต้องการคุยกับบอท",
            ephemeral="ต้องการให้เห็นคำตอบเฉพาะคุณหรือไม่ (ค่าเริ่มต้น: False)",
        )
        @app_commands.checks.cooldown(1, 5.0, key=lambda i: (i.guild_id, i.user.id))
        async def ask_command(
            interaction: discord.Interaction, message: str, ephemeral: bool = False
        ):
            reply = generate_bot_reply(
                message, self.service.prefix, self.service.hex_length
            )
            await interaction.response.send_message(reply, ephemeral=ephemeral)

        # Command: /agy (ส่งคำสั่งทั่วไปแบบอ่านอย่างเดียวให้ Antigravity CLI)
        @self.tree.command(
            name="agy",
            description="สั่งงานทั่วไปแบบอ่านอย่างเดียวผ่าน Antigravity (เฉพาะผู้ที่ได้รับอนุญาต)",
        )
        @app_commands.describe(prompt="คำสั่งหรือคำถามที่ต้องการให้ Antigravity ตอบ")
        @app_commands.checks.cooldown(1, 10.0, key=lambda i: (i.guild_id, i.user.id))
        async def agy_command(interaction: discord.Interaction, prompt: str):
            if not self.agy_service.is_user_allowed(interaction.user.id):
                await interaction.response.send_message(
                    "คุณไม่มีสิทธิ์ใช้คำสั่งนี้", ephemeral=True
                )
                return
            if not self.agy_service.is_channel_allowed(interaction.channel_id):
                await interaction.response.send_message(
                    "คำสั่งนี้ใช้ได้เฉพาะในห้องที่กำหนดเท่านั้น", ephemeral=True
                )
                return

            await interaction.response.defer(ephemeral=True, thinking=True)
            result = await self.agy_service.run(prompt)
            chunks = split_for_discord(result)
            await interaction.followup.send(chunks[0], ephemeral=True)
            for extra in chunks[1:5]:
                await interaction.followup.send(extra, ephemeral=True)

        def _build_status_embed(info: dict) -> discord.Embed:
            is_run = info["is_running"]
            color = discord.Color.green() if is_run else discord.Color.red()
            status_txt = info["status_text"]

            embed = discord.Embed(
                title="🎮 ข้อมูลสถานะการทำงาน (Roblox & Emulator)",
                description=f"สถานะปัจจุบัน: **{status_txt}**",
                color=color,
            )
            embed.add_field(
                name=info["duration_title"],
                value=f"**{info['duration_str']}**",
                inline=True,
            )
            if is_run:
                embed.add_field(
                    name="🕒 เริ่มเปิดเกมเมื่อ",
                    value=f"`{info.get('started_at', 'ไม่ระบุ')}`",
                    inline=True,
                )
            else:
                embed.add_field(
                    name="⚠️ สถานะตัวเกม",
                    value="`ไม่อยู่ใน Roblox (ปิดอยู่)`",
                    inline=True,
                )

            embed.add_field(
                name="⏰ เวลาที่ตรวจเช็ก",
                value=f"`{info['timestamp']}`",
                inline=False,
            )

            if is_run:
                p_lines = [
                    f"• **{p['name']}** (PID: `{p['pid']}`, RAM: `{p['memory']}`, เริ่ม: `{p.get('start_time_str', '-')}`)"
                    for p in info["processes"]
                ]
                embed.add_field(
                    name="⚙️ Process ที่กำลังรันอยู่",
                    value="\n".join(p_lines),
                    inline=False,
                )
            else:
                embed.add_field(
                    name="ℹ️ รายละเอียด",
                    value="❌ **ไม่อยู่ใน Roblox หรือโปรแกรมจำลอง** (ตรวจไม่พบ Process ใดๆ ในเครื่องขณะนี้)",
                    inline=False,
                )

            embed.set_footer(text="Roblox Real-time Uptime Tracker • พร้อมใช้งาน")
            return embed

        # Common handlers for status and screen
        async def _handle_status(interaction: discord.Interaction, ephemeral: bool = False):
            await interaction.response.defer(ephemeral=ephemeral)
            info = self.roblox_service.get_status_info()
            embed = _build_status_embed(info)
            await interaction.followup.send(embed=embed, ephemeral=ephemeral)

        async def _handle_screen(interaction: discord.Interaction, ephemeral: bool = False):
            await interaction.response.defer(ephemeral=ephemeral)
            
            temp_path = os.path.join(tempfile.gettempdir(), f"roblox_screen_{int(time.time()*1000)}.png")
            
            ok, target_desc = self.roblox_service.capture_screen_detailed(temp_path)
            if not ok or not os.path.exists(temp_path):
                await interaction.followup.send(
                    "❌ ไม่สามารถแคปภาพหน้าจอได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
                    ephemeral=ephemeral,
                )
                return

            try:
                d_file = discord.File(temp_path, filename="roblox_screen.png")
                embed = discord.Embed(
                    title="📸 ภาพหน้าจอ (Live Screenshot)",
                    description=f"🎯 **เป้าหมาย:** {target_desc}\nบันทึกเฉพาะแท็บเกม Roblox/MuMu หรือหน้าจอหลัก (Main Screen)",
                    color=discord.Color.blue(),
                )
                embed.set_image(url="attachment://roblox_screen.png")
                embed.set_footer(text=f"แคปเมื่อ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                await interaction.followup.send(embed=embed, file=d_file, ephemeral=ephemeral)
            finally:
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except Exception:
                        pass

        # Command: /status (สั้น)
        @self.tree.command(
            name="status",
            description="ตรวจสอบสถานะการทำงานของ Roblox และโปรแกรมจำลอง",
        )
        @app_commands.describe(ephemeral="แสดงผลเฉพาะคุณหรือไม่ (ค่าเริ่มต้น: False)")
        async def status(interaction: discord.Interaction, ephemeral: bool = False):
            await _handle_status(interaction, ephemeral)

        # Command: /roblox_status
        @self.tree.command(
            name="roblox_status",
            description="ตรวจสอบสถานะการทำงานของ Roblox และโปรแกรมจำลอง",
        )
        @app_commands.describe(ephemeral="แสดงผลเฉพาะคุณหรือไม่ (ค่าเริ่มต้น: False)")
        async def roblox_status(interaction: discord.Interaction, ephemeral: bool = False):
            await _handle_status(interaction, ephemeral)

        # Command: /screen (สั้น)
        @self.tree.command(
            name="screen",
            description="แคปภาพหน้าจอเกม Roblox / คอมพิวเตอร์ส่งมาให้ดูทันที",
        )
        @app_commands.describe(ephemeral="แสดงผลเฉพาะคุณหรือไม่ (ค่าเริ่มต้น: False)")
        @app_commands.checks.cooldown(1, 5.0, key=lambda i: (i.guild_id, i.user.id))
        async def screen(interaction: discord.Interaction, ephemeral: bool = False):
            await _handle_screen(interaction, ephemeral)

        # Command: /reconnect (สั่งเปิด Roblox PC และเข้าแมพทันที)
        @self.tree.command(
            name="reconnect",
            description="สั่งเปิด Roblox PC และเชื่อมต่อไปยังเซิร์ฟเวอร์/แมพทันทีจากระยะไกล",
        )
        @app_commands.describe(
            place_id="Place ID หรือเลขแมพที่ต้องการเข้า (เว้นว่างไว้เพื่อเข้าแมพล่าสุดที่เคยเล่น)",
            ephemeral="แสดงผลเฉพาะคุณหรือไม่ (ค่าเริ่มต้น: False)",
        )
        @app_commands.checks.cooldown(1, 10.0, key=lambda i: (i.guild_id, i.user.id))
        async def reconnect_cmd(
            interaction: discord.Interaction,
            place_id: Optional[str] = None,
            ephemeral: bool = False,
        ):
            from roblox_service import launch_roblox
            await interaction.response.defer(ephemeral=ephemeral)
            ok, msg = launch_roblox(place_id)
            if ok:
                embed = discord.Embed(
                    title="🚀 สั่งการเปิดเกม Roblox เรียบร้อย",
                    description=f"{msg}\nตัวเกมกำลังถูกเปิดขึ้นมาบนคอมพิวเตอร์ของคุณ",
                    color=discord.Color.green(),
                )
                embed.set_footer(text=f"สั่งการโดย {interaction.user.name} • {datetime.now().strftime('%H:%M:%S')}")
                await interaction.followup.send(embed=embed, ephemeral=ephemeral)
            else:
                await interaction.followup.send(f"❌ {msg}", ephemeral=ephemeral)

        # Command: /gen_id (สุ่ม Username + Password สำหรับนำไปสมัครไอดี Roblox)
        @self.tree.command(
            name="gen_id",
            description="สุ่ม Username และ Password ที่ปลอดภัยสำหรับนำไปสมัครไอดี Roblox ด้วยตัวเอง",
        )
        @app_commands.describe(
            prefix="คำขึ้นต้น Username (เช่น kiZortShop)",
            amount="จำนวนชุดข้อมูลที่ต้องการสุ่ม (1 - 20)",
            password_length="ความยาวรหัสผ่าน (8 - 24 ตัวอักษร)",
            ephemeral="แสดงผลเฉพาะคุณหรือไม่ (ค่าเริ่มต้น: False)",
        )
        async def gen_id_cmd(
            interaction: discord.Interaction,
            prefix: str = "kiZortShop",
            amount: int = 5,
            password_length: int = 14,
            ephemeral: bool = False,
        ):
            amount = max(1, min(amount, 20))
            password_length = max(8, min(password_length, 24))
            creds = self.kaitun_service.generate_credentials_batch(
                prefix=prefix, count=amount, password_length=password_length
            )

            lines = [f"{u} | {p}" for u, p in creds]
            codeblock = "```text\n" + "\n".join(lines) + "\n```"

            embed = discord.Embed(
                title="🎲 ชุดข้อมูลสำหรับสมัครไอดี Roblox",
                description=(
                    "💡 **คำแนะนำการใช้งาน:**\n"
                    "1. คัดลอก Username และ Password ด้านล่างไปกรอกสมัครบน Roblox ด้วยตัวเอง\n"
                    "2. เมื่อสมัครเสร็จแล้ว นำข้อมูล `<user>|<pass>|<cookie>` มาเก็บเข้าสต็อกด้วยคำสั่ง `/stock_add`\n"
                    "3. รหัสผ่านแต่ละชุดถูกสุ่มแบบปลอดภัย (Uppercase, Lowercase, Number, Symbol) ไม่ซ้ำกัน"
                ),
                color=discord.Color.teal(),
            )
            embed.add_field(
                name=f"📋 รายการชุดข้อมูล ({len(creds)} ชุด)",
                value=codeblock,
                inline=False,
            )
            embed.set_footer(
                text=f"Prefix: {prefix} • ความยาวรหัสผ่าน: {password_length} ตัวอักษร • ขอโดย {interaction.user.name}"
            )
            await interaction.response.send_message(embed=embed, ephemeral=ephemeral)

        # Command: /stock_add (เพิ่มข้อมูลไอดีเข้าสต็อก)
        @self.tree.command(
            name="stock_add",
            description="เพิ่มข้อมูลไอดีที่สมัครเสร็จแล้วเข้าสู่คลังสต็อก (Stock)",
        )
        @app_commands.describe(
            data="วางข้อมูลไอดีในรูปแบบ username|password หรือ username|password|cookie (แยกบรรทัดได้)",
            ephemeral="แสดงผลเฉพาะคุณหรือไม่ (แนะนำ: True เพื่อความปลอดภัยของข้อมูล)",
        )
        async def stock_add_cmd(
            interaction: discord.Interaction,
            data: str,
            ephemeral: bool = True,
        ):
            await interaction.response.defer(ephemeral=ephemeral)
            res = self.kaitun_service.add_stock_from_text(
                text=data, user_id=interaction.user.id
            )
            stats = self.kaitun_service.get_stock_summary()

            color = discord.Color.green() if res.success_count > 0 else (
                discord.Color.blue() if res.password_updated else discord.Color.orange()
            )
            embed = discord.Embed(
                title="📦 ผลการประมวลผลสต็อก",
                color=color,
            )
            if res.success_count > 0:
                embed.add_field(name="✅ เพิ่มสต็อกสำเร็จ", value=f"`{res.success_count}` บัญชี", inline=True)
            if res.duplicates:
                embed.add_field(
                    name="⚠️ ปฏิเสธรายการซ้ำ",
                    value=f"`{len(res.duplicates)}` บัญชี ({', '.join([f'`{u}`' for u in res.duplicates[:3]])})",
                    inline=True,
                )
            if res.password_updated:
                updated_lines = [f"• `{item['username']}`: ||`{item['new_password']}`||" for item in res.password_updated]
                embed.add_field(
                    name="🔑 เปลี่ยนรหัสผ่านแล้ว",
                    value="\n".join(updated_lines[:5]),
                    inline=False,
                )
            embed.add_field(name="📊 สต็อกคงเหลือพร้อมใช้", value=f"`{stats['available']}` บัญชี", inline=True)

            if res.failed_lines:
                err_preview = "\n".join(res.failed_lines[:5])
                if len(res.failed_lines) > 5:
                    err_preview += f"\n... และอีก {len(res.failed_lines) - 5} รายการ"
                embed.add_field(
                    name="❌ ตัวอย่างรายการที่ไม่ผ่าน",
                    value=f"```text\n{err_preview}\n```",
                    inline=False,
                )

            embed.set_footer(text=f"บันทึกโดย {interaction.user.name} • รวมในคลังทั้งหมด {stats['total']} บัญชี")
            await interaction.followup.send(embed=embed, ephemeral=ephemeral)

        # Command: /stock_check (เช็คจำนวนไอดีในสต็อก)
        @self.tree.command(
            name="stock_check",
            description="ตรวจสอบจำนวนไอดีคงเหลือในคลังสต็อก",
        )
        @app_commands.describe(ephemeral="แสดงผลเฉพาะคุณหรือไม่ (ค่าเริ่มต้น: False)")
        async def stock_check_cmd(interaction: discord.Interaction, ephemeral: bool = False):
            await interaction.response.defer(ephemeral=ephemeral)
            stats = self.kaitun_service.get_stock_summary()
            embed = discord.Embed(
                title="📊 สถานะคลังสต็อกไอดี (Kaitun Stock)",
                color=discord.Color.blue(),
            )
            embed.add_field(name="🟢 พร้อมใช้งาน (Available)", value=f"`{stats['available']}` บัญชี", inline=True)
            embed.add_field(name="🔴 จ่ายแล้ว (Used)", value=f"`{stats['used']}` บัญชี", inline=True)
            embed.add_field(name="📦 ทั้งหมด (Total)", value=f"`{stats['total']}` บัญชี", inline=True)
            embed.set_footer(text=f"ตรวจเช็กโดย {interaction.user.name} • {datetime.now().strftime('%H:%M:%S')}")
            await interaction.followup.send(embed=embed, ephemeral=ephemeral)

        # Command: /stock_list (ดูรายชื่อไอดีในสต็อก)
        @self.tree.command(
            name="stock_list",
            description="แสดงรายชื่อไอดีทั้งหมดในระบบ (รวมพร้อมขาย และขายแล้ว)",
        )
        @app_commands.describe(
            filter="เลือกมุมมอง: ทั้งหมด, เฉพาะพร้อมขาย, หรือเฉพาะที่ขายแล้ว",
            ephemeral="แสดงผลเฉพาะคุณหรือไม่ (ค่าเริ่มต้น: True เพื่อความปลอดภัยของรหัส)",
        )
        @app_commands.choices(
            filter=[
                app_commands.Choice(name="ทั้งหมด (รวมพร้อมขายและขายแล้ว)", value="all"),
                app_commands.Choice(name="เฉพาะพร้อมขาย (Available)", value="unsold"),
                app_commands.Choice(name="เฉพาะขายแล้ว (Sold)", value="sold"),
            ]
        )
        async def stock_list_cmd(
            interaction: discord.Interaction,
            filter: str = "all",
            ephemeral: bool = True,
        ):
            await interaction.response.defer(ephemeral=ephemeral)
            stats = self.kaitun_service.get_stock_summary()
            sale_filter = None if filter == "all" else filter
            accounts = self.kaitun_service.list_accounts(sale_status=sale_filter, limit=50)

            if not accounts:
                await interaction.followup.send("📦 ไม่พบรายการไอดีตามเงื่อนไขที่เลือกในระบบ", ephemeral=ephemeral)
                return

            lines = []
            for i, acc in enumerate(accounts):
                is_sold = acc.get("sale_status") == "sold" or acc.get("status") == "used"
                status_icon = "🔴" if is_sold else "🟢"
                status_label = "ขายแล้ว" if is_sold else "พร้อมขาย"
                pass_str = f" | รหัส: ||`{acc.get('password', '')}`||" if acc.get("password") else ""
                map_str = f" • 🗺️ `{acc['farmed_maps']}`" if acc.get("farmed_maps") else ""
                price_str = f" • 💰 `{acc['price']}`" if acc.get("price") else ""
                lines.append(f"`{i+1}.` {status_icon} **[{status_label}]** **{acc['username']}**{pass_str}{map_str}{price_str}")

            title = "📋 รายการคลังสต็อกทั้งหมด (Stock List: All)" if filter == "all" else (
                "🟢 รายการสต็อกพร้อมขาย (Available)" if filter == "unsold" else "📜 ประวัติไอดีที่ขายแล้ว (Sold)"
            )
            color = discord.Color.blue() if filter == "all" else (
                discord.Color.green() if filter == "unsold" else discord.Color.red()
            )

            embed = discord.Embed(
                title=title,
                description="\n".join(lines[:30]),
                color=color,
            )
            embed.add_field(name="📦 รวมทั้งหมด", value=f"`{stats['total']}` บัญชี", inline=True)
            embed.add_field(name="🟢 พร้อมขาย", value=f"`{stats['available']}` บัญชี", inline=True)
            embed.add_field(name="🔴 ขายแล้ว", value=f"`{stats['sold']}` บัญชี", inline=True)
            embed.set_footer(text=f"แสดง {len(lines)} รายการ • ตรวจสอบโดย {interaction.user.name}")
            await interaction.followup.send(embed=embed, ephemeral=ephemeral)

        # Command: /stock_history (ดูประวัติไอดีที่ขายไปแล้ว)
        @self.tree.command(
            name="stock_history",
            description="ดูประวัติและรายชื่อไอดีที่ขายไปแล้วทั้งหมด (Sold History)",
        )
        @app_commands.describe(ephemeral="แสดงผลเฉพาะคุณหรือไม่ (ค่าเริ่มต้น: True เพื่อความปลอดภัยของรหัส)")
        async def stock_history_cmd(interaction: discord.Interaction, ephemeral: bool = True):
            await interaction.response.defer(ephemeral=ephemeral)
            accounts = self.kaitun_service.list_accounts(sale_status="sold", limit=25)
            if not accounts:
                await interaction.followup.send("📦 ไม่พบประวัติไอดีที่ขายแล้วในระบบ", ephemeral=ephemeral)
                return

            lines = []
            for i, acc in enumerate(accounts):
                pass_str = f" | รหัส: ||`{acc.get('password', '')}`||" if acc.get("password") else ""
                map_str = f" • 🗺️ `{acc['farmed_maps']}`" if acc.get("farmed_maps") else ""
                price_str = f" • 💰 `{acc['price']}`" if acc.get("price") else ""
                lines.append(f"`{i+1}.` 🔴 **{acc['username']}**{pass_str}{map_str}{price_str}")

            embed = discord.Embed(
                title="📜 ประวัติรายการไอดีที่ขายแล้ว (Sold History)",
                description="\n".join(lines),
                color=discord.Color.red(),
            )
            embed.set_footer(text=f"ประวัติทั้งหมด {len(accounts)} รายการ • ตรวจสอบโดย {interaction.user.name}")
            await interaction.followup.send(embed=embed, ephemeral=ephemeral)

        # Command: /stock_dispense (เบิกไอดีออกจากสต็อก)
        @self.tree.command(
            name="stock_dispense",
            description="เบิกไอดีออกจากสต็อกพร้อมตัดสต็อกอัตโนมัติ (ไม่จ่ายซ้ำ)",
        )
        @app_commands.describe(
            amount="จำนวนไอดีที่ต้องการเบิก (1 - 10)",
            ephemeral="แสดงผลเฉพาะคุณหรือไม่ (แนะนำ: True เพื่อความปลอดภัยของรหัส)",
        )
        async def stock_dispense_cmd(
            interaction: discord.Interaction,
            amount: int = 1,
            ephemeral: bool = True,
        ):
            await interaction.response.defer(ephemeral=ephemeral)
            amount = max(1, min(amount, 10))
            accounts = self.kaitun_service.dispense_accounts(count=amount, user_id=interaction.user.id)
            if not accounts:
                await interaction.followup.send(
                    "❌ **สต็อกว่างเปล่า!** ไม่มีไอดีสถานะพร้อมใช้งานในขณะนี้ กรุณาเติมสต็อกด้วย `/stock_add`",
                    ephemeral=ephemeral,
                )
                return

            lines = [acc["raw_line"] for acc in accounts]
            codeblock = "```text\n" + "\n".join(lines) + "\n```"
            stats = self.kaitun_service.get_stock_summary()

            embed = discord.Embed(
                title="🎁 เบิกไอดีจากสต็อกสำเร็จ",
                description=f"ระบบตัดสต็อกจำนวน **{len(accounts)}** บัญชีเรียบร้อยแล้ว",
                color=discord.Color.gold(),
            )
            embed.add_field(
                name="📋 ข้อมูลบัญชีที่ได้รับ",
                value=codeblock,
                inline=False,
            )
            embed.add_field(name="📦 สต็อกคงเหลือ", value=f"`{stats['available']}` บัญชี", inline=True)
            embed.set_footer(text=f"เบิกโดย {interaction.user.name} • ปลอดภัย ข้อมูลไม่ถูกจ่ายซ้ำ")
            await interaction.followup.send(embed=embed, ephemeral=ephemeral)

        # Command: /stock_password (เปลี่ยนรหัสผ่านของไอดีในสต็อก)
        @self.tree.command(
            name="stock_password",
            description="เปลี่ยนรหัสผ่านของไอดีในคลังสต็อก",
        )
        @app_commands.describe(
            username="ชื่อไอดีที่ต้องการเปลี่ยนรหัสผ่าน",
            new_password="รหัสผ่านใหม่",
            ephemeral="ซ่อนข้อความเพื่อความปลอดภัยหรือไม่ (แนะนำ: True)",
        )
        async def stock_password_cmd(
            interaction: discord.Interaction,
            username: str,
            new_password: str,
            ephemeral: bool = True,
        ):
            await interaction.response.defer(ephemeral=ephemeral)
            acc = self.kaitun_service.get_account(username.strip())
            if not acc:
                await interaction.followup.send(
                    f"❌ ไม่พบไอดี `{username}` ในระบบ",
                    ephemeral=ephemeral,
                )
                return

            ok = self.kaitun_service.update_account(
                username=username.strip(),
                password=new_password.strip(),
            )
            if ok:
                embed = discord.Embed(
                    title="🔑 เปลี่ยนรหัสผ่านเรียบร้อย",
                    description=f"ระบบอัปเดตรหัสผ่านของไอดี **{username.strip()}** เรียบร้อยแล้ว",
                    color=discord.Color.blue(),
                )
                embed.add_field(name="👤 บัญชี", value=f"`{username.strip()}`", inline=True)
                embed.add_field(name="🔑 รหัสผ่านใหม่", value=f"||`{new_password.strip()}`||", inline=True)
                embed.set_footer(text=f"เปลี่ยนรหัสผ่านโดย {interaction.user.name}")
                await interaction.followup.send(embed=embed, ephemeral=ephemeral)
            else:
                await interaction.followup.send(
                    f"❌ ไม่สามารถเปลี่ยนรหัสผ่านของไอดี `{username}` ได้",
                    ephemeral=ephemeral,
                )

        # Command: /stock_remove (นำไอดีออกจากสต็อก)
        @self.tree.command(
            name="stock_remove",
            description="นำไอดีออกจากคลังสต็อก (ลบออกจากระบบ Supabase)",
        )
        @app_commands.describe(
            username="ชื่อไอดี Roblox ที่ต้องการนำออก",
        )
        async def stock_remove_cmd(
            interaction: discord.Interaction,
            username: str,
        ):
            await interaction.response.defer(ephemeral=True)
            target_u = username.strip()
            acc = self.kaitun_service.get_account(target_u)
            if not acc:
                await interaction.followup.send(
                    f"❌ ไม่พบไอดี `{target_u}` ในคลังสต็อก",
                    ephemeral=True,
                )
                return

            ok = self.kaitun_service.delete_account(target_u)
            if ok:
                embed = discord.Embed(
                    title=f"🗑️ นำไอดีออกจากสต็อกสำเร็จ: {acc['username']}",
                    description=f"ระบบได้ลบไอดี `{acc['username']}` ออกจากสต็อกเรียบร้อยแล้ว",
                    color=discord.Color.red(),
                )
                embed.add_field(name="👤 ชื่อไอดี (Username)", value=f"`{acc['username']}`", inline=True)
                embed.add_field(name="📦 รหัสอ้างอิง", value=f"`{acc.get('serial_code') or acc.get('id', '-')}`", inline=True)
                embed.set_footer(text=f"นำออกโดย {interaction.user.name} • ซิงค์ Supabase เรียบร้อย")
                await interaction.followup.send(embed=embed)
            else:
                await interaction.followup.send(
                    f"❌ ไม่สามารถนำไอดี `{target_u}` ออกจากระบบได้",
                    ephemeral=True,
                )

        # Command: /stock_update (เปิดฟอร์ม Modal Tab สำหรับกรอกและอัปเดตข้อมูลไอดี)
        @self.tree.command(
            name="stock_update",
            description="เปิดฟอร์ม (Modal Tab Form) เพื่อกรอกและอัปเดตข้อมูลไอดี",
        )
        @app_commands.describe(
            username="ชื่อไอดีที่ต้องการอัปเดต (เว้นว่างไว้เพื่อไปกรอกในฟอร์มได้)",
        )
        async def stock_update_cmd(
            interaction: discord.Interaction,
            username: Optional[str] = None,
        ):
            prefill = None
            if username:
                prefill = self.kaitun_service.get_account(username.strip())
                if not prefill:
                    prefill = {"username": username.strip()}

            modal = StockUpdateModal(self.kaitun_service, prefill_account=prefill)
            await interaction.response.send_modal(modal)

        # Command: /stock_info (ดูรายละเอียดของไอดี)
        @self.tree.command(
            name="stock_info",
            description="ตรวจสอบรายละเอียดเฉพาะของไอดี (แมพที่ฟาร์ม, รายละเอียดของ, สถานะการขาย)",
        )
        @app_commands.describe(
            username="ชื่อไอดี (Username) ที่ต้องการตรวจสอบ",
            ephemeral="แสดงผลเฉพาะคุณหรือไม่ (ค่าเริ่มต้น: False)",
        )
        async def stock_info_cmd(
            interaction: discord.Interaction,
            username: str,
            ephemeral: bool = False,
        ):
            await interaction.response.defer(ephemeral=ephemeral)
            acc = self.kaitun_service.get_account(username)
            if not acc:
                await interaction.followup.send(
                    f"❌ ไม่พบไอดี `{username}` ในระบบ",
                    ephemeral=ephemeral,
                )
                return

            embed = discord.Embed(
                title=f"👤 ข้อมูลและรายละเอียดไอดี: {acc['username']}",
                color=discord.Color.red() if acc["sale_status"] == "sold" else discord.Color.blue(),
            )
            embed.add_field(name="👤 ชื่อไอดี (Username)", value=f"`{acc['username']}`", inline=True)
            embed.add_field(
                name="🔑 รหัสผ่าน (Password)",
                value=f"||`{acc['password']}`|| *(คลิกเพื่อดู)*",
                inline=True,
            )
            embed.add_field(
                name="🏷️ สถานะการขาย",
                value="🔴 **ขายแล้ว (Sold)**" if acc["sale_status"] == "sold" else "🟢 **ยังไม่ขาย (Unsold)**",
                inline=True,
            )
            embed.add_field(
                name="📦 สถานะคลัง",
                value="🟢 พร้อมใช้งาน (`available`)" if acc["status"] == "available" else "🔴 ตัดจ่ายแล้ว (`used`)",
                inline=True,
            )
            if acc.get("price"):
                embed.add_field(name="💰 ราคา", value=f"`{acc['price']}`", inline=True)
            embed.add_field(
                name="🗺️ แมพที่ฟาร์ม",
                value=f"`{acc.get('farmed_maps') or 'ยังไม่ได้ระบุ'}`",
                inline=False,
            )
            embed.add_field(
                name="📝 รายละเอียดที่เคยอัปเดต",
                value=f"```{acc.get('details') or 'ยังไม่ได้ระบุ'}```",
                inline=False,
            )
            embed.set_footer(text=f"เพิ่มเมื่อ: {acc.get('added_at', '')[:16].replace('T', ' ')}")
            await interaction.followup.send(embed=embed, ephemeral=ephemeral)

        # Command to auto-provision Discord notification channels and save Webhooks to Supabase
        @self.tree.command(
            name="setup_web_channels",
            description="สร้างหมวดหมู่ห้องและระบบ Webhook แจ้งเตือนทุกฟังก์ชันของเว็บไซต์เข้าสู่ Discord",
        )
        @app_commands.default_permissions(administrator=True)
        async def setup_web_channels_command(interaction: discord.Interaction):
            if not interaction.guild:
                await interaction.response.send_message("❌ คำสั่งนี้ต้องรันภายใน Discord Server (Guild)", ephemeral=True)
                return

            await interaction.response.defer(ephemeral=False)
            guild = interaction.guild

            # 1. Define channels to provision
            channel_specs = [
                {"key": "kaitun_sync", "name": "kaitun-id", "topic": "จัดการคลังไอดีไก่ตัน ซิงค์สต๊อกกับเว็บไซต์ 2 ทาง", "desc": "ห้องสต๊อกไก่ตัน"},
                {"key": "orders", "name": "web-orders", "topic": "แจ้งเตือนคำสั่งซื้อและการส่งมอบสินค้าจากเว็บไซต์", "desc": "แจ้งเตือนคำสั่งซื้อ"},
                {"key": "topups", "name": "web-topups", "topic": "แจ้งเตือนคำขอเติมเงินและตรวจสอบสลิป", "desc": "แจ้งเตือนการเติมเงิน"},
                {"key": "stocks", "name": "web-stock-logs", "topic": "แจ้งเตือนการนำเข้าและแก้ไขสต๊อกสินค้า", "desc": "แจ้งเตือนสต๊อก"},
                {"key": "catalog", "name": "web-catalog", "topic": "แจ้งเตือนการเพิ่มและปรับปรุงหมวดหมู่/สินค้า/แบนเนอร์", "desc": "แจ้งเตือนแคตตาล็อก"},
                {"key": "members", "name": "web-members", "topic": "แจ้งเตือนการสมัครสมาชิก สิทธิ์ และรีวิวสินค้า", "desc": "แจ้งเตือนสมาชิก"},
                {"key": "tickets_audit", "name": "web-tickets-audit", "topic": "แจ้งเตือนตั๋วปัญหา/เคลมไอดี และบันทึกความปลอดภัย", "desc": "แจ้งเตือนเคลมและความปลอดภัย"},
            ]

            category_name = "KAIZORT WEB LOGS"
            category = discord.utils.get(guild.categories, name=category_name)
            if not category:
                category = await guild.create_category(category_name)

            created_channels = []
            webhook_configs = []

            for spec in channel_specs:
                ch = discord.utils.get(guild.text_channels, name=spec["name"])
                if not ch:
                    ch = await guild.create_text_channel(spec["name"], category=category, topic=spec["topic"])

                # Check or create webhook
                existing_whs = await ch.webhooks()
                target_wh = None
                for wh in existing_whs:
                    if wh.name and "KaiZort" in wh.name:
                        target_wh = wh
                        break
                if not target_wh:
                    target_wh = await ch.create_webhook(name=f"KaiZort {spec['name']}")

                created_channels.append(ch.mention)
                webhook_configs.append({
                    "channelKey": spec["key"],
                    "channelName": f"#{ch.name}",
                    "channelId": str(ch.id),
                    "webhookUrl": target_wh.url,
                    "description": spec["desc"],
                    "isActive": True,
                })

            # Save Webhook URLs into Supabase WebhookChannelConfig table
            from database import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
            saved_count = 0
            headers = {
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=representation",
            }
            for cfg in webhook_configs:
                try:
                    payload = {
                        "channelKey": cfg["channelKey"],
                        "channelName": cfg["channelName"],
                        "channelId": cfg["channelId"],
                        "webhookUrl": cfg["webhookUrl"],
                        "description": cfg["description"],
                        "isActive": True,
                    }
                    res = requests.post(
                        f"{SUPABASE_URL}/rest/v1/WebhookChannelConfig?on_conflict=channelKey",
                        headers=headers,
                        data=json.dumps(payload),
                        timeout=5
                    )
                    if res.status_code in (200, 201):
                        saved_count += 1
                except Exception as e:
                    logger.error("Failed to save webhook config to Supabase: %s", e)

            embed = discord.Embed(
                title="[สำเร็จ] ติดตั้งระบบ Discord Webhook สำหรับเว็บไซต์เรียบร้อย",
                description=f"ระบบได้สร้าง/ตรวจสอบหมวดหมู่ **`[{category_name}]`** และเชื่อมต่อ Webhook เข้ากับฐานข้อมูล Supabase เรียบร้อยแล้ว",
                color=discord.Color.green(),
            )
            embed.add_field(name="[ห้องที่เชื่อมต่อทั้งหมด]", value="\n".join(created_channels), inline=False)
            embed.add_field(name="[สถานะ Supabase Webhook]", value=f"บันทึกสำเร็จ `{saved_count}/{len(webhook_configs)}` ช่องทาง", inline=True)
            embed.set_footer(text=f"ติดตั้งโดย {interaction.user.name} | KaiZort System")
            await interaction.followup.send(embed=embed)

        # Command to post channel-specific guide cards to each channel in the guild
        @self.tree.command(
            name="post_channel_guides",
            description="โพสต์การ์ดคู่มือและคำสั่งลัดประจำห้องลงในทุกช่องทางของเซิร์ฟเวอร์",
        )
        @app_commands.default_permissions(administrator=True)
        async def post_channel_guides_command(interaction: discord.Interaction):
            if not interaction.guild:
                await interaction.response.send_message("[ข้อผิดพลาด] คำสั่งนี้ต้องรันภายใน Discord Server", ephemeral=True)
                return

            await interaction.response.defer(ephemeral=True)
            guild = interaction.guild
            posted_channels = []

            for ch in guild.text_channels:
                cat_name = getattr(ch.category, "name", "") if ch.category else ""
                sec = get_channel_section(ch.name, ch.id, cat_name)
                embed = build_channel_help_embed(sec, channel_name=ch.name, user_name=interaction.user.name)
                try:
                    await ch.send(embed=embed)
                    posted_channels.append(ch.mention)
                    await asyncio.sleep(0.5)
                except Exception as e:
                    logger.warning("Could not post guide in #%s: %s", ch.name, e)

            result_embed = discord.Embed(
                title="[สำเร็จ] โพสต์การ์ดคู่มือและคำสั่งลัดเรียบร้อย",
                description=f"ระบบได้ส่งการ์ดคู่มือประจำห้องไปยัง {len(posted_channels)} ช่องทางเรียบร้อยแล้ว",
                color=discord.Color.green(),
            )
            result_embed.add_field(name="[ห้องที่ดำเนินการสำเร็จ]", value="\n".join(posted_channels) if posted_channels else "ไม่มี", inline=False)
            await interaction.followup.send(embed=result_embed, ephemeral=True)

        # Command: /accounting
        @self.tree.command(
            name="accounting",
            description="สรุปบัญชีการเงิน: ยอดขาย ต้นทุน กำไรสุทธิ และมูลค่าสต็อกคงเหลือ",
        )
        async def accounting_cmd(interaction: discord.Interaction):
            if not interaction.response.is_done():
                try:
                    await interaction.response.defer(ephemeral=False)
                except Exception:
                    pass
            embed = build_accounting_embed(self.db)
            if interaction.response.is_done():
                await interaction.followup.send(embed=embed)
            else:
                await interaction.response.send_message(embed=embed)

        # Command: /expense (Interactive Modal Form with Dropdown)
        @self.tree.command(
            name="expense",
            description="เปิดฟอร์มบันทึกค่าใช้จ่ายร้าน (มีเมนู Dropdown เลือกหมวดหมู่เหมือนบนเว็บ)",
        )
        @app_commands.describe(
            category="เลือกหมวดหมู่เพื่อเปิดฟอร์มกรอกทันที (เว้นว่างไว้เพื่อเปิดเมนูดร็อปดาวน์)",
        )
        @app_commands.choices(
            category=[
                app_commands.Choice(name="📜 ค่าสคริปต์ฟาร์ม (SCRIPT)", value="SCRIPT"),
                app_commands.Choice(name="💻 ค่า VPS / Cloud (VPS)", value="VPS"),
                app_commands.Choice(name="⚡ ค่าไฟ / ฮาร์ดแวร์ (ELECTRICITY)", value="ELECTRICITY"),
                app_commands.Choice(name="🤖 ค่าโฮสต์บอท (BOT_HOST)", value="BOT_HOST"),
                app_commands.Choice(name="📦 รายจ่ายอื่นๆ (OTHER)", value="OTHER"),
            ]
        )
        async def expense_cmd(
            interaction: discord.Interaction,
            category: Optional[app_commands.Choice[str]] = None,
        ):
            if category:
                modal = ExpenseModal(db=self.db, category=category.value)
                await interaction.response.send_modal(modal)
                return

            embed = discord.Embed(
                title="💸 บันทึกค่าใช้จ่ายร้าน (Store Operating Expenses)",
                description=(
                    "เลือกหมวดหมู่ค่าใช้จ่ายจากเมนู **Dropdown** ด้านล่างเพื่อเปิดแบบฟอร์มกรอกข้อมูล:\n\n"
                    "• 📜 **ค่าสคริปต์ฟาร์ม** (`SCRIPT`)\n"
                    "• 💻 **ค่า VPS / เซิร์ฟเวอร์** (`VPS`)\n"
                    "• ⚡ **ค่าไฟ / ฮาร์ดแวร์** (`ELECTRICITY`)\n"
                    "• 🤖 **ค่าโฮสต์บอท Discord** (`BOT_HOST`)\n"
                    "• 📦 **รายจ่ายอื่นๆ** (`OTHER`)\n\n"
                    "*(ข้อมูลจะถูกนำไปหักลบจากกำไรสุทธิบนหน้าเว็บ /admin/expense ทันที)*"
                ),
                color=discord.Color.gold(),
            )
            embed.set_footer(text="ระบบบัญชีร้าน KaiZort • Real-Time Sync")
            view = ExpenseInteractiveView(db=self.db)
            await interaction.response.send_message(embed=embed, view=view, ephemeral=True)

        # Command: /expense_add
        @self.tree.command(
            name="expense_add",
            description="บันทึกค่าใช้จ่ายร้าน (เช่น ค่าสคริปต์, ค่า VPS, ค่าไฟ) เพื่อหักลบกำไร",
        )
        @app_commands.describe(
            title="ชื่อรายการค่าใช้จ่าย (เช่น ค่าสคริปต์รายเดือน, ค่า VPS, ค่าไฟ)",
            amount="จำนวนเงิน (บาท)",
            category="หมวดหมู่ค่าใช้จ่าย",
            note="หมายเหตุเพิ่มเติม (ถ้ามี)",
        )
        @app_commands.choices(
            category=[
                app_commands.Choice(name="📜 ค่าสคริปต์ฟาร์ม (SCRIPT)", value="SCRIPT"),
                app_commands.Choice(name="💻 ค่า VPS / Cloud (VPS)", value="VPS"),
                app_commands.Choice(name="⚡ ค่าไฟ / ฮาร์ดแวร์ (ELECTRICITY)", value="ELECTRICITY"),
                app_commands.Choice(name="🤖 ค่าโฮสต์บอท (BOT_HOST)", value="BOT_HOST"),
                app_commands.Choice(name="📦 รายจ่ายอื่นๆ (OTHER)", value="OTHER"),
            ]
        )
        async def expense_add_cmd(
            interaction: discord.Interaction,
            title: str,
            amount: float,
            category: Optional[app_commands.Choice[str]] = None,
            note: Optional[str] = None,
        ):
            await interaction.response.defer(ephemeral=False)
            cat_val = category.value if category else "OTHER"
            exp = self.db.add_expense(title=title, amount=amount, category=cat_val, note=note)
            if not exp:
                await interaction.followup.send("❌ เกิดข้อผิดพลาด ไม่สามารถบันทึกค่าใช้จ่ายได้", ephemeral=True)
                return

            embed = discord.Embed(
                title=f"💸 บันทึกค่าใช้จ่ายร้านสำเร็จ: {title}",
                description=f"บันทึกข้อมูลเข้าสู่ฐานข้อมูลและหักลบจากกำไรสุทธิบนหน้าเว็บเรียบร้อยแล้ว",
                color=discord.Color.gold(),
            )
            embed.add_field(name="💰 จำนวนเงิน", value=f"**฿{amount:,.2f}**", inline=True)
            embed.add_field(name="🏷️ หมวดหมู่", value=f"`{cat_val}`", inline=True)
            if note:
                embed.add_field(name="📝 หมายเหตุ", value=f"`{note}`", inline=False)
            embed.set_footer(text=f"บันทึกโดย {interaction.user.name} • ซิงค์กับระบบบัญชีเว็บทันที")
            await interaction.followup.send(embed=embed)

        # Command: /income (บันทึกรายได้จากการขายไอเทม/ผลปีศาจ/บริการ)
        @self.tree.command(
            name="income",
            description="บันทึกรายได้จากการขายไอเทม, ผลปีศาจ, บริการ หรือเงินในเกม เพื่อเพิ่มกำไรสุทธิ",
        )
        @app_commands.describe(
            title="ชื่อสินค้า/ไอเทม/บริการ (เช่น ผลโมจิตื่น, ดาบคู่, Tap Simulator Reborn)",
            amount="ราคาขาย (บาท)",
            cost="ต้นทุนสินค้า (บาท, เว้นว่างได้หากไม่มีต้นทุน)",
            note="หมายเหตุเพิ่มเติม (ถ้ามี)",
        )
        async def income_cmd(
            interaction: discord.Interaction,
            title: str,
            amount: float,
            cost: float = 0.0,
            note: Optional[str] = None,
        ):
            await interaction.response.defer(ephemeral=False)
            res = self.db.add_item_sale(title=title, amount=amount, cost=cost, note=note, user_id=interaction.user.id)
            if not res:
                await interaction.followup.send("❌ เกิดข้อผิดพลาด ไม่สามารถบันทึกรายได้ได้", ephemeral=True)
                return

            profit = float(amount) - float(cost)
            embed = discord.Embed(
                title=f"🎉 บันทึกรายได้สำเร็จ: {title}",
                description="บันทึกรายได้เข้าระบบบัญชีร้าน และคำนวณเข้าสู่กำไรสุทธิเรียบร้อยแล้ว",
                color=discord.Color.green(),
            )
            embed.add_field(name="📦 รายการ", value=f"**{title}**", inline=True)
            embed.add_field(name="💰 ราคาขาย (รายได้)", value=f"**฿{amount:,.2f}**", inline=True)
            if cost > 0:
                embed.add_field(name="📦 ต้นทุน", value=f"฿{cost:,.2f}", inline=True)
                embed.add_field(name="📈 กำไรสุทธิจากรายการนี้", value=f"**฿{profit:,.2f}**", inline=True)
            if note:
                embed.add_field(name="📝 หมายเหตุ", value=f"```{note}```", inline=False)
            embed.set_footer(text=f"บันทึกโดย {interaction.user.name} • ซิงค์กับระบบบัญชีและ #web-orders ทันที")
            await interaction.followup.send(embed=embed)

        @self.tree.command(
            name="sale_item",
            description="บันทึกการขายไอเทมหรือบริการ (Alias ของ /income)",
        )
        @app_commands.describe(
            title="ชื่อสินค้า/ไอเทม/บริการ",
            amount="ราคาขาย (บาท)",
            cost="ต้นทุน (บาท)",
            note="หมายเหตุ",
        )
        async def sale_item_cmd(
            interaction: discord.Interaction,
            title: str,
            amount: float,
            cost: float = 0.0,
            note: Optional[str] = None,
        ):
            await income_cmd(interaction, title, amount, cost, note)

        # Command: /expense_list & /expens_list
        async def _send_expense_list_response(interaction: discord.Interaction):
            if not interaction.response.is_done():
                try:
                    await interaction.response.defer(ephemeral=False)
                except Exception:
                    pass

            embed = build_expense_list_embed(self.db, limit=15)
            if not embed:
                msg = "📦 ยังไม่มีรายการค่าใช้จ่ายร้านในระบบ (พิมพ์ `จ่าย <รายการ> <จำนวน>` หรือใช้ `/expense` เพื่อบันทึก)"
                if interaction.response.is_done():
                    await interaction.followup.send(msg)
                else:
                    await interaction.response.send_message(msg)
                return

            if interaction.response.is_done():
                await interaction.followup.send(embed=embed)
            else:
                await interaction.response.send_message(embed=embed)

        @self.tree.command(
            name="expense_list",
            description="แสดงรายการค่าใช้จ่ายร้านล่าสุดและยอดรวมทั้งหมด",
        )
        async def expense_list_cmd(interaction: discord.Interaction):
            await _send_expense_list_response(interaction)

        @self.tree.command(
            name="expens_list",
            description="แสดงรายการค่าใช้จ่ายร้านล่าสุดและยอดรวมทั้งหมด (Alias)",
        )
        async def expens_list_alias_cmd(interaction: discord.Interaction):
            await _send_expense_list_response(interaction)

        # Command: /ticket_panel (Admin only)
        @self.tree.command(
            name="ticket_panel",
            description="ส่งพาเนลเปิดตั๋วบริการลูกค้า (Support Ticket Panel) ลงในห้อง",
        )
        @app_commands.default_permissions(administrator=True)
        async def ticket_panel_cmd(interaction: discord.Interaction):
            if not interaction.guild:
                await interaction.response.send_message("[ข้อผิดพลาด] คำสั่งนี้ต้องรันในเซิร์ฟเวอร์", ephemeral=True)
                return

            embed = build_ticket_panel_embed()
            view = SupportTicketPanelView(self.ticket_service)
            await interaction.channel.send(embed=embed, view=view)
            await interaction.response.send_message("[สำเร็จ] ติดตั้งพาเนลเปิดตั๋วบริการเรียบร้อย", ephemeral=True)

        # Command: /close (Close ticket channel)
        @self.tree.command(
            name="close",
            description="ปิดตั๋วบริการปัจจุบันและบันทึกประวัติการสนทนา",
        )
        @app_commands.describe(reason="สาเหตุในการปิดตั๋ว (เว้นว่างได้)")
        async def close_cmd(interaction: discord.Interaction, reason: Optional[str] = None):
            ticket_info = self.ticket_service.get_ticket_by_channel(str(interaction.channel_id))
            ch_name = getattr(interaction.channel, "name", "")
            if not ticket_info and not any(p in ch_name for p in ["ticket-", "claim-", "order-"]):
                await interaction.response.send_message(
                    "[ข้อผิดพลาด] คำสั่งนี้สามารถใช้ได้เฉพาะภายในห้องตั๋วบริการเท่านั้น",
                    ephemeral=True,
                )
                return

            confirm_embed = discord.Embed(
                title="Close Ticket",
                description="Are you sure you want to close this ticket?",
                color=discord.Color.red(),
            )
            view = ConfirmCloseView(self.ticket_service)
            await interaction.response.send_message(embed=confirm_embed, view=view)

        # Error handler
        @self.tree.error
        async def on_app_command_error(
            interaction: discord.Interaction, error: app_commands.AppCommandError
        ):
            if isinstance(error, app_commands.CommandOnCooldown):
                retry_after = round(error.retry_after, 1)
                msg = f"[รอสักครู่] คุณทำรายการเร็วเกินไป กรุณารออีก {retry_after} วินาที"
                try:
                    if interaction.response.is_done():
                        await interaction.followup.send(msg, ephemeral=True)
                    else:
                        await interaction.response.send_message(msg, ephemeral=True)
                except Exception:
                    pass
            else:
                logger.error("App command error [%s]: %s", type(error).__name__, error, exc_info=True)
                msg = "[ข้อผิดพลาด] เกิดข้อผิดพลาดในการประมวลผลคำสั่ง"
                try:
                    if interaction.response.is_done():
                        await interaction.followup.send(msg, ephemeral=True)
                    else:
                        await interaction.response.send_message(msg, ephemeral=True)
                except discord.errors.NotFound:
                    logger.warning("Interaction expired before response could be sent (Discord 3-second timeout).")
                except Exception as send_err:
                    logger.warning("Failed to deliver error response: %s", send_err)

    async def on_message(self, message: discord.Message):
        # Ignore own messages
        if message.author == self.user:
            return

        channel_name = getattr(message.channel, "name", "").lower()
        channel_id = getattr(message.channel, "id", 0)
        category_name = ""
        if hasattr(message.channel, "category") and message.channel.category:
            category_name = getattr(message.channel.category, "name", "")

        raw_msg = message.content.strip()
        norm_msg = raw_msg.replace("\u0e40\u0e40", "\u0e41")
        lower_msg = norm_msg.lower()

        # 1. Global Help Trigger in ANY channel
        help_words = ["help", "!help", "-help", "/help", "วิธีใช้", "คำสั่ง", "คำสั่งลัด", "คู่มือ", "shortcuts", "cmd", "commands"]
        if lower_msg in help_words:
            sec = get_channel_section(channel_name, channel_id, category_name)
            embed = build_channel_help_embed(sec, channel_name=channel_name, user_name=message.author.name)
            await message.reply(embed=embed)
            return

        # 2. Channel shortcuts for #support-tickets
        if (any(k in channel_name for k in ["ticket", "claim", "support", "เคลม", "ปัญหา"]) or channel_id in (1561760734554226688, 1561760772063895552)) and not lower_msg.startswith("/"):
            if any(w in lower_msg for w in ["claim", "เคลม", "แจ้งเคลม", "ticket", "เปิดตั๋ว", "ติดต่อแอดมิน"]):
                embed = build_ticket_panel_embed()
                view = SupportTicketPanelView(self.ticket_service)
                await message.reply(embed=embed, view=view)
                return

        # 2.1 Shortcuts inside opened ticket channels
        if any(p in channel_name for p in ["ticket-", "claim-", "order-"]) and not lower_msg.startswith("/"):
            if lower_msg in ["close", "ปิด", "ปิดตั๋ว", "จบงาน"]:
                ctrl_view = TicketControlView(self.ticket_service)
                prompt_embed = discord.Embed(
                    title="[ยืนยันการปิดตั๋ว]",
                    description="ต้องการปิดตั๋วและบันทึกประวัติการสนทนานี้ใช่หรือไม่ กรุณากดปุ่มด้านล่าง",
                    color=discord.Color.red(),
                )
                await message.reply(embed=prompt_embed, view=ctrl_view)
                return

        # 3. Channel shortcuts for #reviews-vouch
        if (any(k in channel_name for k in ["vouch", "review", "รีวิว", "เครดิต"]) or channel_id == 1561760727155478659) and not lower_msg.startswith("/"):
            if any(w in lower_msg for w in ["vouch", "review", "รีวิว", "เครดิต"]):
                embed = build_channel_help_embed("vouch", channel_name=channel_name, user_name=message.author.name)
                await message.reply(embed=embed)
                return

        # 4. Channel shortcuts for #store-website
        if (any(k in channel_name for k in ["store", "website", "เว็บ", "ร้าน"]) or channel_id == 1561760711539953721) and not lower_msg.startswith("/"):
            if any(w in lower_msg for w in ["web", "เว็บ", "store", "ร้าน", "pay", "จ่ายเงิน", "เติมเงิน", "catalog", "สินค้า"]):
                embed = build_channel_help_embed("store", channel_name=channel_name, user_name=message.author.name)
                await message.reply(embed=embed)
                return

        # 5. Channel shortcuts for #general-chat
        if ("general" in channel_name or channel_id == 1561760717051265034) and not lower_msg.startswith("/"):
            if lower_msg in ["status", "สถานะ"]:
                info = self.roblox_service.get_status_info()
                is_run = info["is_running"]
                color = discord.Color.green() if is_run else discord.Color.red()
                status_txt = info["status_text"]

                embed = discord.Embed(
                    title="[สถานะ] ข้อมูลสถานะการทำงาน (Roblox & Emulator)",
                    description=f"สถานะปัจจุบัน: **{status_txt}**",
                    color=color,
                )
                embed.add_field(name=info["duration_title"], value=f"**{info['duration_str']}**", inline=True)
                if is_run:
                    embed.add_field(name="เริ่มเปิดเกมเมื่อ", value=f"`{info.get('started_at', 'ไม่ระบุ')}`", inline=True)
                else:
                    embed.add_field(name="สถานะตัวเกม", value="`ไม่อยู่ใน Roblox (ปิดอยู่)`", inline=True)
                embed.add_field(name="เวลาที่ตรวจเช็ก", value=f"`{info['timestamp']}`", inline=False)
                if is_run:
                    p_lines = [f"• `{p['name']}` (PID: `{p['pid']}`, RAM: `{p['memory']}`)" for p in info["processes"]]
                    embed.add_field(name="Process ที่กำลังรันอยู่", value="\n".join(p_lines), inline=False)
                else:
                    embed.add_field(name="รายละเอียด", value="ตรวจไม่พบ Process ใดๆ ของเกมในเครื่องขณะนี้", inline=False)
                embed.set_footer(text="Roblox Real-time Tracker")
                await message.reply(embed=embed)
                return

            if lower_msg in ["screen", "จอ", "แคป"]:
                temp_path = os.path.join(tempfile.gettempdir(), f"roblox_screen_{int(time.time()*1000)}.png")
                ok, target_desc = self.roblox_service.capture_screen_detailed(temp_path)
                if ok and os.path.exists(temp_path):
                    try:
                        d_file = discord.File(temp_path, filename="screen.png")
                        embed = discord.Embed(
                            title="[ภาพหน้าจอ] Live Screenshot",
                            description=f"เป้าหมาย: {target_desc}\nบันทึกเฉพาะแท็บเกม Roblox/MuMu หรือหน้าจอหลัก",
                            color=discord.Color.blue(),
                        )
                        embed.set_image(url="attachment://screen.png")
                        embed.set_footer(text=f"แคปเมื่อ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                        await message.reply(embed=embed, file=d_file)
                    finally:
                        if os.path.exists(temp_path):
                            try:
                                os.remove(temp_path)
                            except Exception:
                                pass
                    return
                else:
                    await message.reply("[ข้อผิดพลาด] ไม่สามารถแคปภาพหน้าจอได้ในขณะนี้")
                    return

            if lower_msg in ["reconnect", "เข้าเกม", "เปิดเกม"]:
                from roblox_service import launch_roblox
                ok, msg = launch_roblox()
                if ok:
                    embed = discord.Embed(
                        title="[สำเร็จ] สั่งการเปิดเกม Roblox เรียบร้อย",
                        description=f"{msg}\nตัวเกมกำลังถูกเปิดขึ้นมาบนคอมพิวเตอร์ของคุณ",
                        color=discord.Color.green(),
                    )
                    embed.set_footer(text=f"สั่งการโดย {message.author.name} | {datetime.now().strftime('%H:%M:%S')}")
                    await message.reply(embed=embed)
                else:
                    await message.reply(f"[ข้อผิดพลาด] {msg}")
                return

            if lower_msg in ["getkey", "ขอคีย์", "คีย์", "key"]:
                embed = discord.Embed(
                    title="[รับคีย์] วิธีรับ Access Key ประจำวัน",
                    description=(
                        "1. ใช้คำสั่ง `/getkey` ในช่องนี้ แล้วกด Enter ทันที\n"
                        "2. ระบบจะประมวลผลและสร้างคีย์ให้คุณโดยอัตโนมัติ\n"
                        "3. สามารถคลิกปุ่มคัดลอกคีย์เพื่อนำไปใช้งานได้ทันที"
                    ),
                    color=discord.Color.gold(),
                )
                await message.reply(embed=embed)
                return

        # 6. Special handler for #kaitun-id channel
        if "kaitun" in channel_name or channel_id == 1561017098094772264:

            # 1.5 Expense Quick Text Trigger
            if lower_msg in [
                "รายจ่าย", "ค่าใช้จ่าย", "expense", "expenses",
                "expense_list", "expens_list", "/expense_list", "/expens_list",
                "เช็ครายจ่าย", "ดูรายจ่าย", "list expense", "list_expense",
            ]:
                expenses = self.db.list_expenses(limit=15)
                if not expenses:
                    await message.reply("📦 ยังไม่มีรายการค่าใช้จ่ายร้านในระบบ (พิมพ์ `จ่าย <รายการ> <จำนวนเงิน>` เพื่อบันทึก)")
                    return
                total = sum(float(e.get("amount") or 0.0) for e in expenses)
                lines = []
                for i, e in enumerate(expenses[:12]):
                    cat_k = e.get("category", "OTHER")
                    cat_info = EXPENSE_CAT_MAP.get(cat_k, {"label": cat_k, "emoji": "📦"})
                    lines.append(f"`{i+1}.` **{e['title']}** — ฿{float(e['amount']):,.2f} ({cat_info['emoji']} `{cat_info['label']}`)")
                embed = discord.Embed(
                    title=f"💸 รายการค่าใช้จ่ายร้านล่าสุด ({len(expenses)} รายการ)",
                    description="\n".join(lines),
                    color=discord.Color.gold(),
                )
                embed.add_field(name="⚡ ยอดรวมค่าใช้จ่าย", value=f"**฿{total:,.2f}**", inline=False)
                embed.set_footer(text="พิมพ์ 'จ่าย <รายการ> <จำนวน>' เพื่อเพิ่มค่าใช้จ่าย หรือดูที่เว็บ /admin/expense")
                await message.reply(embed=embed)
                return

            if lower_msg.startswith("จ่าย ") or lower_msg.startswith("รายจ่าย ") or lower_msg.startswith("expense "):
                parts = raw_msg.split()
                if len(parts) >= 3:
                    amount = None
                    import re
                    nums = re.findall(r"[\d.]+", parts[-1])
                    if nums:
                        try:
                            amount = float(nums[0])
                            title = " ".join(parts[1:-1])
                        except Exception:
                            amount = None

                    if not amount:
                        m = re.search(r"(\d+(?:\.\d+)?)\s*(?:บาท|thb)?$", raw_msg, re.IGNORECASE)
                        if m:
                            amount = float(m.group(1))
                            title = raw_msg[len(parts[0]):m.start()].strip()

                    if amount and title:
                        cat = "OTHER"
                        lt = title.lower()
                        if any(k in lt for k in ["สคริปต์", "script"]):
                            cat = "SCRIPT"
                        elif any(k in lt for k in ["vps", "server", "เซิร์ฟ", "cloud"]):
                            cat = "VPS"
                        elif any(k in lt for k in ["ไฟ", "เน็ต", "คอม", "ฮาร์ดแวร์"]):
                            cat = "ELECTRICITY"
                        elif any(k in lt for k in ["บอท", "bot"]):
                            cat = "BOT_HOST"

                        exp = self.db.add_expense(title=title, amount=amount, category=cat)
                        if exp:
                            embed = discord.Embed(
                                title=f"💸 บันทึกค่าใช้จ่ายร้านเรียบร้อย: {title}",
                                description=f"บันทึกยอดเงินเข้าสู่ฐานข้อมูล และหักลบจากกำไรสุทธิบนหน้าเว็บอัตโนมัติ",
                                color=discord.Color.gold(),
                            )
                            embed.add_field(name="💰 จำนวนเงิน", value=f"**฿{amount:,.2f}**", inline=True)
                            embed.add_field(name="🏷️ หมวดหมู่", value=f"`{cat}`", inline=True)
                            embed.set_footer(text=f"บันทึกโดย {message.author.name} • ซิงค์กับหน้าเว็บ /admin/expense ทันที")
                            await message.reply(embed=embed)
                            return

            # Fast Chat Shortcut for Recording Item Sales: ขาย <ชื่อไอเทม> <ราคา> หรือ รายได้ <ชื่อ> <ราคา>
            if (lower_msg.startswith("ขาย ") or lower_msg.startswith("ได้ ") or lower_msg.startswith("รายได้ ")) and not lower_msg.startswith("/"):
                # Avoid conflict with "ขายแล้ว" (sold account trigger)
                if not any(lower_msg.startswith(p) for p in ["ขายแล้ว", "ขายเเล้ว", "ขายละ", "ขายล่ะ"]):
                    parts = raw_msg.split()
                    if len(parts) >= 2:
                        import re
                        m = re.search(r"(\d+(?:\.\d+)?)\s*(?:บาท|thb)?$", raw_msg, re.IGNORECASE)
                        if m:
                            amount = float(m.group(1))
                            title = raw_msg[len(parts[0]):m.start()].strip()
                            if title and amount > 0:
                                res = self.db.add_item_sale(title=title, amount=amount, user_id=message.author.id)
                                if res:
                                    embed = discord.Embed(
                                        title=f"🎉 บันทึกการขายไอเทมเรียบร้อย: {title}",
                                        description="บันทึกยอดขายเข้าระบบบัญชีร้าน และเพิ่มกำไรสุทธิเรียบร้อยแล้ว",
                                        color=discord.Color.green(),
                                    )
                                    embed.add_field(name="📦 รายการ", value=f"**{title}**", inline=True)
                                    embed.add_field(name="💰 ราคาขาย (รายได้)", value=f"**฿{amount:,.2f}**", inline=True)
                                    embed.set_footer(text=f"บันทึกโดย {message.author.name} • ซิงค์กับระบบบัญชีและ #web-orders ทันที")
                                    await message.reply(embed=embed)
                                    return

            # Fast Chat Shortcut for Viewing Accounting / Financial Summary: บัญชี, สรุปบัญชี, กำไร, accounting, รายรับรายจ่าย
            if lower_msg in [
                "accounting",
                "finance",
                "บัญชี",
                "สรุปบัญชี",
                "ดูบัญชี",
                "กำไร",
                "กำไรสุทธิ",
                "ยอดขาย",
                "สรุปยอด",
                "รายรับรายจ่าย",
                "รายรับ",
            ]:
                acc_embed = build_accounting_embed(self.db)
                await message.reply(embed=acc_embed)
                return

            # Fast Chat Shortcut for Viewing Expense List: รายจ่าย, ค่าใช้จ่าย, ดูรายจ่าย, expense list
            if lower_msg in [
                "รายจ่าย",
                "ค่าใช้จ่าย",
                "ดูรายจ่าย",
                "ดูค่าใช้จ่าย",
                "expense list",
                "expenses",
                "รายการรายจ่าย",
            ]:
                exp_embed = build_expense_list_embed(self.db)
                if exp_embed:
                    await message.reply(embed=exp_embed)
                else:
                    await message.reply("📦 ยังไม่มีรายการค่าใช้จ่ายร้านในระบบ (พิมพ์ `จ่าย <รายการ> <จำนวน>` หรือใช้ `/expense` เพื่อบันทึก)")
                return

            # 2. Gen command
            if lower_msg.startswith("gen ") or lower_msg == "gen" or lower_msg.startswith("สุ่ม"):
                parts = raw_msg.split()
                prefix = "kiZortShop"
                amount = 5
                if len(parts) == 2:
                    if parts[1].isdigit():
                        amount = int(parts[1])
                    else:
                        prefix = parts[1]
                elif len(parts) >= 3:
                    prefix = parts[1]
                    if parts[2].isdigit():
                        amount = int(parts[2])

                amount = max(1, min(amount, 20))
                creds = self.kaitun_service.generate_credentials_batch(prefix=prefix, count=amount)
                lines = [f"{u} | {p}" for u, p in creds]
                codeblock = "```text\n" + "\n".join(lines) + "\n```"

                embed = discord.Embed(
                    title="🎲 ชุดข้อมูลสำหรับสมัครไอดี Roblox",
                    description=(
                        "💡 นำ Username และ Password ไปสมัครบน Roblox ด้วยตัวเอง\n"
                        "เมื่อสมัครเสร็จ นำข้อมูล `<user>|<pass>|<cookie>` มาวางในห้องนี้เพื่อเก็บเข้าสต็อกได้ทันทีครับ"
                    ),
                    color=discord.Color.teal(),
                )
                embed.add_field(name=f"📋 รายการชุดข้อมูล ({len(creds)} ชุด)", value=codeblock, inline=False)
                embed.set_footer(text=f"Prefix: {prefix} • ขอโดย {message.author.name}")
                await message.reply(embed=embed)
                return

            # 3. Stock Check & List (with filtering)
            if lower_msg in [
                "stock list",
                "list stock",
                "รายการสต็อก",
                "stock",
                "สต็อก",
                "เช็คสต็อก",
                "stock check",
                "stock sold",
                "ขายแล้ว",
                "ประวัติ",
                "ประวัติขาย",
                "ประวัติการขาย",
                "ดูประวัติ",
                "history",
                "sold list",
                "list sold",
                "stock unsold",
                "ยังไม่ขาย",
            ]:
                filter_status = None
                title_suffix = "ทั้งหมดในระบบ (Stock List: All)"
                if any(w in lower_msg for w in ["sold", "ขายแล้ว", "ประวัติ", "history"]):
                    filter_status = "sold"
                    title_suffix = "ประวัติรายการไอดีที่ขายแล้ว (Sold History)"
                elif "unsold" in lower_msg or "ยังไม่ขาย" in lower_msg:
                    filter_status = "unsold"
                    title_suffix = "เฉพาะที่พร้อมขาย (Available)"

                stats = self.kaitun_service.get_stock_summary()
                accounts = self.kaitun_service.list_accounts(sale_status=filter_status, limit=50)
                if not accounts:
                    await message.reply(f"📦 ไม่พบรายการไอดีสถานะ `{title_suffix}` ในระบบ")
                    return

                lines = []
                for i, acc in enumerate(accounts):
                    is_sold = acc.get("sale_status") == "sold" or acc.get("status") == "used"
                    status_icon = "🔴" if is_sold else "🟢"
                    status_label = "ขายแล้ว" if is_sold else "พร้อมขาย"
                    pass_str = f" | รหัส: ||`{acc.get('password', '')}`||" if acc.get("password") else ""
                    map_str = f" • 🗺️ `{acc['farmed_maps']}`" if acc.get("farmed_maps") else ""
                    price_str = f" • 💰 `{acc['price']}`" if acc.get("price") else ""
                    det_preview = f"\n  └ 📝 *{acc['details'][:35]}...*" if acc.get("details") else ""
                    lines.append(f"`{i+1}.` {status_icon} **[{status_label}]** **{acc['username']}**{pass_str}{map_str}{price_str}{det_preview}")

                embed = discord.Embed(
                    title=f"📋 รายการคลังสต็อก: {title_suffix}",
                    description="\n".join(lines[:30]),
                    color=discord.Color.blue() if filter_status is None else (
                        discord.Color.red() if filter_status == "sold" else discord.Color.green()
                    ),
                )
                embed.add_field(name="📦 รวมทั้งหมด", value=f"`{stats['total']}` บัญชี", inline=True)
                embed.add_field(name="🟢 พร้อมขาย", value=f"`{stats['available']}` บัญชี", inline=True)
                embed.add_field(name="🔴 ขายแล้ว", value=f"`{stats['sold']}` บัญชี", inline=True)
                embed.set_footer(text=f"แสดง {len(lines)} รายการ • พิมพ์ 'info <ชื่อไอดี>' เพื่อดูข้อมูลเชิงลึก")
                await message.reply(embed=embed)
                return

            # 3.5. Remove Account Command: นำออก <username> / ลบ <username> / del <username> / remove <username>
            if (
                lower_msg.startswith("นำออก ")
                or lower_msg.startswith("ลบ ")
                or lower_msg.startswith("del ")
                or lower_msg.startswith("remove ")
                or lower_msg.startswith("rm ")
            ):
                parts = raw_msg.split()
                if len(parts) >= 2:
                    target_u = parts[1].strip()
                    acc = self.kaitun_service.get_account(target_u)
                    if not acc:
                        await message.reply(f"❌ ไม่พบไอดี `{target_u}` ในคลังสต็อก")
                        return

                    ok = self.kaitun_service.delete_account(target_u)
                    if ok:
                        embed = discord.Embed(
                            title=f"🗑️ นำไอดีออกจากสต็อกสำเร็จ: {acc['username']}",
                            description=f"ระบบได้นำไอดี `{acc['username']}` ออกจากคลังสต็อกเรียบร้อยแล้ว",
                            color=discord.Color.red(),
                        )
                        embed.add_field(name="👤 ชื่อไอดี (Username)", value=f"`{acc['username']}`", inline=True)
                        embed.add_field(
                            name="📦 รหัสอ้างอิง",
                            value=f"`{acc.get('serial_code') or acc.get('id', '-')}`",
                            inline=True,
                        )
                        embed.set_footer(text=f"ดำเนินการโดย {message.author.name} • ซิงค์ Supabase ทันที")
                        await message.reply(embed=embed)
                    else:
                        await message.reply(f"❌ เกิดข้อผิดพลาด ไม่สามารถนำไอดี `{target_u}` ออกจากระบบได้")
                    return

            # 4. Account Info: info <username> / ดู <username> / เช็ค <username> / id <username>
            if (
                lower_msg.startswith("info ")
                or lower_msg.startswith("เช็ค ")
                or lower_msg.startswith("ดู ")
                or lower_msg.startswith("id ")
            ):
                parts = raw_msg.split()
                if len(parts) >= 2:
                    target_u = parts[1]
                    acc = self.kaitun_service.get_account(target_u)
                    if not acc:
                        await message.reply(f"❌ ไม่พบไอดี `{target_u}` ในระบบ")
                        return

                    embed = discord.Embed(
                        title=f"👤 ข้อมูลและรายละเอียดไอดี: {acc['username']}",
                        color=discord.Color.red() if acc["sale_status"] == "sold" else discord.Color.blue(),
                    )
                    embed.add_field(name="👤 ชื่อไอดี (Username)", value=f"`{acc['username']}`", inline=True)
                    embed.add_field(
                        name="🔑 รหัสผ่าน (Password)",
                        value=f"||`{acc['password']}`|| *(คลิกเพื่อดู)*",
                        inline=True,
                    )
                    embed.add_field(
                        name="🏷️ สถานะการขาย",
                        value="🔴 **ขายแล้ว (Sold)**" if acc["sale_status"] == "sold" else "🟢 **ยังไม่ขาย (Unsold)**",
                        inline=True,
                    )
                    embed.add_field(
                        name="📦 สถานะคลัง",
                        value="🟢 พร้อมใช้งาน (`available`)" if acc["status"] == "available" else "🔴 ตัดจ่ายแล้ว (`used`)",
                        inline=True,
                    )
                    if acc.get("price"):
                        embed.add_field(name="💰 ราคา", value=f"`{acc['price']}`", inline=True)
                    embed.add_field(
                        name="🗺️ แมพที่ฟาร์ม",
                        value=f"`{acc.get('farmed_maps') or 'ยังไม่ได้ระบุ'}`",
                        inline=False,
                    )
                    embed.add_field(
                        name="📝 รายละเอียดที่เคยอัปเดต",
                        value=f"```{acc.get('details') or 'ยังไม่ได้ระบุ'}```",
                        inline=False,
                    )
                    embed.set_footer(text=f"เพิ่มเมื่อ: {acc.get('added_at', '')[:16].replace('T', ' ')}")
                    await message.reply(embed=embed)
                    return

            # 4.5 Direct Sale Status Shortcuts: ขายแล้ว <username> / ขาย <username> / พร้อมขาย <username>
            if lower_msg.startswith("ขายแล้ว ") or lower_msg.startswith("ขาย "):
                parts = raw_msg.split()
                if len(parts) >= 2:
                    target_u = parts[1].strip()
                    acc = self.kaitun_service.get_account(target_u)
                    if not acc:
                        await message.reply(f"❌ ไม่พบไอดี `{target_u}` ในคลังสต็อก")
                        return

                    self.kaitun_service.update_account(
                        username=target_u,
                        sale_status="sold",
                    )
                    acc_updated = self.kaitun_service.get_account(target_u) or acc
                    embed = discord.Embed(
                        title=f"✅ ปรับสถานะไอดีเป็น 'ขายแล้ว' เรียบร้อย: {target_u}",
                        description=f"อัปเดตสถานะในระบบและซิงค์ข้อมูลกับหน้าเว็บเรียบร้อยแล้ว",
                        color=discord.Color.red(),
                    )
                    embed.add_field(name="🏷️ สถานะ", value="🔴 **ขายแล้ว (Sold)**", inline=True)
                    if acc_updated.get("price"):
                        embed.add_field(name="💰 ราคาขาย", value=f"`{acc_updated['price']}`", inline=True)
                    if acc_updated.get("farmed_maps"):
                        embed.add_field(name="🗺️ แมพ", value=f"`{acc_updated['farmed_maps']}`", inline=True)
                    embed.set_footer(text=f"อัปเดตโดย {message.author.name} • ซิงค์กับหน้าเว็บทันที")
                    await message.reply(embed=embed)
                    return

            if lower_msg.startswith("พร้อมขาย ") or lower_msg.startswith("ยังไม่ขาย "):
                parts = raw_msg.split()
                if len(parts) >= 2:
                    target_u = parts[1].strip()
                    acc = self.kaitun_service.get_account(target_u)
                    if not acc:
                        await message.reply(f"❌ ไม่พบไอดี `{target_u}` ในคลังสต็อก")
                        return

                    self.kaitun_service.update_account(
                        username=target_u,
                        sale_status="unsold",
                    )
                    embed = discord.Embed(
                        title=f"✅ ปรับสถานะไอดีกลับเป็น 'พร้อมขาย' เรียบร้อย: {target_u}",
                        description=f"อัปเดตสถานะในระบบและซิงค์ข้อมูลกับหน้าเว็บเรียบร้อยแล้ว",
                        color=discord.Color.green(),
                    )
                    embed.add_field(name="🏷️ สถานะ", value="🟢 **พร้อมขาย (Available)**", inline=True)
                    embed.set_footer(text=f"อัปเดตโดย {message.author.name} • ซิงค์กับหน้าเว็บทันที")
                    await message.reply(embed=embed)
                    return

            # 5. Account Update: update <username> [ข้อมูล...]
            if lower_msg.startswith("update ") or lower_msg.startswith("อัพเดท ") or lower_msg.startswith("แก้ "):
                parts = raw_msg.split(maxsplit=2)
                if len(parts) >= 2:
                    target_u = parts[1]
                    content_after = parts[2] if len(parts) > 2 else ""

                    acc = self.kaitun_service.get_account(target_u)
                    if not acc:
                        await message.reply(f"❌ ไม่พบไอดี `{target_u}` ในระบบ")
                        return

                    # Parse fields
                    sale_status = None
                    if "ขายแล้ว" in content_after or "sold:yes" in content_after.lower() or content_after.lower().strip() == "sold":
                        sale_status = "sold"
                    elif "ยังไม่ขาย" in content_after or "sold:no" in content_after.lower() or "unsold" in content_after.lower():
                        sale_status = "unsold"

                    maps = None
                    details = None
                    price = None
                    new_pass = None

                    import re
                    m_pass = re.search(r"(?:รหัสผ่าน|รหัส|pass|password)\s*[:=]\s*([^,;\n]+)", content_after, re.IGNORECASE)
                    if m_pass:
                        new_pass = m_pass.group(1).strip()

                    m_map = re.search(r"(?:แมพ|map|maps)\s*[:=]\s*([^,;\n]+)", content_after, re.IGNORECASE)
                    if m_map:
                        maps = m_map.group(1).strip()

                    m_det = re.search(r"(?:ข้อมูล|รายละเอียด|detail|details|ของ)\s*[:=]\s*([^,;\n]+)", content_after, re.IGNORECASE)
                    if m_det:
                        details = m_det.group(1).strip()

                    m_price = re.search(r"(?:ราคา|price)\s*[:=]\s*([^,;\n]+)", content_after, re.IGNORECASE)
                    if m_price:
                        price = m_price.group(1).strip()

                    # Fallback text if no key prefix is used
                    if not maps and not details and not price and not new_pass and content_after:
                        cleaned_c = content_after.replace("ขายแล้ว", "").replace("ยังไม่ขาย", "").strip()
                        if cleaned_c:
                            details = cleaned_c

                    ok = self.kaitun_service.update_account(
                        username=target_u,
                        password=new_pass,
                        farmed_maps=maps,
                        details=details,
                        sale_status=sale_status,
                        price=price,
                    )
                    if not ok:
                        await message.reply(
                            "⚠️ ไม่พบการเปลี่ยนแปลงข้อมูล (ตัวอย่าง: `update kaimhaShozp_baa รหัส: NewPass123` หรือ `update kaimhaShozp_baa ขายแล้ว` หรือ `update kaimhaShozp_baa แมพ: Blox Fruits ข้อมูล: เวลตัน ผลโมจิ`)"
                        )
                        return

                    acc_updated = self.kaitun_service.get_account(target_u)
                    embed = discord.Embed(
                        title=f"✅ อัปเดตข้อมูลสำเร็จ: {target_u}",
                        color=discord.Color.green(),
                    )
                    if new_pass:
                        embed.add_field(
                            name="🔑 เปลี่ยนรหัสผ่านแล้ว (Password Updated)",
                            value=f"รหัสผ่านใหม่: ||`{acc_updated['password']}`||",
                            inline=False,
                        )
                    embed.add_field(
                        name="🏷️ สถานะการขาย",
                        value="🔴 **ขายแล้ว (Sold)**" if acc_updated["sale_status"] == "sold" else "🟢 **ยังไม่ขาย (Unsold)**",
                        inline=True,
                    )
                    if acc_updated.get("price"):
                        embed.add_field(name="💰 ราคา", value=f"`{acc_updated['price']}`", inline=True)
                    embed.add_field(name="🗺️ แมพที่ฟาร์ม", value=f"`{acc_updated.get('farmed_maps') or 'ยังไม่ได้ระบุ'}`", inline=False)
                    embed.add_field(name="📝 รายละเอียดของในไอดี", value=f"```{acc_updated.get('details') or 'ยังไม่ได้ระบุ'}```", inline=False)
                    await message.reply(embed=embed)
                    return

            if lower_msg in ["stock", "เช็คสต็อก", "สต็อก", "stock check"]:
                stats = self.kaitun_service.get_stock_summary()
                embed = discord.Embed(
                    title="📊 สถานะคลังสต็อกไอดี (Kaitun Stock)",
                    color=discord.Color.blue(),
                )
                embed.add_field(name="🟢 พร้อมใช้งาน", value=f"`{stats['available']}` บัญชี", inline=True)
                embed.add_field(name="🔴 จ่ายแล้ว", value=f"`{stats['used']}` บัญชี", inline=True)
                embed.add_field(name="📦 ทั้งหมด", value=f"`{stats['total']}` บัญชี", inline=True)
                embed.set_footer(text=f"ตรวจเช็กโดย {message.author.name}")
                await message.reply(embed=embed)
                return

            # 4. Stock Dispense (Get / เบิก)
            if lower_msg.startswith("get ") or lower_msg.startswith("เบิก ") or lower_msg.startswith("ดึง "):
                parts = raw_msg.split()
                amount = 1
                if len(parts) >= 2 and parts[1].isdigit():
                    amount = int(parts[1])
                amount = max(1, min(amount, 10))
                accounts = self.kaitun_service.dispense_accounts(count=amount, user_id=message.author.id)
                if not accounts:
                    await message.reply("❌ **สต็อกว่างเปล่า!** ไม่มีไอดีสถานะพร้อมใช้งานในขณะนี้")
                    return

                lines = [acc["raw_line"] for acc in accounts]
                codeblock = "```text\n" + "\n".join(lines) + "\n```"
                stats = self.kaitun_service.get_stock_summary()

                embed = discord.Embed(
                    title="🎁 เบิกไอดีจากสต็อกสำเร็จ",
                    description=f"ระบบตัดสต็อกจำนวน **{len(accounts)}** บัญชีเรียบร้อยแล้ว",
                    color=discord.Color.gold(),
                )
                embed.add_field(name="📋 ข้อมูลบัญชีที่ได้รับ", value=codeblock, inline=False)
                embed.add_field(name="📦 สต็อกคงเหลือ", value=f"`{stats['available']}` บัญชี", inline=True)
                embed.set_footer(text=f"เบิกโดย {message.author.name}")
                await message.reply(embed=embed)
                return

            # 5. Smart Sold Detection (ขายแล้ว / ขายเเล้ว / ออกแล้ว / sold)
            sold_keywords = ["ขายแล้ว", "ออกแล้ว", "หมดแล้ว", "soldout", "sold out", "sold", "ขายละ", "ขายล่ะ"]
            is_sold_message = any(kw in lower_msg for kw in sold_keywords)
            if is_sold_message and not lower_msg.startswith("/"):
                # Clean text to extract Roblox username
                clean_for_user = lower_msg
                for kw in sold_keywords:
                    clean_for_user = clean_for_user.replace(kw, " ")

                # Find valid Roblox username: 3-20 characters of alphanumeric or underscore
                m_user = re.search(r"\b[a-zA-Z0-9_]{3,20}\b", clean_for_user)
                if m_user:
                    target_u = m_user.group(0)
                    acc = self.kaitun_service.get_account(target_u)
                    if acc:
                        self.kaitun_service.update_account(username=target_u, sale_status="sold")
                    else:
                        # Account didn't exist yet: extract password if provided with pipe
                        password = "Unknown"
                        if "|" in raw_msg:
                            parts = raw_msg.split("|")
                            if len(parts) > 1:
                                p_cand = parts[1].strip()
                                for kw in sold_keywords:
                                    p_cand = p_cand.replace(kw, "").replace("\u0e40\u0e40", "\u0e41").strip()
                                if p_cand:
                                    password = p_cand
                        with self.kaitun_service.database.connection:
                            self.kaitun_service.database.connection.execute(
                                """
                                INSERT INTO kaitun_accounts (username, password, raw_line, status, sale_status, added_by, added_at)
                                VALUES (?, ?, ?, 'used', 'sold', ?, datetime('now'))
                                """,
                                (target_u, password, f"{target_u} | {password}", message.author.id),
                            )

                    stats = self.kaitun_service.get_stock_summary()
                    embed = discord.Embed(
                        title=f"🔴 อัปเดตสถานะสำเร็จ: {target_u}",
                        description="บันทึกสถานะเป็น **ขายแล้ว (Sold)** และตัดออกจากคลังสต็อกเรียบร้อย",
                        color=discord.Color.red(),
                    )
                    embed.add_field(name="🏷️ สถานะ", value="🔴 ขายแล้ว (Sold)", inline=True)
                    embed.add_field(name="📦 สต็อกคงเหลือพร้อมใช้", value=f"`{stats['available']}` บัญชี", inline=True)
                    embed.set_footer(text=f"อัปเดตโดย {message.author.name}")
                    await message.reply(embed=embed)
                    return

            # 6. Auto-detect pasting accounts into #kaitun-id
            if "|" in raw_msg and not lower_msg.startswith("/"):

                res = self.kaitun_service.add_stock_from_text(
                    text=raw_msg, user_id=message.author.id
                )
                stats = self.kaitun_service.get_stock_summary()

                # If passwords were changed, announce clearly
                if res.password_updated:
                    pass_embed = discord.Embed(
                        title="🔑 เปลี่ยนรหัสผ่านเรียบร้อย",
                        color=discord.Color.blue(),
                    )
                    for item in res.password_updated:
                        pass_embed.add_field(
                            name=f"ไอดี: {item['username']}",
                            value=f"เปลี่ยนรหัสผ่านเป็น: ||`{item['new_password']}`||\n(อัปเดตข้อมูลในคลังเรียบร้อย ไม่เพิ่มสต็อกซ้ำ)",
                            inline=False,
                        )
                    pass_embed.set_footer(text=f"อัปเดตโดย {message.author.name}")
                    await message.reply(embed=pass_embed)

                # If only duplicates and no new accounts and no password updates
                if res.duplicates and not res.password_updated and res.success_count == 0:
                    dup_embed = discord.Embed(
                        title="⚠️ ปฏิเสธการเพิ่มสต็อกซ้ำ",
                        description=f"ไอดีต่อไปนี้มีอยู่ในคลังแล้ว และรหัสผ่านเหมือนเดิม ไม่สามารถเพิ่มซ้ำได้:\n" + "\n".join([f"• `{u}`" for u in res.duplicates]),
                        color=discord.Color.orange(),
                    )
                    dup_embed.set_footer(text=f"ตรวจสอบโดย {message.author.name}")
                    await message.reply(embed=dup_embed)
                    return

                # If new accounts were added
                if res.success_count > 0:
                    embed = discord.Embed(
                        title="📦 บันทึกข้อมูลเข้าคลังสต็อกเรียบร้อย",
                        color=discord.Color.green(),
                    )
                    embed.add_field(name="✅ เพิ่มสำเร็จ", value=f"`{res.success_count}` บัญชี", inline=True)
                    if res.duplicates:
                        embed.add_field(name="⚠️ ซ้ำ (ปฏิเสธ)", value=f"`{len(res.duplicates)}` บัญชี", inline=True)
                    embed.add_field(name="📊 สต็อกคงเหลือพร้อมใช้", value=f"`{stats['available']}` บัญชี", inline=True)
                    embed.set_footer(text=f"บันทึกโดย {message.author.name}")
                    await message.reply(embed=embed)
                    return

        # Reply when bot is mentioned in channel
        if self.user and self.user in message.mentions:
            clean_content = message.clean_content.replace(f"@{self.user.name}", "").strip().lower()

            # Direct mention check: @Oauth status
            if "status" in clean_content or "สถานะ" in clean_content:
                info = self.roblox_service.get_status_info()
                is_run = info["is_running"]
                color = discord.Color.green() if is_run else discord.Color.red()
                status_txt = info["status_text"]

                embed = discord.Embed(
                    title="🎮 ข้อมูลสถานะการทำงาน (Roblox & Emulator)",
                    description=f"สถานะปัจจุบัน: **{status_txt}**",
                    color=color,
                )
                embed.add_field(
                    name=info["duration_title"],
                    value=f"**{info['duration_str']}**",
                    inline=True,
                )
                if is_run:
                    embed.add_field(
                        name="🕒 เริ่มเปิดเกมเมื่อ",
                        value=f"`{info.get('started_at', 'ไม่ระบุ')}`",
                        inline=True,
                    )
                else:
                    embed.add_field(
                        name="⚠️ สถานะตัวเกม",
                        value="`ไม่อยู่ใน Roblox (ปิดอยู่)`",
                        inline=True,
                    )

                embed.add_field(
                    name="⏰ เวลาที่ตรวจเช็ก",
                    value=f"`{info['timestamp']}`",
                    inline=False,
                )

                if is_run:
                    p_lines = [
                        f"• **{p['name']}** (PID: `{p['pid']}`, RAM: `{p['memory']}`, เริ่ม: `{p.get('start_time_str', '-')}`)"
                        for p in info["processes"]
                    ]
                    embed.add_field(
                        name="⚙️ Process ที่กำลังรันอยู่",
                        value="\n".join(p_lines),
                        inline=False,
                    )
                else:
                    embed.add_field(
                        name="ℹ️ รายละเอียด",
                        value="❌ **ไม่อยู่ใน Roblox หรือโปรแกรมจำลอง** (ตรวจไม่พบ Process ใดๆ ในเครื่องขณะนี้)",
                        inline=False,
                    )

                embed.set_footer(text="Roblox Real-time Uptime Tracker")
                await message.reply(embed=embed)
                return

            # Direct mention check: @Oauth screen
            if "screen" in clean_content or "จอ" in clean_content or "แคป" in clean_content:
                temp_path = os.path.join(tempfile.gettempdir(), f"roblox_screen_{int(time.time()*1000)}.png")
                ok, target_desc = self.roblox_service.capture_screen_detailed(temp_path)
                if ok and os.path.exists(temp_path):
                    try:
                        d_file = discord.File(temp_path, filename="screen.png")
                        embed = discord.Embed(
                            title="📸 ภาพหน้าจอ (Live Screenshot)",
                            description=f"🎯 **เป้าหมาย:** {target_desc}\nบันทึกเฉพาะแท็บเกม Roblox/MuMu หรือหน้าจอหลัก (Main Screen)",
                            color=discord.Color.blue(),
                        )
                        embed.set_image(url="attachment://screen.png")
                        embed.set_footer(text=f"แคปเมื่อ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                        await message.reply(embed=embed, file=d_file)
                    finally:
                        if os.path.exists(temp_path):
                            try:
                                os.remove(temp_path)
                            except Exception:
                                pass
                    return
                else:
                    await message.reply("❌ ไม่สามารถแคปภาพหน้าจอได้ในขณะนี้")
                    return

            # Direct mention check: @Oauth reconnect
            if "reconnect" in clean_content or "เข้าเกม" in clean_content or "เปิดเกม" in clean_content:
                from roblox_service import launch_roblox
                ok, msg = launch_roblox()
                if ok:
                    embed = discord.Embed(
                        title="🚀 สั่งการเปิดเกม Roblox เรียบร้อย",
                        description=f"{msg}\nตัวเกมกำลังถูกเปิดขึ้นมาบนคอมพิวเตอร์ของคุณ",
                        color=discord.Color.green(),
                    )
                    embed.set_footer(text=f"สั่งการโดย {message.author.name} • {datetime.now().strftime('%H:%M:%S')}")
                    await message.reply(embed=embed)
                else:
                    await message.reply(f"❌ {msg}")
                return

            # Direct mention check: @Oauth gen
            if "gen" in clean_content or "สุ่ม" in clean_content:
                parts = clean_content.split()
                prefix = "kiZortShop"
                amount = 5
                for p in parts:
                    if p.isdigit():
                        amount = int(p)
                        break
                amount = max(1, min(amount, 20))
                creds = self.kaitun_service.generate_credentials_batch(prefix=prefix, count=amount)
                lines = [f"{u} | {p}" for u, p in creds]
                codeblock = "```text\n" + "\n".join(lines) + "\n```"

                embed = discord.Embed(
                    title="🎲 ชุดข้อมูลสำหรับสมัครไอดี Roblox",
                    description=(
                        "💡 นำ Username และ Password ไปสมัครบน Roblox ด้วยตัวเอง\n"
                        "เมื่อสมัครเสร็จ นำข้อมูล `<user>|<pass>|<cookie>` มาเก็บเข้าสต็อกได้ทันทีครับ"
                    ),
                    color=discord.Color.teal(),
                )
                embed.add_field(name=f"📋 รายการชุดข้อมูล ({len(creds)} ชุด)", value=codeblock, inline=False)
                embed.set_footer(text=f"Prefix: {prefix} • ขอโดย {message.author.name}")
                await message.reply(embed=embed)
                return

            # Direct mention check: @Oauth stock
            if "stock" in clean_content or "สต็อก" in clean_content:
                stats = self.kaitun_service.get_stock_summary()
                embed = discord.Embed(
                    title="📊 สถานะคลังสต็อกไอดี (Kaitun Stock)",
                    color=discord.Color.blue(),
                )
                embed.add_field(name="🟢 พร้อมใช้งาน", value=f"`{stats['available']}` บัญชี", inline=True)
                embed.add_field(name="🔴 จ่ายแล้ว", value=f"`{stats['used']}` บัญชี", inline=True)
                embed.add_field(name="📦 ทั้งหมด", value=f"`{stats['total']}` บัญชี", inline=True)
                embed.set_footer(text=f"ตรวจเช็กโดย {message.author.name}")
                await message.reply(embed=embed)
                return

            reply = generate_bot_reply(
                clean_content or "สวัสดี", self.service.prefix, self.service.hex_length
            )
            await message.reply(reply)

    async def on_ready(self):
        if not hasattr(self, "_has_synced"):
            self._has_synced = False

        # 1. Sync commands once on boot
        if not self._has_synced:
            for guild in self.guilds:
                try:
                    self.tree.copy_global_to(guild=guild)
                    await self.tree.sync(guild=guild)
                    logger.info("Command tree synced to guild: %s (ID: %s)", guild.name, guild.id)
                except Exception as e:
                    logger.error("Failed to sync commands to guild %s: %s", guild.id, e)
            self._has_synced = True

        if self.user:
            logger.info("Bot logged in successfully as %s (ID: %s)", self.user.name, self.user.id)


def create_bot(
    settings: Settings,
    service: KeyService,
    process_service: Optional[ProcessService] = None,
    kaitun_service: Optional[KaitunService] = None,
    ticket_service: Optional[TicketService] = None,
    database: Optional[Database] = None,
) -> discord.Client:
    return KeyValidationBot(
        settings=settings,
        service=service,
        process_service=process_service,
        kaitun_service=kaitun_service,
        ticket_service=ticket_service,
        database=database,
    )


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    settings = load_settings()
    database = Database(settings.database_path)
    database.initialize()
    service = KeyService(database, settings.key_prefix, settings.key_hex_length)
    provider_client = ProviderClient(
        base_url=settings.provider_base_url,
        api_key=settings.provider_api_key,
        allowed_host=settings.provider_allowed_host,
        enabled=settings.provider_enabled,
    )
    process_service = ProcessService(provider_client, service)
    kaitun_service = KaitunService(database)
    bot = create_bot(
        settings=settings,
        service=service,
        process_service=process_service,
        kaitun_service=kaitun_service,
        database=database,
    )
    bot.run(settings.discord_token)


if __name__ == "__main__":
    main()
