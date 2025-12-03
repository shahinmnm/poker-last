"""State machine for user-facing menus."""

from enum import IntEnum, auto


class UserState(IntEnum):
    CHOOSE_LANGUAGE = auto()
    MAIN_MENU = auto()
    WALLET_MENU = auto()
    WITHDRAW_AMOUNT = auto()
    WITHDRAW_DESTINATION = auto()
    PROMO_CODE = auto()


__all__ = ["UserState"]
