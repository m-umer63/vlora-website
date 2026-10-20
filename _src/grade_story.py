"""Grades the story photos into one navy/gold monotone look. Usage: python3 grade_story.py <src_dir> (expects the named files)."""
import sys, numpy as np
from PIL import Image, ImageOps, ImageFilter
src = sys.argv[1]
OUT = 'assets/img/story/'
# name, file, crop box as fractions (x0,y0,x1,y1) of the source, brightness gamma
JOBS = [('1', 'souq1989.png', (0.24, 0, 0.24 + 0.5385, 1), 1.0),
        ('2', 'b.png', (0, 0.04, 1, 0.04 + 1459*1.25/2053), 1.0),
        ('3', 'f.png', (0.22, 0, 0.22 + 388*0.8/720, 1), 0.9),
        ('4', 'd.png', (0.08, 0, 0.08 + 1932*0.8/2576, 1), 1.0),
        ('5', 'c.png', (0, 0, 1, 1932*1.25/1932*0 + 0.9375), 1.0)]
NAMES = ['1983', 'founder', 'craft', 'branches', 'today']
stops = [(0, (10, 19, 48)), (.38, (32, 53, 101)), (.72, (197, 162, 140)), (1, (244, 240, 232))]
def lut():
    xs = np.linspace(0, 1, 256); out = np.zeros((256, 3))
    for c in range(3):
        out[:, c] = np.interp(xs, [s[0] for s in stops], [s[1][c] for s in stops])
    return out.astype(np.uint8)
L = lut(); rng = np.random.default_rng(7)
for (k, f, box, g), nm in zip(JOBS, NAMES):
    im = Image.open(f'{src}/{f}').convert('RGB'); W, H = im.size
    x0, y0, x1, y1 = box
    im = im.crop((int(x0*W), int(y0*H), int(min(x1, 1)*W), int(min(y1, 1)*H)))
    im = im.resize((1000, 1250), Image.LANCZOS)
    gray = ImageOps.autocontrast(ImageOps.grayscale(im), cutoff=1.5)
    gray = gray.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    a = (np.asarray(gray) / 255.0) ** g
    # soft vignette
    yy, xx = np.mgrid[0:1250, 0:1000]
    d = np.sqrt(((xx-500)/560)**2 + ((yy-625)/700)**2)
    a = a * (1 - 0.38*np.clip(d-0.45, 0, 1)**1.3*1.6)
    a = np.clip(a + rng.normal(0, 0.018, a.shape), 0, 1)
    rgb = L[(a*255).astype(np.uint8)]
    Image.fromarray(rgb).save(f'{OUT}{nm}.jpg', quality=82, optimize=True, progressive=True)
    print(nm)
