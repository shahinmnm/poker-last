"""Internationalization (i18n) support."""

import json
from pathlib import Path
from typing import Dict, Optional

from telegram_poker_bot.shared.logging import get_logger

logger = get_logger(__name__)

# Load translations
_translations: Dict[str, Dict[str, str]] = {}


def load_translations():
    """Load translation files."""
    locales_dir = Path(__file__).parent.parent / "config" / "locales"
    
    for locale_file in locales_dir.glob("*.json"):
        lang_code = locale_file.stem
        try:
            with open(locale_file, "r", encoding="utf-8") as f:
                _translations[lang_code] = json.load(f)
            logger.info("Loaded translations", language=lang_code)
        except Exception as e:
            logger.error("Failed to load translations", language=lang_code, error=str(e))


def get_translation(language: str = "en") -> callable:
    """
    Get translation function for a language.
    
    Usage:
        t = get_translation("en")
        text = t("welcome_title")
        text_with_params = t("greeting", name="John")
    """
    lang = language.split("_")[0].lower()  # Extract base language (en from en_US)
    translations = _translations.get(lang, _translations.get("en", {}))
    
    def translate(key: str, **kwargs) -> str:
        """Translate a key with optional parameters."""
        text = translations.get(key, key)
        
        # Simple parameter substitution
        if kwargs:
            for param, value in kwargs.items():
                text = text.replace(f"{{{param}}}", str(value))
        
        return text
    
    return translate


# Load translations on module import
load_translations()
