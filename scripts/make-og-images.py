"""Builds 1200x630 link-preview images (og:image) into public/og/.

One per work item (public/og/<id>.jpg, cropped from its thumbnail) plus
public/og/site.jpg for the rest of the site. Re-run after adding or
changing items:  python3 scripts/make-og-images.py   (needs Pillow)
Existing images are skipped unless the source is newer; pass --force to redo all.
"""
import json, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'og'
W, H = 1200, 630
BG = (244, 245, 250)  # --paper
force = '--force' in sys.argv


def cover(src, dest, anchor_y):
    """Scale to fill 1200x630, then crop. anchor_y: 0 = keep the top, 0.5 = center."""
    if dest.exists() and not force and dest.stat().st_mtime >= src.stat().st_mtime:
        return False
    im = Image.open(src)
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        flat = Image.new('RGB', im.size, BG)
        flat.paste(im, mask=im.getchannel('A'))
        im = flat
    im = im.convert('RGB')
    scale = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    x = (im.width - W) // 2
    y = round((im.height - H) * anchor_y)
    im.crop((x, y, x + W, y + H)).save(dest, 'JPEG', quality=82, optimize=True, progressive=True)
    return True


OUT.mkdir(exist_ok=True)
made = 0
work = json.loads((ROOT / 'src/data/work.json').read_text())
for item in work:
    thumb = item.get('thumbnail') or ''
    src = ROOT / 'public' / thumb.lstrip('/')
    if not thumb.startswith('/') or not src.exists():
        print(f"skip {item['id']}: no local thumbnail")
        continue
    anchor = 0.5 if item.get('thumbPosition') == 'center' else 0.0
    made += cover(src, OUT / f"{item['id']}.jpg", anchor)



def portrait_card(src, dest):
    """Whole portrait centered on a blurred, enlarged copy of itself."""
    if dest.exists() and not force and dest.stat().st_mtime >= src.stat().st_mtime:
        return False
    from PIL import ImageFilter
    im = Image.open(src).convert('RGB')
    s = max(W / im.width, H / im.height)
    bg = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (bg.width - W) // 2, round((bg.height - H) * 0.3)
    bg = bg.crop((x, y, x + W, y + H)).filter(ImageFilter.GaussianBlur(28))
    fg = im.resize((round(im.width * H / im.height), H), Image.LANCZOS)
    bg.paste(fg, ((W - fg.width) // 2, 0))
    bg.save(dest, 'JPEG', quality=82, optimize=True, progressive=True)
    return True


made += portrait_card(ROOT / 'public' / 'miguel-ortiz.jpg', OUT / 'site.jpg')
print(f'{made} image(s) written to public/og/')
