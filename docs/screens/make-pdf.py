"""Build the client-facing screenshot PDF: title page + 2 phone screens per A4 page with captions.
usage: make-pdf.py <shots dir> <captions.txt (name|caption per line)> <out.pdf> <out png dir (540 px copies)>"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

shots, captions_file, out_pdf, out_png = sys.argv[1:5]
os.makedirs(out_png, exist_ok=True)
A4 = (2480, 3508)  # 300 dpi portrait
NAVY = (4, 26, 61); BLUE = (4, 89, 230); GREY = (86, 99, 118); WHITE = (255, 255, 255)
font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
bold_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
F = lambda size, bold=False: ImageFont.truetype(bold_path if bold else font_path, size)

items = []
for line in open(captions_file):
    line = line.strip()
    if not line or line.startswith('#'): continue
    name, caption = line.split('|', 1)
    p = os.path.join(shots, name + '.png')
    if os.path.exists(p): items.append((name, caption.strip(), p))
    else: print('missing', name)

pages = []
# title page
t = Image.new('RGB', A4, WHITE); d = ImageDraw.Draw(t)
d.rectangle([0, 0, A4[0], 900], fill=NAVY)
d.text((200, 330), 'HausBaus', font=F(150, True), fill=WHITE)
d.text((200, 520), 'Mobile app — first design, all screens', font=F(64), fill=(203, 213, 225))
d.text((200, 1050), 'iOS + Android (Expo / React Native) on the existing HausBaus API', font=F(52), fill=NAVY)
y = 1250
d.text((200, y), 'Contents', font=F(56, True), fill=NAVY); y += 110
for i, (_, cap, _) in enumerate(items, 1):
    if y > A4[1] - 200: break
    d.text((220, y), f'{i:02d}  {cap}', font=F(40), fill=GREY); y += 58
pages.append(t)

PH = 2300  # phone height on page
for i in range(0, len(items), 2):
    pg = Image.new('RGB', A4, WHITE); d = ImageDraw.Draw(pg)
    d.rectangle([0, 0, A4[0], 140], fill=NAVY)
    d.text((120, 40), 'Mobile app — All screens', font=F(48, True), fill=WHITE)
    d.text((A4[0] - 420, 46), f'page {len(pages)}', font=F(40), fill=(203, 213, 225))
    for k, (name, cap, p) in enumerate(items[i:i + 2]):
        im = Image.open(p).convert('RGB')
        w = int(im.width * PH / im.height); im = im.resize((w, PH), Image.LANCZOS)
        x = 160 + k * 1160; y = 330
        # phone frame
        d.rounded_rectangle([x - 28, y - 28, x + w + 28, y + PH + 28], radius=90, fill=(15, 23, 41))
        pg.paste(im, (x, y))
        # caption wrapped to the column so it never runs under the neighbouring screen
        label = f'{i + k + 1:02d}  {cap}'; font = F(40, True); maxw = w + 40; lines = []; cur = ''
        for word in label.split(' '):
            trial = (cur + ' ' + word).strip()
            if d.textlength(trial, font=font) <= maxw or not cur: cur = trial
            else: lines.append(cur); cur = word
        lines.append(cur)
        for n, ln in enumerate(lines[:3]): d.text((x, y + PH + 70 + n * 52), ln, font=font, fill=NAVY)
        im.resize((540, int(540 * PH / w)), Image.LANCZOS).save(os.path.join(out_png, f'{name}.png'), optimize=True)
    pages.append(pg)

pages[0].save(out_pdf, save_all=True, append_images=pages[1:], resolution=300)
print('pdf', out_pdf, 'pages', len(pages), 'screens', len(items))
