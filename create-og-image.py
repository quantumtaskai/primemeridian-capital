#!/usr/bin/env python3
"""
Script to create Prime Meridian Capital OG image
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import requests
    from io import BytesIO
except ImportError:
    print("PIL not available, creating simple image instructions...")
    exit(1)

def create_og_image():
    # Create image with OG dimensions
    width, height = 1200, 630

    # Create a gradient background
    img = Image.new('RGB', (width, height), color='#1a1a1a')
    draw = ImageDraw.Draw(img)

    # Add gradient effect
    for y in range(height):
        alpha = int(255 * (y / height) * 0.3)
        color = (alpha, alpha, alpha)
        draw.line([(0, y), (width, y)], fill=color)

    # Add overlay
    overlay = Image.new('RGBA', (width, height), (0, 0, 0, 128))
    img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')

    draw = ImageDraw.Draw(img)

    # Try to load fonts (fallback to default if not available)
    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
        subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
        text_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    except:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
        text_font = ImageFont.load_default()

    # Colors
    gold = '#D4AF37'
    white = '#FFFFFF'
    light_gray = '#CCCCCC'

    # Draw trust badge outline
    badge_x, badge_y = 400, 80
    badge_w, badge_h = 400, 40
    draw.rounded_rectangle([badge_x, badge_y, badge_x + badge_w, badge_y + badge_h],
                          radius=20, outline=gold, width=2)

    # Trust badge text
    draw.text((badge_x + 20, badge_y + 10), "🛡️ Trusted Global Advisory Since 2009",
              fill=gold, font=text_font)

    # Main title
    title_y = 180
    draw.text((600, title_y), "PRIME", fill=white, font=title_font, anchor="mm")
    draw.text((600, title_y + 80), "MERIDIAN", fill=white, font=title_font, anchor="mm")
    draw.text((600, title_y + 160), "CAPITAL", fill=white, font=title_font, anchor="mm")

    # Tagline
    draw.text((600, title_y + 220), "INVESTMENT ADVISORY FIRM",
              fill=gold, font=subtitle_font, anchor="mm")

    # Description
    desc_text = "We don't just facilitate deals—we create strategic value.\nSpecializing in helping businesses with growth, transformation,\nand exit opportunities through strategic partnerships."
    draw.multiline_text((600, title_y + 270), desc_text,
                       fill=light_gray, font=text_font, anchor="mm", spacing=8)

    # Stats
    stats_y = title_y + 360
    stat_positions = [400, 600, 800]
    stats = [
        ("Global", "MANDATES"),
        ("Dubai", "& LONDON"),
        ("Multi-Sector", "EXPERTISE")
    ]

    for i, (stat_num, stat_label) in enumerate(stats):
        x = stat_positions[i]
        draw.text((x, stats_y), stat_num, fill=gold, font=subtitle_font, anchor="mm")
        draw.text((x, stats_y + 30), stat_label, fill=light_gray, font=text_font, anchor="mm")

    # CTA Button
    btn_x, btn_y = 400, 520
    btn_w, btn_h = 200, 50
    draw.rounded_rectangle([btn_x, btn_y, btn_x + btn_w, btn_y + btn_h],
                          radius=8, fill=gold)
    draw.text((btn_x + btn_w//2, btn_y + btn_h//2), "📱 SCHEDULE A CALL",
              fill='#000000', font=text_font, anchor="mm")

    # Services button
    btn2_x = btn_x + btn_w + 20
    draw.rounded_rectangle([btn2_x, btn_y, btn2_x + 150, btn_y + btn_h],
                          radius=8, outline=white, width=1)
    draw.text((btn2_x + 75, btn_y + btn_h//2), "Our Services →",
              fill=white, font=text_font, anchor="mm")

    # Save the image
    img.save('prime-meridian-og.png', 'PNG', quality=95)
    print("OG image created successfully: prime-meridian-og.png")

if __name__ == "__main__":
    create_og_image()