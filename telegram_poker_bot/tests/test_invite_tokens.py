"""Unit tests for invite token helpers."""

import re

import pytest

from telegram_poker_bot.shared.services import invite_tokens

ALLOWED_PATTERN = re.compile(r"^[A-Z0-9_-]+$")


@pytest.mark.parametrize("length", [10, 12, 14, 16, 32, 48])
def test_generate_invite_token_length_and_charset(length: int):
    token = invite_tokens.generate_invite_token(length)
    assert len(token) == length
    assert ALLOWED_PATTERN.match(token)


def test_generate_invite_token_uniqueness():
    tokens = {invite_tokens.generate_invite_token(16) for _ in range(64)}
    assert len(tokens) == 64


def test_token_length_bounds():
    with pytest.raises(ValueError):
        invite_tokens.generate_invite_token(6)
    with pytest.raises(ValueError):
        invite_tokens.generate_invite_token(64)

