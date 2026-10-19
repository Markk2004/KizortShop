import asyncio
import os
import discord
from dotenv import load_dotenv
from bot import get_channel_section, build_channel_help_embed

load_dotenv(".env")
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
    posted_count = 0

    target_channels = [
        "announcements",
        "rules",
        "store-website",
        "general-chat",
        "reviews-vouch",
        "support-tickets",
        "kaitun-id",
        "web-orders",
        "web-topups",
        "web-stock-logs",
        "web-catalog",
        "support-แจ้งปัญหา",
    ]

    for ch in guild.text_channels:
        # Check if channel is one of our target channels or in KAIZORT categories
        is_target = any(t in ch.name.lower() for t in target_channels)
        if not is_target and not (ch.category and "KAIZORT" in ch.category.name.upper()):
            continue

        cat_name = getattr(ch.category, "name", "") if ch.category else ""
        sec = get_channel_section(ch.name, ch.id, cat_name)
        embed = build_channel_help_embed(sec, channel_name=ch.name, user_name="KaiZort System")

        try:
            await ch.send(embed=embed)
            posted_count += 1
            print(f"[OK] Posted guide to #{ch.name} (Section: {sec})")
            await asyncio.sleep(0.8)
        except Exception as e:
            print(f"[WARN] Failed to post in #{ch.name}: {e}")

    print(f"[COMPLETED] Successfully posted guides to {posted_count} channels.")
    await client.close()

if __name__ == "__main__":
    if not token:
        print("[ERROR] DISCORD_TOKEN is missing")
    else:
        client.run(token)
