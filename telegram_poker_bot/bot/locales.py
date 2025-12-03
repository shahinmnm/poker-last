"""Lightweight locale helper for bot copy."""

from __future__ import annotations

from typing import Any


MESSAGES = {
    "en": {
        "welcome_new": "👋 Welcome! Choose your language to get started.",
        "welcome_back": "👋 Welcome back, {name}!",
        "balance_line": "💰 Balance: {real_chips} 💲 | {play_chips} 🪙",
        "status_ready": "📍 Status: Ready to play.",
        "play_poker": "🎮 Play Poker",
        "wallet": "💰 Wallet",
        "profile": "👤 Profile & Stats",
        "promotions": "🎁 Promotions",
        "invite": "🤝 Invite Friends",
        "settings": "⚙️ Settings / Language",
        "support": "🆘 Support",
        "back": "🔙 Back",
        "choose_language": "Select your language",
        "language_set": "Language updated.",
        "deposit_info": "To deposit, please contact support or send crypto. We'll process it manually.",
        "contact_admin": "💬 Contact Admin",
        "withdraw_insufficient": "Insufficient funds to withdraw.",
        "withdraw_amount": "Enter withdrawal amount:",
        "withdraw_destination": "Enter your card/wallet info:",
        "withdraw_submitted": "Withdrawal request sent to admin. You'll be contacted shortly.",
        "withdraw_cancelled": "Withdrawal cancelled.",
        "history_title": "📝 Recent Transactions",
        "history_empty": "No transactions yet.",
        "promo_prompt": "Enter promo code:",
        "promo_success": "Success! {amount} credited.",
        "promo_invalid": "Promo code invalid or exhausted.",
        "invite_header": "Invite friends and earn rewards!",
        "invite_link": "Your link:",
        "invite_stats": "You invited {count} players.",
        "support_text": "Need help? Our team is here.",
        "wallet_menu": "Wallet menu",
        "promo_menu": "Promotions",
        "profile_title": "Profile",
        "withdraw_request": "Withdraw",
        "deposit_request": "Deposit",
        "history_button": "📝 History",
        "withdraw_button": "📤 Withdraw",
        "deposit_button": "📥 Deposit",
        "promo_button": "🎟️ Redeem Code",
        "main_menu": "Main Menu",
    },
    "fa": {
        "welcome_new": "👋 خوش آمدید! زبان خود را انتخاب کنید.",
        "welcome_back": "👋 خوش آمدی، {name}!",
        "balance_line": "💰 موجودی: {real_chips} 💲 | {play_chips} 🪙",
        "status_ready": "📍 آماده بازی.",
        "play_poker": "🎮 بازی پوکر",
        "wallet": "💰 کیف پول",
        "profile": "👤 پروفایل و آمار",
        "promotions": "🎁 پرومو",
        "invite": "🤝 دعوت دوستان",
        "settings": "⚙️ تنظیمات / زبان",
        "support": "🆘 پشتیبانی",
        "back": "🔙 بازگشت",
        "choose_language": "زبان را انتخاب کنید",
        "language_set": "زبان به‌روز شد.",
        "deposit_info": "برای واریز، با پشتیبانی تماس بگیرید یا رمز ارز ارسال کنید. به صورت دستی پردازش می‌شود.",
        "contact_admin": "💬 تماس با ادمین",
        "withdraw_insufficient": "موجودی کافی نیست.",
        "withdraw_amount": "مبلغ برداشت را وارد کنید:",
        "withdraw_destination": "اطلاعات کارت/کیف پول را وارد کنید:",
        "withdraw_submitted": "درخواست برداشت برای ادمین ارسال شد. به زودی با شما تماس می‌گیریم.",
        "withdraw_cancelled": "برداشت لغو شد.",
        "history_title": "📝 تراکنش‌های اخیر",
        "history_empty": "تراکنشی وجود ندارد.",
        "promo_prompt": "کد پرومو را وارد کنید:",
        "promo_success": "موفق! {amount} اضافه شد.",
        "promo_invalid": "کد نامعتبر یا مصرف شده است.",
        "invite_header": "دوستانت را دعوت کن و پاداش بگیر!",
        "invite_link": "لینک شما:",
        "invite_stats": "تعداد دعوت‌ها: {count}",
        "support_text": "نیاز به کمک داری؟ تیم ما همراه توست.",
        "wallet_menu": "منوی کیف پول",
        "promo_menu": "پرومو",
        "profile_title": "پروفایل",
        "withdraw_request": "برداشت",
        "deposit_request": "واریز",
        "history_button": "📝 تاریخچه",
        "withdraw_button": "📤 برداشت",
        "deposit_button": "📥 واریز",
        "promo_button": "🎟️ ثبت کد",
        "main_menu": "منوی اصلی",
    },
}


def get_text(key: str, lang: str | None = "en", **kwargs: Any) -> str:
    """Fetch a localized string with formatting fallback."""
    normalized_lang = (lang or "en").split("-")[0].lower()
    catalog = MESSAGES.get(normalized_lang) or MESSAGES["en"]
    template = catalog.get(key) or MESSAGES["en"].get(key, key)
    try:
        return template.format(**kwargs)
    except Exception:
        return template
