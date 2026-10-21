"""Prepares the eight 'years' photos for the home-page story (1600x900, soft navy/gold grade that keeps the photo visible).
Usage: python3 grade_story.py <dir with source PNGs: lane workshop b crowd showcase d sign c>"""
import sys, numpy as np
from PIL import Image, ImageOps, ImageFilter, ImageEnhance
src = sys.argv[1].rstrip('/') + '/'
OUT = 'assets/img/story/'
W, H = 1600, 900
stops = [(0, (10, 19, 48)), (.38, (32, 53, 101)), (.72, (197, 162, 140)), (1, (244, 240, 232))]
xs = np.linspace(0, 1, 256)
LUT = np.stack([np.interp(xs, [q[0] for q in stops], [q[1][c] for q in stops]) for c in range(3)], 1)
rng = np.random.default_rng(11)

def cover(im, w, h, fx=.5, fy=.5):
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s) + 1, int(im.height * s) + 1), Image.LANCZOS)
    x = int((im.width - w) * fx); y = int((im.height - h) * fy)
    return im.crop((x, y, x + w, y + h))

def soft_grade(im, mix=.5, gamma=1.0):
    """mix = share of the navy/gold duotone; the rest is the photo's own (softened) colour."""
    gray = ImageOps.autocontrast(ImageOps.grayscale(im), cutoff=1.2).filter(ImageFilter.UnsharpMask(2, 55, 2))
    a = (np.asarray(gray) / 255.0) ** gamma
    duo = LUT[(a * 255).astype(np.uint8)]
    col = ImageOps.autocontrast(im, cutoff=1.0)
    col = ImageEnhance.Color(col).enhance(.78).filter(ImageFilter.UnsharpMask(2, 45, 2))
    col = np.asarray(col).astype(float)
    out = duo * mix + col * (1 - mix)
    yy, xx = np.mgrid[0:im.height, 0:im.width]
    d = np.sqrt(((xx - im.width / 2) / (im.width * .62)) ** 2 + ((yy - im.height / 2) / (im.height * .7)) ** 2)
    out *= (1 - 0.22 * np.clip(d - 0.55, 0, 1)[..., None] * 1.6)
    out += rng.normal(0, 3.2, out.shape[:2])[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

def save(name, im):
    im.save(f'{OUT}{name}.jpg', quality=76, optimize=True, progressive=True); print(name)

def land(name, f, fx=.5, fy=.5, mix=.5, gamma=1.0, box=None):
    im = Image.open(src + f).convert('RGB')
    if box: im = im.crop((int(box[0] * im.width), int(box[1] * im.height), int(box[2] * im.width), int(box[3] * im.height)))
    save(name, soft_grade(cover(im, W, H, fx, fy), mix, gamma))

def portrait_right(name, f, box, mix=.8):
    im = Image.open(src + f).convert('RGB'); x0, y0, x1, y1 = box
    im = im.crop((int(x0 * im.width), int(y0 * im.height), int(x1 * im.width), int(y1 * im.height)))
    fg = soft_grade(im.resize((int(im.width * H / im.height), H), Image.LANCZOS), mix)
    arr = np.asarray(fg).astype(float); fw = fg.width
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt(((xx - W * .72) / (W * .55)) ** 2 + ((yy - H * .45) / (H * .8)) ** 2)
    canvas = np.array([12, 25, 59.]) + (np.array([32, 53, 101.]) - np.array([12, 25, 59.])) * np.clip(1 - d, 0, 1)[..., None] * .9
    mask = np.ones((H, fw)); fe = int(fw * .28)
    mask[:, :fe] = np.linspace(0, 1, fe)[None, :] ** 1.4; ft = int(fw * .1); mask[:, -ft:] *= np.linspace(1, 0, ft)[None, :]
    x0p = int(W * .60); x1p = min(W, x0p + fw); cw = x1p - x0p
    canvas[:, x0p:x1p] = canvas[:, x0p:x1p] * (1 - mask[:, :cw, None]) + arr[:, :cw] * mask[:, :cw, None]
    canvas += rng.normal(0, 3, canvas.shape[:2])[..., None]
    save(name, Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8)))

def portrait_center(name, f, box, mix=.8):
    """Whole portrait kept in frame (no heavy zoom): sharp in the centre, softly blurred navy fill at the sides."""
    im = Image.open(src + f).convert('RGB'); x0, y0, x1, y1 = box
    im = im.crop((int(x0 * im.width), int(y0 * im.height), int(x1 * im.width), int(y1 * im.height)))
    fg = soft_grade(im.resize((int(im.width * H / im.height), H), Image.LANCZOS), mix)
    yy, xx = np.mgrid[0:H, 0:W]; d = np.sqrt(((xx - W / 2) / (W * .5)) ** 2 + ((yy - H * .45) / (H * .7)) ** 2)
    bg = np.array([12, 25, 59.]) + (np.array([40, 64, 118.]) - np.array([12, 25, 59.])) * np.clip(1 - d, 0, 1)[..., None] * .8
    arr = np.asarray(fg).astype(float); fw = fg.width
    mask = np.ones((H, fw)); fe = int(fw * .16)
    mask[:, :fe] = np.linspace(0, 1, fe)[None, :]; mask[:, -fe:] *= np.linspace(1, 0, fe)[None, :]
    xs0 = (W - fw) // 2
    bg[:, xs0:xs0 + fw] = bg[:, xs0:xs0 + fw] * (1 - mask[..., None]) + arr * mask[..., None]
    bg += rng.normal(0, 3, bg.shape[:2])[..., None]
    save(name, Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8)))

land('y1983', 'lane.png', .5, .5, mix=.3)
land('y1985', 'workshop.png', .5, .42, mix=.6)           # black-and-white source: lean on the duotone
land('y1988', 'crowd.png', .5, .5, mix=.2)
portrait_center('y1997', 'b.png', (0.05, 0.05, 0.95, 0.9), mix=.6)
land('y2002', 'showcase.png', .5, .5, mix=.2)
land('y2008', 'd.png', .5, .5, mix=.25)
land('y2013', 'c.png', .5, .22, mix=.3)
land('y2023', 'sign.png', .5, .41, mix=.25)
land('y2026', 'interior.png', .5, .42, mix=.15)
