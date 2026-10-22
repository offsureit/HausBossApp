"""Generate the HausBoss icon set from the house mark of hausboss-logo.png (traced geometry, vector-crisp)."""
# Usage: python3 docs/mobile/store/make-icons.py mobile/assets/images public/hausboss-logo.png /tmp/preview.png
from PIL import Image, ImageDraw
import sys, shutil
OUT = sys.argv[1]; LOGO = sys.argv[2]
NAVY = (4, 26, 61, 255); BLUE = (4, 89, 230, 255); WHITE = (255, 255, 255, 255)
# Geometry in a 304 x 252 box (traced from the logo: apex, roof feet, 60px roof band, 48/52px walls, 2x2 window).
W, H = 304.0, 252.0
APEX = (152.0, 0.0); L = (0.0, 102.0); R = (304.0, 106.0); BAND = 60.0
LWALL = (0.0, 48.0); RWALL = (252.0, 304.0); BOTTOM = 252.0
WIN = (116.0, 138.0, 68.0); PANE = 30.0; GAP = 8.0; RADIUS = 4.0

def y_outer(x):
    return L[1] * (APEX[0] - x) / APEX[0] if x <= APEX[0] else R[1] * (x - APEX[0]) / (W - APEX[0])

def parts():
    """(polygon, colour-key) list in local coordinates."""
    roof_outer = [APEX, R, (R[0], R[1] + BAND), (APEX[0], BAND), (L[0], L[1] + BAND), L]
    # the roof band + both walls as one navy shape (right wall navy only above the band's lower edge)
    rwall_split_top = y_outer(RWALL[0]) + BAND; rwall_split_bot = y_outer(RWALL[1]) + BAND
    navy = [APEX, R, (RWALL[1], rwall_split_bot), (RWALL[0], rwall_split_top), (APEX[0], BAND), (LWALL[1], y_outer(LWALL[1]) + BAND), (LWALL[1], BOTTOM), (LWALL[0], BOTTOM), L]
    blue = [(RWALL[0], rwall_split_top), (RWALL[1], rwall_split_bot), (RWALL[1], BOTTOM), (RWALL[0], BOTTOM)]
    return [(navy, 'navy'), (blue, 'blue')]

def panes():
    x0, y0, _ = WIN
    out = []
    for i in range(2):
        for j in range(2):
            x = x0 + i * (PANE + GAP); y = y0 + j * (PANE + GAP)
            out.append((x, y, x + PANE, y + PANE))
    return out

def render(canvas, house_w, bg, navy, blue, window, center=None, ss=4):
    """canvas px, house width px. Returns an RGBA image."""
    cw = canvas * ss; s = house_w * ss / W
    img = Image.new('RGBA', (cw, cw), bg)
    d = ImageDraw.Draw(img)
    hw, hh = W * s, H * s
    cx, cy = (center or (canvas / 2, canvas / 2))
    ox, oy = cx * ss - hw / 2, cy * ss - hh / 2
    T = lambda p: (ox + p[0] * s, oy + p[1] * s)
    for poly, key in parts():
        d.polygon([T(p) for p in poly], fill=navy if key == 'navy' else blue)
    for (x1, y1, x2, y2) in panes():
        d.rounded_rectangle([T((x1, y1)), T((x2, y2))], radius=RADIUS * s, fill=window)
    return img.resize((canvas, canvas), Image.LANCZOS)

T0 = (0, 0, 0, 0)
render(1024, 640, WHITE, NAVY, BLUE, NAVY).save(f'{OUT}/icon.png')                       # iOS / default: like the logo
render(1024, 640, (11, 31, 74, 255), WHITE, BLUE, WHITE).save(f'{OUT}/icon-dark.png')    # iOS dark: navy tile, white house
render(1024, 640, T0, (235, 238, 244, 255), (160, 170, 190, 255), (235, 238, 244, 255)).save(f'{OUT}/icon-tinted.png')  # iOS tinted: greyscale on transparent
render(1024, 560, T0, NAVY, BLUE, NAVY).save(f'{OUT}/android-icon-foreground.png')       # adaptive foreground (66 % safe zone = 676 px)
Image.new('RGBA', (1024, 1024), WHITE).save(f'{OUT}/android-icon-background.png')
render(1024, 560, T0, WHITE, WHITE, WHITE).save(f'{OUT}/android-icon-monochrome.png')     # themed icon silhouette
render(1152, 540, T0, NAVY, BLUE, NAVY).save(f'{OUT}/splash-icon.png')                   # Android 12 splash icon (artwork inside the 768 px circle)
render(96, 72, T0, WHITE, WHITE, WHITE).save(f'{OUT}/notification-icon.png')             # Android tints it
render(1024, 640, WHITE, NAVY, BLUE, NAVY).resize((64, 64), Image.LANCZOS).save(f'{OUT}/favicon.png')
shutil.copy(LOGO, f'{OUT}/splash-logo.png')                                               # iOS splash: the full logo (house + wordmark)
# preview sheet
sheet = Image.new('RGBA', (1024 * 4 + 50, 1024 + 1152), (200, 200, 200, 255))
for i, n in enumerate(['icon', 'icon-dark', 'icon-tinted', 'android-icon-foreground']):
    sheet.paste(Image.open(f'{OUT}/{n}.png'), (i * 1034, 0))
sheet.paste(Image.open(f'{OUT}/splash-icon.png'), (0, 1034))
sheet.paste(Image.open(f'{OUT}/android-icon-monochrome.png'), (1162, 1034))
sheet.paste(Image.open(f'{OUT}/splash-logo.png').convert('RGBA').resize((913, 400)), (2300, 1034))
sheet.resize((sheet.width // 4, sheet.height // 4), Image.LANCZOS).save(sys.argv[3])
print('done')
