"""Finite state definitions for the admin control room conversation."""

from enum import IntEnum, auto


class AdminState(IntEnum):
    """Conversation steps for admin treasury and live ops flows."""

    MENU = auto()
    INTEL_MENU = auto()
    USER_LOOKUP = auto()
    USER_BALANCE = auto()
    USER_STATS = auto()
    USER_CRM = auto()
    USER_CRM_ACTION = auto()
    USER_MESSAGE = auto()
    USER_BALANCE_ADJUST = auto()
    USER_BALANCE_CURRENCY = auto()
    MARKETING_MENU = auto()
    MARKETING_PROMO_CODE = auto()
    MARKETING_PROMO_AMOUNT = auto()
    MARKETING_PROMO_LIMIT = auto()
    MARKETING_PROMO_CURRENCY = auto()
    MARKETING_PROMO_EXPIRY = auto()
    MARKETING_BROADCAST = auto()
    TREASURY_OPERATION = auto()
    TREASURY_CURRENCY = auto()
    WAITING_FOR_USER_ID = auto()
    WAITING_FOR_AMOUNT = auto()
    CONFIRMATION = auto()


__all__ = ["AdminState"]
