#!/usr/bin/env python3
"""
Wedding Planner Icon Generator
Generates all required icon sizes from a single source image
and automatically places them in the correct locations.

Usage:
    1. Place your source logo image as 'logo.png' in this folder
    2. Run: python script.py
    3. All icons will be generated and placed in the correct locations

Requirements:
    pip install Pillow
"""

from PIL import Image
from pathlib import Path
import shutil
import os

# Configuration
INPUT = "NewIcon.png"
PROJECT_ROOT = Path(__file__).parent.parent.parent  # Go up to project root
ICONS_DIR = PROJECT_ROOT / "public" / "icons"
PUBLIC_DIR = PROJECT_ROOT / "public"
APP_DIR = PROJECT_ROOT / "app"

def save_icon(img, size, output_path):
    """Resize and save icon to specified path, replacing if exists"""
    # Remove existing file first
    if output_path.exists():
        output_path.unlink()
    
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(output_path, format="PNG", optimize=True)
    print(f"  ✓ {output_path.name} ({size}x{size})")

def save_ico(img, output_path, sizes):
    """Generate multi-size ICO file, replacing if exists"""
    if output_path.exists():
        output_path.unlink()
    
    # Create list of resized images for ICO
    icons = []
    for size in sizes:
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        icons.append(resized)
    
    # Save the first image with additional sizes
    icons[0].save(
        output_path,
        format="ICO",
        append_images=icons[1:] if len(icons) > 1 else [],
        sizes=[(s, s) for s in sizes]
    )
    print(f"  ✓ {output_path.name} ({', '.join(str(s) for s in sizes)})")

def copy_file(src, dst):
    """Copy file, replacing if exists"""
    if dst.exists():
        dst.unlink()
    shutil.copy(src, dst)
    print(f"  ✓ Copied {src.name} → {dst}")

def main():
    print("🎨 Wedding Planner Icon Generator")
    print("=" * 50)
    
    # Check if input file exists
    input_path = Path(__file__).parent / INPUT
    if not input_path.exists():
        print(f"\n❌ Error: '{INPUT}' not found in {Path(__file__).parent}")
        print("   Please place your source logo image as 'logo.png'")
        return
    
    # Load source image
    print(f"\n📁 Loading source image: {INPUT}")
    img = Image.open(input_path).convert("RGBA")
    print(f"   Source size: {img.size[0]}x{img.size[1]}")
    
    if img.size[0] < 512 or img.size[1] < 512:
        print(f"\n⚠️  Warning: Source image is smaller than 512x512")
        print("   For best results, use a 1024x1024 or larger image")
    
    # Ensure output directories exist
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    
    generated_count = 0
    
    # ============================================
    # PWA / Android Icons (in /public/icons/)
    # ============================================
    print("\n📱 Generating PWA/Android icons...")
    pwa_sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    for size in pwa_sizes:
        save_icon(img, size, ICONS_DIR / f"icon-{size}x{size}.png")
        generated_count += 1
    
    # ============================================
    # Apple Touch Icons (in /public/icons/)
    # ============================================
    print("\n🍎 Generating Apple Touch icons...")
    apple_icons = [
        (180, "apple-touch-icon.png"),
        (152, "apple-touch-icon-152x152.png"),
        (167, "apple-touch-icon-167x167.png"),
        (180, "apple-touch-icon-180x180.png"),
    ]
    for size, name in apple_icons:
        save_icon(img, size, ICONS_DIR / name)
        generated_count += 1
    
    # Copy main apple-touch-icon to public root for compatibility
    copy_file(ICONS_DIR / "apple-touch-icon.png", PUBLIC_DIR / "apple-touch-icon.png")
    generated_count += 1
    
    # ============================================
    # Favicons (in /public/)
    # ============================================
    print("\n🌐 Generating Favicons...")
    favicon_sizes = [16, 32, 48]
    for size in favicon_sizes:
        save_icon(img, size, PUBLIC_DIR / f"favicon-{size}x{size}.png")
        generated_count += 1
    
    # Generate favicon.ico (multi-size ICO file)
    print("\n🔷 Generating favicon.ico...")
    save_ico(img, PUBLIC_DIR / "favicon.ico", [16, 32, 48])
    generated_count += 1
    
    # Copy favicon.ico to app directory for Next.js
    copy_file(PUBLIC_DIR / "favicon.ico", APP_DIR / "favicon.ico")
    generated_count += 1
    
    # ============================================
    # Shortcut Icons (in /public/icons/)
    # ============================================
    print("\n🔗 Generating Shortcut icons...")
    shortcut_icons = [
        "shortcut-task.png",
        "shortcut-budget.png",
        "shortcut-calendar.png",
    ]
    for name in shortcut_icons:
        save_icon(img, 96, ICONS_DIR / name)
        generated_count += 1
    
    # ============================================
    # Main logo for app use (high-res)
    # ============================================
    print("\n✨ Generating main logo...")
    save_icon(img, 512, PUBLIC_DIR / "logo.png")
    generated_count += 1
    
    # ============================================
    # Summary
    # ============================================
    print("\n" + "=" * 50)
    print(f"✅ All {generated_count} icons generated successfully!")
    print("\n📍 Files placed in:")
    print(f"   • {ICONS_DIR}")
    print(f"     └─ PWA icons (72-512px)")
    print(f"     └─ Apple Touch icons")
    print(f"     └─ Shortcut icons")
    print(f"   • {PUBLIC_DIR}")
    print(f"     └─ favicon.ico, favicon-*.png")
    print(f"     └─ apple-touch-icon.png")
    print(f"     └─ logo.png (512x512)")
    print(f"   • {APP_DIR}")
    print(f"     └─ favicon.ico")
    print("\n💡 Tip: Run again anytime to regenerate all icons!")
    print("   Just replace 'logo.png' with your new design.")

if __name__ == "__main__":
    main()
