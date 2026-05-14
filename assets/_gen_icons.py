"""Generate PNG app icons from the SVG-style design using Pillow.
Run once. Outputs apple-touch-icon.png, icon-192.png, icon-512.png in the same folder."""
from PIL import Image, ImageDraw
import math
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

BRICK = (17, 87, 64, 255)
BRICK_DEEP = (11, 46, 34, 255)
GOLD = (185, 151, 91, 255)
GOLD_SOFT = (217, 194, 142, 255)
CREAM = (250, 246, 238, 255)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i]-a[i])*t) for i in range(4))

def diagonal_gradient(size, c1, c2):
    """Return an RGBA image with a diagonal gradient from c1 (top-left) to c2 (bottom-right)."""
    img = Image.new('RGBA', (size, size))
    px = img.load()
    diag = size * 2 - 2
    for y in range(size):
        for x in range(size):
            t = (x + y) / diag
            px[x, y] = lerp(c1, c2, t)
    return img

def rounded_mask(size, radius):
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size, size), radius=radius, fill=255)
    return mask

def draw_contours(d, size):
    """Subtle gold topo contour lines across the lower portion."""
    w = size
    y_base = int(size * 0.74)
    amp = max(2, int(size * 0.015))
    step = max(4, int(size * 0.058))
    rows = 5
    for r in range(rows):
        y = y_base + r * step
        pts = []
        for x in range(-10, w + 11, max(2, int(size/64))):
            yy = y + int(math.sin((x / w) * 4 * math.pi + r) * amp)
            pts.append((x, yy))
        d.line(pts, fill=(GOLD[0], GOLD[1], GOLD[2], 140), width=max(1, int(size/256)))

def draw_aperture(d, cx, cy, R, blade_color, center_color, ring_color):
    """Six-blade aperture iris, mathematically rotated triangles."""
    # outer ring
    d.ellipse((cx-R, cy-R, cx+R, cy+R), outline=ring_color, width=max(2, int(R*0.045)))
    # blades
    blade_pts = [(0, -R*0.86), (-R*0.25, -R*0.07), (R*0.74, -R*0.42)]
    for k in range(6):
        ang = math.radians(k * 60)
        cos_a, sin_a = math.cos(ang), math.sin(ang)
        rotated = []
        for (px, py) in blade_pts:
            rx = px*cos_a - py*sin_a
            ry = px*sin_a + py*cos_a
            rotated.append((cx + rx, cy + ry))
        d.polygon(rotated, fill=blade_color)
    # center opening
    r2 = int(R * 0.245)
    d.ellipse((cx-r2, cy-r2, cx+r2, cy+r2), fill=center_color)
    d.ellipse((cx-r2, cy-r2, cx+r2, cy+r2), outline=ring_color, width=max(1, int(R*0.014)))

def render_icon(size, corner_ratio=0.22, has_corner=True):
    s = size
    # Render at 2x for crisp anti-alias, then downscale
    SS = 2
    img = diagonal_gradient(s*SS, BRICK, BRICK_DEEP)
    d = ImageDraw.Draw(img)
    draw_contours(d, s*SS)
    R = int(s*SS * 0.27)
    cx, cy = s*SS // 2, int(s*SS * 0.46)
    draw_aperture(d, cx, cy, R, blade_color=CREAM, center_color=BRICK_DEEP, ring_color=GOLD)
    img = img.resize((s, s), Image.LANCZOS)
    if has_corner:
        mask = rounded_mask(s, int(s * corner_ratio))
        out = Image.new('RGBA', (s, s), (0,0,0,0))
        out.paste(img, (0,0), mask=mask)
        return out
    return img

def main():
    # 1024 master (PWA likes 512+)
    master = render_icon(1024)
    master.save(os.path.join(OUT_DIR, 'icon-1024.png'), 'PNG')
    # 512
    render_icon(512).save(os.path.join(OUT_DIR, 'icon-512.png'), 'PNG')
    # 192
    render_icon(192).save(os.path.join(OUT_DIR, 'icon-192.png'), 'PNG')
    # apple-touch-icon (180, no corner since iOS masks it)
    render_icon(180, has_corner=False).save(os.path.join(OUT_DIR, 'apple-touch-icon.png'), 'PNG')
    # favicon 32
    render_icon(32, corner_ratio=0.25).save(os.path.join(OUT_DIR, 'favicon-32.png'), 'PNG')
    print('icons written:', os.listdir(OUT_DIR))

if __name__ == '__main__':
    main()
