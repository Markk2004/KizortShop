import discord
from bot import create_bot, KeyValidationBot
from config import Settings
from database import Database
from key_service import KeyService


def test_create_bot_initialization(tmp_path):
    settings = Settings(
        discord_token="fake-test-token",
        database_path=str(tmp_path / "test.sqlite3"),
        key_prefix="FREE_",
        key_hex_length=32,
    )
    database = Database(settings.database_path)
    database.initialize()
    service = KeyService(database, settings.key_prefix, settings.key_hex_length)

    bot = create_bot(settings, service)
    assert isinstance(bot, KeyValidationBot)
    assert bot.settings == settings
    assert bot.service == service

    # Check registered slash commands
    redeem_cmd = bot.tree.get_command("redeem")
    assert redeem_cmd is not None
    assert redeem_cmd.name == "redeem"

    help_cmd = bot.tree.get_command("help")
    assert help_cmd is not None
    assert help_cmd.name == "help"

    ask_cmd = bot.tree.get_command("ask")
    assert ask_cmd is not None
    assert ask_cmd.name == "ask"

    getkey_cmd = bot.tree.get_command("getkey")
    assert getkey_cmd is not None
    assert getkey_cmd.name == "getkey"

    process_cmd = bot.tree.get_command("process")
    assert process_cmd is not None
    assert process_cmd.name == "process"

    gen_id_cmd = bot.tree.get_command("gen_id")
    assert gen_id_cmd is not None
    assert gen_id_cmd.name == "gen_id"

    stock_add_cmd = bot.tree.get_command("stock_add")
    assert stock_add_cmd is not None
    assert stock_add_cmd.name == "stock_add"

    stock_check_cmd = bot.tree.get_command("stock_check")
    assert stock_check_cmd is not None
    assert stock_check_cmd.name == "stock_check"

    stock_dispense_cmd = bot.tree.get_command("stock_dispense")
    assert stock_dispense_cmd is not None
    assert stock_dispense_cmd.name == "stock_dispense"

    post_guides_cmd = bot.tree.get_command("post_channel_guides")
    assert post_guides_cmd is not None
    assert post_guides_cmd.name == "post_channel_guides"

    database.close()


def test_get_channel_section():
    from bot import get_channel_section

    assert get_channel_section("kaitun-id") == "kaitun"
    assert get_channel_section("support-tickets") == "support"
    assert get_channel_section("support-แจ้งปัญหา") == "support"
    assert get_channel_section("reviews-vouch") == "vouch"
    assert get_channel_section("store-website") == "store"
    assert get_channel_section("general-chat") == "general"
    assert get_channel_section("announcements") == "announcements"
    assert get_channel_section("rules") == "rules"
    assert get_channel_section("web-orders") == "web_logs"
    assert get_channel_section("web-topups") == "web_logs"
    assert get_channel_section("web-stock-logs") == "web_logs"
    assert get_channel_section("random-channel", category_name="KAIZORT WEB LOGS") == "web_logs"
    assert get_channel_section("random-channel") == "general"


def test_build_channel_help_embed_zero_emojis():
    from bot import build_channel_help_embed
    import unicodedata

    sections = [
        "kaitun",
        "support",
        "tickets",
        "general",
        "vouch",
        "reviews",
        "store",
        "website",
        "announcements",
        "rules",
        "web_logs",
        "all",
    ]

    for sec in sections:
        embed = build_channel_help_embed(sec)
        assert embed.title is not None
        assert embed.description is not None
        assert len(embed.fields) > 0

        # Verify strict zero emojis in title, description, fields, and footer
        text_to_check = [embed.title, embed.description]
        if embed.footer and embed.footer.text:
            text_to_check.append(embed.footer.text)
        for f in embed.fields:
            text_to_check.append(f.name)
            text_to_check.append(f.value)

        for text in text_to_check:
            for char in text:
                cat = unicodedata.category(char)
                # Ensure no 'So' (Symbol, other) commonly containing emojis or standard emoji presentation
                codepoint = ord(char)
                is_emoji = (
                    0x1F600 <= codepoint <= 0x1F64F  # Emoticons
                    or 0x1F300 <= codepoint <= 0x1F5FF  # Misc Symbols and Pictographs
                    or 0x1F680 <= codepoint <= 0x1F6FF  # Transport and Map
                    or 0x1F700 <= codepoint <= 0x1F77F  # Alchemical
                    or 0x1F780 <= codepoint <= 0x1F7FF  # Geometric
                    or 0x1F800 <= codepoint <= 0x1F8FF  # Supplemental
                    or 0x1F900 <= codepoint <= 0x1F9FF  # Supplemental Symbols and Pictographs
                    or 0x1FA00 <= codepoint <= 0x1FA6F  # Chess
                    or 0x1FA70 <= codepoint <= 0x1FAFF  # Symbols
                    or 0x2600 <= codepoint <= 0x26FF  # Misc symbols (like ⚠️, 📦, 🟢)
                    or 0x2700 <= codepoint <= 0x27BF  # Dingbats
                )
                assert not is_emoji, f"Emoji character found in {sec} embed: {char} (codepoint: {hex(codepoint)})"


def test_build_ticket_panel_embed_zero_emojis():
    from bot import build_ticket_panel_embed, SupportTicketPanelView, TicketControlView, ConfirmCloseView
    from ticket_service import TicketService
    import unicodedata

    embed = build_ticket_panel_embed()
    assert "KAIZORT STORE" in embed.title
    assert "KaiZort Store" in embed.description
    assert len(embed.fields) >= 2

    # Check zero emojis in panel embed (including fields)
    all_texts = [embed.title, embed.description, embed.footer.text]
    for f in embed.fields:
        all_texts.append(f.name)
        all_texts.append(f.value)

    for text in all_texts:
        for char in text:
            codepoint = ord(char)
            is_emoji = (
                0x1F600 <= codepoint <= 0x1F64F
                or 0x1F300 <= codepoint <= 0x1F5FF
                or 0x1F680 <= codepoint <= 0x1F6FF
                or 0x1F700 <= codepoint <= 0x1F77F
                or 0x1F780 <= codepoint <= 0x1F7FF
                or 0x1F800 <= codepoint <= 0x1F8FF
                or 0x1F900 <= codepoint <= 0x1F9FF
                or 0x1FA00 <= codepoint <= 0x1FA6F
                or 0x1FA70 <= codepoint <= 0x1FAFF
                or 0x2600 <= codepoint <= 0x26FF
                or 0x2700 <= codepoint <= 0x27BF
            )
            assert not is_emoji, f"Emoji character found in ticket panel embed: {char} (codepoint: {hex(codepoint)})"

    # Test views instantiate without issues
    svc = TicketService(":memory:")
    panel_view = SupportTicketPanelView(svc)
    assert len(panel_view.children) == 1
    assert panel_view.children[0].label == "Create ticket"

    ctrl_view = TicketControlView(svc)
    labels = [c.label for c in ctrl_view.children]
    assert "Close" in labels
    assert "Transcript" in labels

    confirm_view = ConfirmCloseView(svc)
    confirm_labels = [c.label for c in confirm_view.children]
    assert "Close" in confirm_labels
    assert "Cancel" in confirm_labels


def test_create_ticket_modal():
    from bot import CreateTicketModal
    from ticket_service import TicketService

    svc = TicketService(":memory:")
    modal = CreateTicketModal(svc)
    assert modal.title == "เปิดตั๋วแจ้งเรื่อง (Support Ticket)"
    assert len(modal.children) == 3
    assert modal.order_id_input.required is False
    assert "ไม่บังคับ" in modal.order_id_input.label
    assert "รายละเอียด" in modal.detail_input.label




