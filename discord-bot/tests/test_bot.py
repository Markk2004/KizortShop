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
    assert bot.db is not None
    assert bot.db == database

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

    accounting_cmd = bot.tree.get_command("accounting")
    assert accounting_cmd is not None
    assert accounting_cmd.name == "accounting"

    income_cmd = bot.tree.get_command("income")
    assert income_cmd is not None
    assert income_cmd.name == "income"

    expense_list_cmd = bot.tree.get_command("expense_list")
    assert expense_list_cmd is not None
    assert expense_list_cmd.name == "expense_list"

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


def test_build_accounting_and_expense_embeds(tmp_path):
    from bot import build_accounting_embed, build_expense_list_embed
    from database import Database

    db = Database(str(tmp_path / "bot.sqlite3"))
    db.initialize()

    # Build accounting embed
    acc_embed = build_accounting_embed(db)
    assert acc_embed is not None
    assert "สรุปบัญชีการเงิน" in acc_embed.title
    field_names = [f.name for f in acc_embed.fields]
    assert any("รายรับ" in name for name in field_names)
    assert any("รายจ่าย" in name for name in field_names)

    # Build expense list embed
    exp_embed = build_expense_list_embed(db)
    if exp_embed is not None:
        assert "รายการค่าใช้จ่ายร้านล่าสุด" in exp_embed.title

    db.close()


def test_stock_update_select_view_and_modal(tmp_path):
    import asyncio
    from bot import StockUpdateModal, StockUpdateSelectView
    from database import Database
    from kaitun_service import KaitunService

    db = Database(str(tmp_path / "bot_stock.sqlite3"))
    db.initialize()
    svc = KaitunService(db)
    svc.add_stock_from_text("SSakamotoz_KsDb | pass123", user_id=1)

    accounts = svc.list_accounts(limit=25)
    assert len(accounts) == 1
    # Match by partial username
    acc = svc.get_account("SSakamotoz")
    assert acc is not None
    assert acc["username"] == "SSakamotoz_KsDb"

    async def _build_ui():
        view = StockUpdateSelectView(svc, accounts)
        assert len(view.children) == 2
        modal = StockUpdateModal(svc, prefill_account=acc)
        assert modal.username_input.default == "SSakamotoz_KsDb"

    asyncio.run(_build_ui())
    db.close()


def test_parse_account_line_with_price_and_details():
    from kaitun_service import parse_account_line

    # 2 parts
    res2 = parse_account_line("user1 | pass1")
    assert res2.username == "user1"
    assert res2.password == "pass1"
    assert res2.cookie is None
    assert res2.price is None

    # 3 parts with price
    res3_price = parse_account_line("user2 | pass2 | 150")
    assert res3_price.username == "user2"
    assert res3_price.password == "pass2"
    assert res3_price.price == "150"
    assert res3_price.cookie is None

    # 3 parts with cookie
    res3_cookie = parse_account_line("user3 | pass3 | _ROBLOSECURITY_COOKIE_VAL")
    assert res3_cookie.username == "user3"
    assert res3_cookie.cookie == "_ROBLOSECURITY_COOKIE_VAL"
    assert res3_cookie.price is None

    # 4 parts: user | pass | price | details
    res4 = parse_account_line("user4 | pass4 | 250 | ผลโมจิ ดาบคู่")
    assert res4.username == "user4"
    assert res4.password == "pass4"
    assert res4.price == "250"
    assert res4.details == "ผลโมจิ ดาบคู่"


def test_expense_delete_and_shortcuts(tmp_path):
    from database import Database

    db = Database(str(tmp_path / "exp_test.sqlite3"))
    db.initialize()

    # Add 2 expenses
    e1 = db.add_expense("ค่าสคริปต์ฟาร์ม", 100.0, "SCRIPT")
    e2 = db.add_expense("ค่า VPS โฮสต์", 350.0, "VPS")
    assert e1 is not None and e2 is not None

    # Delete latest
    del_latest = db.delete_expense("latest")
    assert del_latest is not None
    assert del_latest["title"] == "ค่า VPS โฮสต์"

    # Delete by partial title
    del_script = db.delete_expense("สคริปต์")
    assert del_script is not None
    assert del_script["title"] == "ค่าสคริปต์ฟาร์ม"

    db.close()


def test_cancel_or_undo_sale(tmp_path):
    from database import Database
    from kaitun_service import KaitunService

    db = Database(str(tmp_path / "undo_test.sqlite3"))
    db.initialize()
    svc = KaitunService(db)

    # Add account and mark as sold
    svc.add_stock_from_text("kz_undo_acc | pass123", user_id=1)
    svc.update_account("kz_undo_acc", sale_status="sold", price="150")
    acc = svc.get_account("kz_undo_acc")
    assert acc["sale_status"] == "sold"

    # Cancel sale
    res = db.cancel_or_undo_sale("kz_undo_acc")
    assert res is not None
    assert res["type"] == "account_restored"

    acc_restored = svc.get_account("kz_undo_acc")
    assert acc_restored["sale_status"] == "unsold"

    # Non-account item sale
    item = db.add_item_sale("ผลโมจิ", 200.0)
    assert item is not None
    res_item = db.cancel_or_undo_sale("ผลโมจิ")
    assert res_item is not None
    assert res_item["type"] == "item_sale_cancelled"

    db.close()


def test_is_staff_or_admin_permission_check():
    from bot import is_staff_or_admin

    class MockRole:
        def __init__(self, name):
            self.name = name

    class MockPerms:
        def __init__(self, admin=False, manage_guild=False):
            self.administrator = admin
            self.manage_guild = manage_guild
            self.manage_messages = False

    class MockMember:
        def __init__(self, admin=False, roles=None):
            self.guild_permissions = MockPerms(admin=admin)
            self.roles = roles or []

    # Admin user
    assert is_staff_or_admin(MockMember(admin=True)) is True

    # Staff role user
    assert is_staff_or_admin(MockMember(admin=False, roles=[MockRole("Staff")])) is True
    assert is_staff_or_admin(MockMember(admin=False, roles=[MockRole("ผู้ดูแล")])) is True

    # Regular user
    assert is_staff_or_admin(MockMember(admin=False, roles=[MockRole("Member")])) is False


def test_bot_reply_store_guidance():
    from bot import generate_bot_reply

    reply = generate_bot_reply("มีสินค้าอะไรขายบ้าง", "kz", 8)
    assert "KaiZort Store" in reply
    assert "Blox Fruits" in reply

    claim_reply = generate_bot_reply("ไอดีเข้าไม่ได้ เคลมยังไง", "kz", 8)
    assert "Create ticket" in claim_reply






