"""Tests for avatar generation service.

These are standalone unit tests that don't require database setup.
"""

import sys
from pathlib import Path

# Add parent directory to path to allow importing the module
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.services.avatar_service import generate_avatar


def test_avatar_generation_basic():
    """Test that avatar generation produces valid PNG bytes."""
    avatar = generate_avatar(user_id=1, username="testuser", size=256)
    
    assert isinstance(avatar, bytes)
    assert len(avatar) > 0
    # Check for PNG signature
    assert avatar[:8] == b'\x89PNG\r\n\x1a\n'


def test_avatar_generation_deterministic():
    """Test that same user always gets same avatar."""
    avatar1 = generate_avatar(user_id=42, username="alice", size=256)
    avatar2 = generate_avatar(user_id=42, username="alice", size=256)
    
    assert avatar1 == avatar2


def test_avatar_generation_different_users():
    """Test that different users get different avatars."""
    avatar1 = generate_avatar(user_id=1, username="alice", size=256)
    avatar2 = generate_avatar(user_id=2, username="bob", size=256)
    
    assert avatar1 != avatar2


def test_avatar_generation_different_sizes():
    """Test that avatar can be generated in different sizes."""
    small = generate_avatar(user_id=1, username="test", size=64)
    large = generate_avatar(user_id=1, username="test", size=512)
    
    assert isinstance(small, bytes)
    assert isinstance(large, bytes)
    assert len(small) < len(large)  # Larger image should have more bytes


def test_avatar_generation_no_username():
    """Test avatar generation works without username."""
    avatar = generate_avatar(user_id=100, username=None, size=256)
    
    assert isinstance(avatar, bytes)
    assert len(avatar) > 0
    assert avatar[:8] == b'\x89PNG\r\n\x1a\n'


if __name__ == "__main__":
    # Run tests manually if pytest is not available
    print("Running avatar service tests...")
    test_avatar_generation_basic()
    print("✓ test_avatar_generation_basic")
    
    test_avatar_generation_deterministic()
    print("✓ test_avatar_generation_deterministic")
    
    test_avatar_generation_different_users()
    print("✓ test_avatar_generation_different_users")
    
    test_avatar_generation_different_sizes()
    print("✓ test_avatar_generation_different_sizes")
    
    test_avatar_generation_no_username()
    print("✓ test_avatar_generation_no_username")
    
    print("\nAll tests passed!")
