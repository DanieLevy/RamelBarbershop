"""
iOS Splash Screen Generator for Ramel Barbershop PWA
Run this script with Python 3 and Pillow installed:
  pip install Pillow
  python generate-splash.py

This creates splash screens for all iOS device sizes with:
- Dark background (#080b0d) matching the app theme
- Centered logo
"""

from PIL import Image, ImageDraw
import os

# Background color matching app theme
BG_COLOR = (8, 11, 13)  # #080b0d

# All required iOS splash screen sizes
SIZES = [
    (1290, 2796),  # iPhone 15 Pro Max, 14 Pro Max
    (1179, 2556),  # iPhone 15 Pro, 15, 14 Pro
    (1284, 2778),  # iPhone 14 Plus, 13 Pro Max, 12 Pro Max
    (1170, 2532),  # iPhone 14, 13, 13 Pro, 12, 12 Pro
    (1125, 2436),  # iPhone 13 mini, 12 mini
    (1242, 2688),  # iPhone 11 Pro Max, XS Max
    (828, 1792),   # iPhone 11, XR
    (1242, 2208),  # iPhone 8 Plus, 7 Plus
    (750, 1334),   # iPhone SE, 8, 7, 6s, 6
    (2048, 2732),  # iPad Pro 12.9"
    (1668, 2388),  # iPad Pro 11"
    (1668, 2224),  # iPad Air, iPad Pro 10.5"
    (1640, 2360),  # iPad 10th gen
    (1536, 2048),  # iPad mini, older iPads
]

def create_splash_screen(width, height, logo_path="../icons/icon-512x512.png"):
    """Create a splash screen with centered logo on dark background"""
    # Create dark background
    splash = Image.new('RGB', (width, height), BG_COLOR)
    
    # Load and resize logo (40% of smallest dimension)
    try:
        logo = Image.open(logo_path).convert('RGBA')
        logo_size = int(min(width, height) * 0.35)
        logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
        
        # Calculate center position
        x = (width - logo_size) // 2
        y = (height - logo_size) // 2
        
        # Paste logo with transparency
        splash.paste(logo, (x, y), logo)
    except FileNotFoundError:
        print(f"Warning: Logo not found at {logo_path}")
        # Draw placeholder circle
        draw = ImageDraw.Draw(splash)
        logo_size = int(min(width, height) * 0.35)
        x = (width - logo_size) // 2
        y = (height - logo_size) // 2
        draw.ellipse([x, y, x + logo_size, y + logo_size], fill=(212, 175, 55))  # Gold color
    
    return splash

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    logo_path = os.path.join(script_dir, "..", "icons", "icon-512x512.png")
    
    print("Generating iOS splash screens...")
    
    for width, height in SIZES:
        filename = f"splash-{width}x{height}.png"
        filepath = os.path.join(script_dir, filename)
        
        splash = create_splash_screen(width, height, logo_path)
        splash.save(filepath, 'PNG', optimize=True)
        print(f"  Created: {filename}")
    
    print(f"\nDone! Created {len(SIZES)} splash screens.")

if __name__ == "__main__":
    main()

