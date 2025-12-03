"""Finite state definitions for the admin control room conversation."""

from enum import IntEnum, auto


class AdminState(IntEnum):
    """Conversation steps for admin treasury and live ops flows."""

    MENU = auto()
    TREASURY_OPERATION = auto()
    TREASURY_CURRENCY = auto()
    WAITING_FOR_USER_ID = auto()
    WAITING_FOR_AMOUNT = auto()
    CONFIRMATION = auto()


__all__ = ["AdminState"]
