"""Avatar generation service for creating poker-style user avatars."""

import hashlib
import io
from typing import Tuple, Optional
from PIL import Image, ImageDraw, ImageFont


def _hash_to_color(text: str, seed: int = 0) -> Tuple[int, int, int]:
    """Generate a deterministic color from text using hash."""
    hash_input = f"{text}{seed}".encode('utf-8')
    hash_digest = hashlib.sha256(hash_input).hexdigest()
    
    # Extract RGB values from hash
    r = int(hash_digest[0:2], 16)
    g = int(hash_digest[2:4], 16)
    b = int(hash_digest[4:6], 16)
    
    # Adjust to create poker-themed colors (greens, blues, purples)
    # Favor green accent tones
    if seed % 3 == 0:
        # Green theme
        r = min(r, 120)
        g = max(g, 150)
        b = min(b, 120)
    elif seed % 3 == 1:
        # Blue theme
        r = min(r, 120)
        g = min(g, 150)
        b = max(b, 180)
    else:
        # Purple/mixed theme
        r = max(r, 100)
        g = min(g, 120)
        b = max(b, 150)
    
    return (r, g, b)


def _get_initials(username: Optional[str], user_id: int) -> str:
    """Extract initials from username or use user ID."""
    if username and len(username) > 0:
        # Get first 2 characters, uppercase
        return username[:2].upper()
    # Fallback to ID-based initials
    return f"P{user_id % 100:02d}"


def generate_avatar(
    user_id: int,
    username: Optional[str] = None,
    size: int = 256
) -> bytes:
    """
    Generate a poker-style avatar image.
    
    Args:
        user_id: Database user ID
        username: Optional username for personalization
        size: Output image size (square)
    
    Returns:
        PNG image bytes
    """
    # Create a new image with a gradient background
    img = Image.new('RGB', (size, size), color='white')
    draw = ImageDraw.Draw(img)
    
    # Generate deterministic colors based on user_id
    bg_color1 = _hash_to_color(str(user_id), seed=0)
    bg_color2 = _hash_to_color(str(user_id), seed=1)
    
    # Create gradient background
    for y in range(size):
        ratio = y / size
        r = int(bg_color1[0] * (1 - ratio) + bg_color2[0] * ratio)
        g = int(bg_color1[1] * (1 - ratio) + bg_color2[1] * ratio)
        b = int(bg_color1[2] * (1 - ratio) + bg_color2[2] * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b))
    
    # Add circular mask for modern look
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse([(0, 0), (size, size)], fill=255)
    
    # Apply circular mask
    output = Image.new('RGB', (size, size), (255, 255, 255))
    output.paste(img, (0, 0), mask)
    
    # Add initials
    initials = _get_initials(username, user_id)
    
    # Try to use a nice font, fallback to default
    try:
        # Try to load a system font
        font_size = int(size * 0.4)
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        # Fallback to default font
        font = ImageFont.load_default()
    
    # Draw initials in center
    draw_final = ImageDraw.Draw(output)
    
    # Calculate text position (centered)
    bbox = draw_final.textbbox((0, 0), initials, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    position = ((size - text_width) // 2, (size - text_height) // 2 - font_size // 8)
    
    # Draw text with shadow for better visibility
    shadow_offset = max(2, size // 128)
    draw_final.text(
        (position[0] + shadow_offset, position[1] + shadow_offset),
        initials,
        fill=(0, 0, 0, 128),
        font=font
    )
    draw_final.text(position, initials, fill=(255, 255, 255), font=font)
    
    # Add subtle poker symbols in corners (small card suits)
    suits = ['♠', '♥', '♦', '♣']
    suit = suits[user_id % 4]
    
    try:
        suit_font_size = int(size * 0.15)
        suit_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", suit_font_size)
    except:
        suit_font = font
    
    # Draw suit symbol in top-right corner with transparency effect
    suit_color = (255, 255, 255, 180) if user_id % 2 == 0 else (220, 220, 220, 180)
    suit_position = (int(size * 0.75), int(size * 0.1))
    draw_final.text(suit_position, suit, fill=(255, 255, 255, 200), font=suit_font)
    
    # Convert to bytes
    output_io = io.BytesIO()
    output.save(output_io, format='PNG', optimize=True)
    output_io.seek(0)
    
    return output_io.getvalue()
