import asyncio
import os
import discord
from dotenv import load_dotenv
from bot import build_ticket_panel_embed, SupportTicketPanelView
from ticket_service import TicketService

env_path = os.path.join(os.path.dirname(__file__), ".env")
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
    
    # 1. Ensure category 'CUSTOMER SUPPORT' exists
    cat = discord.utils.get(guild.categories, name="CUSTOMER SUPPORT")
    if not cat:
        cat = await guild.create_category("CUSTOMER SUPPORT")
        print(f"[OK] Created category: CUSTOMER SUPPORT")
    else:
        print(f"[OK] Found category: CUSTOMER SUPPORT (ID: {cat.id})")

    # 2. Find target channel #support-tickets
    target_ch = discord.utils.get(guild.text_channels, name="support-tickets")
    if not target_ch:
        target_ch = await guild.create_text_channel("support-tickets", category=cat)
        print(f"[OK] Created channel: #support-tickets")
    else:
        print(f"[OK] Found channel: #{target_ch.name} (ID: {target_ch.id})")

    # 3. Clean previous bot messages in #support-tickets
    async for old_msg in target_ch.history(limit=20):
        if old_msg.author == client.user:
            try:
                await old_msg.delete()
                await asyncio.sleep(0.3)
            except Exception:
                pass

    base_dir = os.path.dirname(os.path.abspath(__file__))
    ticket_service = TicketService(os.path.join(base_dir, "data", "tickets.sqlite3"))
    embed = build_ticket_panel_embed()
    view = SupportTicketPanelView(ticket_service)

    # 5. Send updated panel to #support-tickets
    msg = await target_ch.send(embed=embed, view=view)
    print(f"[SUCCESS] Posted Updated KaiZort Support Panel to #{target_ch.name} (Message ID: {msg.id})")

    await client.close()

if __name__ == "__main__":
    client.run(token)
