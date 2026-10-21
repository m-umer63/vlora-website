#!/usr/bin/env python3
"""VLORÁ site builder. Turns _src/data/products.json + site.json into the finished static website.

Usage:
  python3 _src/build.py                 # builds the live site into the repo root
  python3 _src/build.py --out /tmp/x --preview   # preview build (links end in index.html so it works anywhere)
"""
import argparse, html, json, os, re, shutil, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ap = argparse.ArgumentParser()
ap.add_argument('--out', default=ROOT)
ap.add_argument('--preview', action='store_true')
ARGS = ap.parse_args()
OUT = os.path.abspath(ARGS.out)
SUF = 'index.html' if ARGS.preview else ''

SITE = json.load(open(os.path.join(HERE, 'data', 'site.json'), encoding='utf-8'))
PRODUCTS = json.load(open(os.path.join(HERE, 'data', 'products.json'), encoding='utf-8'))
CATEGORIES = ['Rings', 'Earrings', 'Necklaces', 'Bracelets', 'Bangles', 'Pendants', 'Watches']
CAT_SLUG = {c: c.lower() for c in CATEGORIES}
METAL_COL = {'Yellow Gold': '#C6A75E', 'White Gold': '#d6dae4', 'Rose Gold': '#C5A28C', 'Platinum': '#d9dce3',
             'Silver': '#cfd3da', 'Titanium': '#8f98a8', 'Other': '#C6A75E'}
esc = html.escape


def money(v): return f"AED {v:,.0f}"
def depth_of(path): return path.count('/')
def base(d): return ('../' * d) or './'
def link(d, path=''): return base(d) + path + SUF
def asset(d, path): return base(d) + path


def sub_line(p):
    bits = []
    if p.get('metal'):
        bits.append((f"{p['purity']}K " if p.get('purity') else '') + p['metal'])
    if p.get('stone'):
        bits.append(p['stone'])
    return ' · '.join(bits)


# ---------------------------------------------------------------- placeholder pictures
def gem(cx, cy, w, h, c, col, sw=5):
    pts = [(cx - w / 2 + c, cy - h / 2), (cx + w / 2 - c, cy - h / 2), (cx + w / 2, cy - h / 2 + c), (cx + w / 2, cy + h / 2 - c),
           (cx + w / 2 - c, cy + h / 2), (cx - w / 2 + c, cy + h / 2), (cx - w / 2, cy + h / 2 - c), (cx - w / 2, cy - h / 2 + c)]
    k = 0.58
    ip = [(cx + (x - cx) * k, cy + (y - cy) * k) for x, y in pts]
    f = lambda a: ' '.join(f'{x:.1f},{y:.1f}' for x, y in a)
    lines = ''.join(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}"/>' for a, b in zip(pts, ip))
    return (f'<g fill="none" stroke="{col}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round">'
            f'<polygon points="{f(pts)}"/><polygon points="{f(ip)}"/>{lines}</g>')


def icon(cat, m, g):
    sw = 9
    if cat == 'Rings':
        return (f'<circle cx="200" cy="248" r="92" fill="none" stroke="{m}" stroke-width="{sw}"/>'
                f'<circle cx="200" cy="248" r="76" fill="none" stroke="{m}" stroke-width="3" opacity=".5"/>' + gem(200, 128, 74, 92, 17, g))
    if cat == 'Earrings':
        out = ''
        for x in (130, 270):
            out += f'<line x1="{x}" y1="70" x2="{x}" y2="150" stroke="{m}" stroke-width="{sw - 3}" stroke-linecap="round"/>' + gem(x, 205, 58, 76, 14, g, 4.5)
        return out
    if cat == 'Necklaces':
        return (f'<path d="M62 92 Q200 330 338 92" fill="none" stroke="{m}" stroke-width="{sw - 3}" stroke-linecap="round" stroke-dasharray="2 9"/>'
                f'<path d="M62 92 Q200 330 338 92" fill="none" stroke="{m}" stroke-width="3" opacity=".6"/>' + gem(200, 262, 56, 72, 13, g, 4.5))
    if cat == 'Bracelets':
        return (f'<ellipse cx="200" cy="205" rx="138" ry="92" fill="none" stroke="{m}" stroke-width="{sw - 3}" stroke-dasharray="3 12" stroke-linecap="round"/>'
                f'<ellipse cx="200" cy="205" rx="138" ry="92" fill="none" stroke="{m}" stroke-width="3" opacity=".5"/>' + gem(200, 300, 52, 66, 12, g, 4.5))
    if cat == 'Bangles':
        return (f'<ellipse cx="200" cy="205" rx="140" ry="104" fill="none" stroke="{m}" stroke-width="22"/>'
                f'<ellipse cx="200" cy="205" rx="140" ry="104" fill="none" stroke="{g}" stroke-width="2" opacity=".5"/>')
    if cat == 'Pendants':
        return (f'<circle cx="200" cy="82" r="20" fill="none" stroke="{m}" stroke-width="{sw - 3}"/>'
                f'<line x1="200" y1="102" x2="200" y2="140" stroke="{m}" stroke-width="{sw - 3}" stroke-linecap="round"/>' + gem(200, 232, 92, 114, 22, g, 5.5))
    # Watches
    return (f'<rect x="162" y="40" width="76" height="320" rx="10" fill="none" stroke="{m}" stroke-width="3" opacity=".55"/>'
            f'<circle cx="200" cy="200" r="88" fill="none" stroke="{m}" stroke-width="{sw}"/><circle cx="200" cy="200" r="70" fill="none" stroke="{g}" stroke-width="2" opacity=".6"/>'
            f'<line x1="200" y1="200" x2="200" y2="148" stroke="{g}" stroke-width="5" stroke-linecap="round"/><line x1="200" y1="200" x2="236" y2="214" stroke="{g}" stroke-width="5" stroke-linecap="round"/>'
            f'<circle cx="200" cy="200" r="6" fill="{g}"/>')


def placeholder_svg(p, variant):
    metal = METAL_COL.get(p.get('metal'), '#C6A75E')
    if variant == 'a':
        bg0, bg1, g = '#203565', '#0D1E3B', '#fafbee'
    else:
        bg0, bg1, g = '#F4F0E8', '#E8DCC8', '#0c193b'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="{esc(p["name"])} (placeholder picture)">'
            f'<defs><radialGradient id="b" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="{bg0}"/><stop offset="1" stop-color="{bg1}"/></radialGradient></defs>'
            f'<rect width="400" height="400" fill="url(#b)"/>{icon(p["category"], metal, g)}</svg>')


# ---------------------------------------------------------------- shared chrome
def img_tag(d, p, i=0, cls='', lazy=True):
    f = p['images'][min(i, len(p['images']) - 1)] if p.get('images') else ''
    return f'<img src="{asset(d, "assets/img/products/" + f)}" alt="{esc(p["name"])}" width="400" height="400"{" loading=lazy" if lazy else ""}{(" class=" + cls) if cls else ""}>'


def card(d, p):
    href = link(d, f"products/{p['slug']}/")
    two = len(p.get('images', [])) > 1
    sample = '<span class="tag tag-sample">Sample</span>' if p.get('sample') else ''
    newt = '<span class="tag tag-new">New</span>' if p.get('new') and not p.get('sample') else ''
    return (f'<article class="card" data-sku="{esc(p["sku"])}" data-metal="{esc(p["metal"])}" data-price="{p["price"]}" data-name="{esc(p["name"].lower())}" data-new="{1 if p.get("new") else 0}">'
            f'<a class="card-media" href="{href}" aria-label="{esc(p["name"])}">{img_tag(d, p, 0)}{img_tag(d, p, 1, "alt") if two else ""}</a>'
            f'<button class="heart" data-wish="{esc(p["sku"])}" aria-label="Save {esc(p["name"])} to wishlist" aria-pressed="false">'
            '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>'
            f'{sample}{newt}'
            f'<div class="card-body"><h3><a href="{href}">{esc(p["name"])}</a></h3><p class="sub">{esc(sub_line(p))}</p><p class="price">{money(p["price"])}</p></div>'
            f'<div class="card-actions"><button class="btn btn-small" data-add="{esc(p["sku"])}">Add to bag</button>'
            f'<button class="btn btn-small btn-ghost" data-quick="{esc(p["sku"])}">Quick view</button></div></article>')


ICON = {
    'search': '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5" stroke-linecap="round"/></svg>',
    'heart': '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/></svg>',
    'bag': '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 8h14l-1 12H6L5 8z" stroke-linejoin="round"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
    'menu': '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round"/></svg>',
    'close': '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 5l14 14M19 5L5 19" stroke-linecap="round"/></svg>',
    'wa': '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.6.1a6.700 6.700 0 0 1-3.300-2.900c-.2-.4.2-.4.700-1.300a.5.5 0 0 0 0-.5l-.8-1.800c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.200 5.200 5.200 0 0 0 1.100 2.800 11.900 11.900 0 0 0 4.600 4 15.600 15.600 0 0 0 1.600.6 3.800 3.800 0 0 0 1.800.1 3 3 0 0 0 2-1.400 2.500 2.500 0 0 0 .2-1.400c-.1-.1-.3-.2-.5-.3z"/></svg>',
}


def wa_link(text=''):
    from urllib.parse import quote
    return f"https://wa.me/{SITE['whatsapp']}" + (f"?text={quote(text)}" if text else '')


def header(d, current=''):
    cats = ''.join(f'<li><a href="{link(d, "collections/" + CAT_SLUG[c] + "/")}">{c}</a></li>' for c in CATEGORIES if c != 'Watches')
    mobcats = ''.join(f'<a href="{link(d, "collections/" + CAT_SLUG[c] + "/")}">{c}</a>' for c in CATEGORIES)
    return f'''<a class="skip" href="#main">Skip to content</a>
<div class="announce"><span>Expert Craftsmanship since {SITE["since"]} &middot; Dubai</span></div>
<header class="site-header" id="top">
  <div class="hdr">
    <div class="hdr-left"><button class="icon-btn menu-btn" data-open="menu" aria-label="Open menu">{ICON["menu"]}</button>
    <nav class="nav nav-left" aria-label="Main">
      <a href="{link(d, "collections/gold/")}">Gold</a>
      <a href="{link(d, "collections/diamond/")}">Diamond</a>
      <a href="{link(d, "pages/bespoke/")}">Bespoke</a>
    </nav></div>
    <a class="brand" href="{link(d)}" aria-label="VLORÁ home"><img src="{asset(d, "assets/img/vlora-logo-navy.svg")}" alt="VLORÁ" width="176" height="56"><span class="brand-year">{SITE["since"]}</span></a>
    <div class="hdr-right"><nav class="nav nav-right" aria-label="Secondary">
      <a href="{link(d, "pages/about/")}">About</a><a href="{link(d, "pages/contact/")}">Contact</a>
    </nav>
    <div class="tools">
      <button class="icon-btn" data-open="search" aria-label="Search">{ICON["search"]}</button>
      <a class="icon-btn" href="{link(d, "wishlist/")}" aria-label="Wishlist">{ICON["heart"]}<span class="count" data-wish-count hidden>0</span></a>
      <button class="icon-btn" data-open="bag" aria-label="Open shopping bag">{ICON["bag"]}<span class="count" data-bag-count hidden>0</span></button>
    </div></div>
  </div>
</header>
<div class="scrim" data-close></div>
<aside class="drawer drawer-left" id="menu-drawer" aria-label="Menu" aria-hidden="true">
  <div class="drawer-head"><span class="eyebrow">Menu</span><button class="icon-btn" data-close aria-label="Close">{ICON["close"]}</button></div>
  <nav class="mob-nav"><a href="{link(d, "collections/gold/")}">Gold</a><a href="{link(d, "collections/diamond/")}">Diamond</a><a href="{link(d, "pages/bespoke/")}">Bespoke</a><hr><a href="{link(d, "collections/all/")}">All jewellery</a>{mobcats}
  <a href="{link(d, "collections/new-arrivals/")}">New arrivals</a><hr>
  <a href="{link(d, "pages/about/")}">About</a><a href="{link(d, "pages/care-guide/")}">Care guide</a><a href="{link(d, "pages/faq/")}">FAQ</a><a href="{link(d, "pages/contact/")}">Contact</a><a href="{link(d, "wishlist/")}">Wishlist</a></nav>
</aside>
<div class="search-panel" id="search-panel" aria-hidden="true">
  <div class="search-in"><form role="search" onsubmit="return false"><input id="search-input" type="search" placeholder="Search by name, metal or reference" autocomplete="off" aria-label="Search"><button class="icon-btn" type="button" data-close aria-label="Close search">{ICON["close"]}</button></form>
  <div id="search-results" class="search-results" aria-live="polite"></div></div>
</div>
<aside class="drawer drawer-right" id="bag-drawer" aria-label="Shopping bag" aria-hidden="true">
  <div class="drawer-head"><span class="eyebrow">Your bag</span><button class="icon-btn" data-close aria-label="Close bag">{ICON["close"]}</button></div>
  <div class="bag-body" id="bag-body"></div>
  <div class="bag-foot" id="bag-foot"></div>
</aside>
<div class="modal" id="quick" role="dialog" aria-modal="true" aria-label="Quick view" aria-hidden="true"><div class="modal-box" id="quick-box"></div></div>
'''


def footer(d):
    cat = ''.join(f'<li><a href="{link(d, "collections/" + CAT_SLUG[c] + "/")}">{c}</a></li>' for c in CATEGORIES)
    soc = ''
    if SITE.get('instagram'): soc += f'<li><a href="{esc(SITE["instagram"])}" rel="noopener">Instagram</a></li>'
    if SITE.get('facebook'): soc += f'<li><a href="{esc(SITE["facebook"])}" rel="noopener">Facebook</a></li>'
    return f'''<footer class="site-footer">
  <div class="foot-grid">
    <div class="foot-brand"><img src="{asset(d, "assets/img/vlora-logo-cream.svg")}" alt="VLORÁ" width="220" height="70"><p class="logo-sub">JEWELRY &amp; WATCHES</p>
      <p class="foot-note">{esc(SITE["legal_name"])}<br>Dubai, United Arab Emirates</p></div>
    <div><h4>The house</h4><ul><li><a href="{link(d, "pages/about/")}">About</a></li><li><a href="{link(d, "pages/care-guide/")}">Care guide</a></li><li><a href="{link(d, "pages/faq/")}">FAQ</a></li>{soc}</ul></div>
    <div><h4>Client services</h4><ul><li><a href="{link(d, "pages/contact/")}">Contact</a></li><li><a href="{link(d, "pages/shipping-returns/")}">Shipping &amp; returns</a></li><li><a href="{link(d, "wishlist/")}">Wishlist</a></li></ul></div>
    <div><h4>Shop</h4><ul>{cat}</ul></div>
    <div><h4>Visit &amp; contact</h4><ul class="plain"><li>{esc(SITE["address"])}</li><li>{esc(SITE["hours"])}</li>
      <li><a href="tel:{re.sub(r"[^+0-9]", "", SITE["phone_display"])}">{esc(SITE["phone_display"])}</a></li><li><a href="mailto:{esc(SITE["email"])}">{esc(SITE["email"])}</a></li>
      <li><a class="wa" href="{wa_link()}" rel="noopener">{ICON["wa"]} WhatsApp us</a></li></ul></div>
  </div>
  <div class="foot-base"><span>&copy; {datetime.date.today().year} {esc(SITE["legal_name"])}. All rights reserved.</span>
    <span><a href="{link(d, "pages/privacy/")}">Privacy</a> &middot; <a href="{link(d, "pages/terms/")}">Terms</a></span></div>
</footer>
'''


PAGES = []  # for sitemap


def write(path, content):
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w', encoding='utf-8').write(content)


def shell(path, title, desc, body, extra_head='', body_class='', noindex=False, in_sitemap=True):
    d = depth_of(path)
    canon = SITE['domain'] + '/' + path.replace('index.html', '')
    if in_sitemap: PAGES.append(canon)
    ttl = title if title.startswith('VLORÁ') else f'{title} | VLORÁ'
    robots = '<meta name="robots" content="noindex">' if noindex else ''
    html_ = f'''<!doctype html>
<html lang="en" class="no-js" data-root="{base(d)}" data-suf="{SUF}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(ttl)}</title>
<meta name="description" content="{esc(desc)}">
{robots}<link rel="canonical" href="{esc(canon)}">
<meta property="og:type" content="website"><meta property="og:title" content="{esc(ttl)}"><meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{esc(canon)}"><meta property="og:site_name" content="VLORÁ">
<meta name="theme-color" content="#0c193b">
<link rel="icon" type="image/svg+xml" href="{asset(d, "assets/img/favicon.svg")}">
<link rel="preload" href="{asset(d, "assets/fonts/gilda-display-latin-400-normal.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{asset(d, "assets/fonts/montserrat-latin-400-normal.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{asset(d, "assets/css/site.css")}">
{extra_head}
</head>
<body class="{body_class}">
{header(d)}
<main id="main">
{body}
</main>
{footer(d)}
<script src="{asset(d, "assets/js/data.js")}"></script>
<script src="{asset(d, "assets/js/site.js")}" defer></script>
</body>
</html>
'''
    write(path, html_)


def crumbs(d, items):
    out = f'<a href="{link(d)}">Home</a>'
    for label, p in items:
        out += ' <span>/</span> ' + (f'<a href="{link(d, p)}">{label}</a>' if p else f'<span aria-current="page">{label}</span>')
    return f'<nav class="crumbs" aria-label="Breadcrumb">{out}</nav>'


# ---------------------------------------------------------------- pages
def gem_svg(cls):
    s = open(os.path.join(ROOT, 'assets/img/vlora-symbol-navy.svg'), encoding='utf-8').read()
    out = ''
    for i, p in enumerate(re.findall(r'<path[^>]*/>', s)):
        out += p.replace('stroke="#0c193b"', 'stroke="currentColor"').replace('<path ', f'<path pathLength="1" style="--i:{i}" ')
    return f'<svg class="{cls}" viewBox="658 44 342 420" aria-hidden="true" focusable="false">{out}</svg>'


def page_home():
    d = 0
    newp = [p for p in PRODUCTS if p.get('new')][:10] or PRODUCTS[:8]
    tiles = ''
    for c in CATEGORIES[:6]:
        n = sum(1 for p in PRODUCTS if p['category'] == c)
        sample = next((p for p in PRODUCTS if p['category'] == c), None)
        pic = img_tag(d, sample, 0) if sample else ''
        tiles += (f'<a class="tile" href="{link(d, "collections/" + CAT_SLUG[c] + "/")}"><div class="tile-media">{pic}</div>'
                  f'<div class="tile-cap"><h3>{c}</h3><span>{n} pieces</span></div></a>')
    # "years" story: huge numerals roll from 1983 to 2026 with the photographs living inside the digits (canvas, see site.js initYears)
    years = [
        (1983, 'y1983', 'The beginning', 'Adnan Al Khaja Gold Smithing', 'Our parent company opens its doors in the Gold Souq.', 'Dubai Gold Souq lane in the early years'),
        (1985, 'y1985', 'Growing', 'Casting for the region', 'The business expands into gold casting, supplying jewellers across the region.', 'Jeweller working on a ring at the bench'),
        (1988, 'y1988', 'Deira', 'A souq takes shape', 'In the streets of Deira, the Gold Souq begins to form and the trade gathers around it.', 'Evening crowds in the Gold Souq'),
        (1997, 'y1997', 'The founder', 'Akbar Khan', 'An experienced goldsmith, and the man who started it all.', 'Portrait of Akbar Khan, founder of VLORÁ'),
        (2002, 'y2002', 'Dubai', 'The city of gold', 'Dubai becomes known as the city of gold, with the Gold Souq at the heart of it.', 'Gold bangles and necklaces in a souq showcase'),
        (2008, 'y2008', 'VLOR&Aacute;', 'Our first branch', 'VLOR&Aacute; opens its first retail branch, to serve customers directly.', 'A VLORÁ branch in the Gold Souq'),
        (2013, 'y2013', 'VLOR&Aacute;', 'A second branch', 'A second branch follows, offering handcrafted gold and diamond jewellery.', 'The VLORÁ shopfront'),
        (2023, 'y2023', 'Manufacturing', 'Partner to 100+ brands', 'VLOR&Aacute; now manufactures for more than 100 brands around the world.', 'The Gold Souq walkway'),
        (2026, 'y2026', 'Now online', 'Made for you', 'VLOR&Aacute; goes online, crafting exclusive pieces for individual clients.', 'The Gold Souq today')]
    yr_caps = ''.join(f'<div class="yrs-cap{" is-on" if i == 0 else ""}" data-yrs-cap><span class="yrs-k">{lab}</span><h3>{t}</h3><p>{x}</p></div>' for i, (y, f, lab, t, x, alt) in enumerate(years))
    yr_fb = ''.join(f'<figure class="yrs-fig"><img src="{asset(d, f"assets/img/story/{f}.jpg")}" alt="{alt}" width="1600" height="900" loading="lazy" decoding="async"><figcaption><b>{y}</b><span>{t}</span><em>{x}</em></figcaption></figure>' for (y, f, lab, t, x, alt) in years)
    trans_lab = '<div class="trans-lab" data-trans-lab><b>Photo transition</b></div>' if ARGS.preview else ''
    yr_srcs = ','.join(asset(d, f'assets/img/story/{f}.jpg') for (y, f, lab, t, x, alt) in years)
    yr_years = ','.join(str(y) for (y, *_r) in years)
    body = f'''
<section class="hero2" data-hero2>
  <div class="hero2-bg" aria-hidden="true">
    <img class="hero2-poster" src="{asset(d, "assets/video/hero-poster.jpg")}" alt="" width="1280" height="720">
    <video class="hero2-video" muted loop playsinline preload="auto" poster="{asset(d, "assets/video/hero-poster.jpg")}" data-src="{asset(d, "assets/video/hero.mp4")}" data-src-m="{asset(d, "assets/video/hero-m.mp4")}" disablepictureinpicture tabindex="-1"></video>
    <span class="hero2-shade"></span>
  </div>
  <div class="hero2-in">
    <div class="hero2-copy">
      <h1 class="h-hero"><span class="line" style="--i:0"><span>Where imagination</span></span><span class="line gold" style="--i:1"><span>finds form.</span></span></h1>
      <p class="lede rise" style="--i:3"><span class="nb">Your vision, our craftsmanship.</span> <span class="nb">Let&rsquo;s create something extraordinary.</span></p>
      <div class="cta-row rise" style="--i:4"><a class="btn btn-gold" href="{link(d, "pages/bespoke/")}">Discover Bespoke</a><a class="link-light" href="{link(d, "pages/about/")}">Our story</a></div>
    </div>
  </div>
  <div class="scroll-cue" aria-hidden="true"><span>Scroll</span><i></i></div>
</section>

<section class="statement"><div class="wrap">
  <p class="eyebrow">From our founder</p>
  <figure class="quote">
    <span class="qmark" aria-hidden="true">&ldquo;</span>
    <blockquote><p class="words" data-words>Create what reflects you, not what resembles the world.</p></blockquote>
    <figcaption class="sig"><span class="sig-line" aria-hidden="true"></span><span class="sig-name">Akbar Khan</span><span class="sig-role">Founder &amp; Chairman, VLORÁ Jewellery</span></figcaption>
  </figure>
</div></section>

<section class="yrs" data-yrs data-years="{yr_years}" data-srcs="{yr_srcs}" aria-label="Our story, 1983 to 2026">
  <div class="yrs-stage">
    <canvas class="yrs-canvas" data-yrs-canvas aria-hidden="true"></canvas>
    <div class="yrs-ov">
      <div class="yrs-caps">{yr_caps}</div>
      <div class="yrs-idx" data-yrs-idx aria-hidden="true">01 / 09</div>
      <div class="yrs-final" data-yrs-final><div><h2>Now, wherever you are.</h2><a class="btn btn-gold" href="{link(d, "collections/gold/")}">Discover the collections</a></div></div>
      <div class="yrs-hint" data-yrs-hint aria-hidden="true">Scroll</div>
      {trans_lab}
    </div>
  </div>
  <div class="yrs-fb">{yr_fb}</div>
</section>

<section class="section"><div class="wrap"><header class="sec-head reveal"><p class="eyebrow">Shop</p><h2 class="h-lg">Our collections</h2></header>
  <div class="tiles reveal">{tiles}</div></div></section>

<section class="section section-sand"><div class="wrap"><header class="sec-head reveal"><p class="eyebrow">Just in</p><h2 class="h-lg">New arrivals</h2>
  <a class="more" href="{link(d, "collections/new-arrivals/")}">View all</a></header>
  <div class="rail-wrap reveal"><button class="rail-btn rail-prev" data-rail="-1" aria-label="Scroll left">&#8592;</button>
  <div class="rail grid-cards" data-rail-track>{"".join(card(d, p) for p in newp)}</div>
  <button class="rail-btn rail-next" data-rail="1" aria-label="Scroll right">&#8594;</button></div></div></section>

<section class="band-gold"><div class="wrap band-grid reveal">
  <div><h3>Order with a conversation</h3><p>Prefer to speak to someone? Message us on WhatsApp and we will help you choose.</p><a class="link-arrow" href="{wa_link("Hello VLORÁ, I would like some help choosing a piece.")}" rel="noopener">Chat on WhatsApp</a></div>
  <div><h3>Visit the showroom</h3><p>See the pieces in person in Dubai.</p><a class="link-arrow" href="{link(d, "pages/contact/")}">Find us</a></div>
  <div><h3>Look after your jewellery</h3><p>Simple habits that keep gold and stones looking their best.</p><a class="link-arrow" href="{link(d, "pages/care-guide/")}">Read the care guide</a></div>
</div></section>
'''
    ld = {"@context": "https://schema.org", "@type": "JewelryStore", "name": "VLORÁ", "legalName": SITE['legal_name'], "url": SITE['domain'],
          "foundingDate": SITE['since'], "address": {"@type": "PostalAddress", "addressLocality": "Dubai", "addressCountry": "AE"}}
    shell('index.html', 'VLORÁ | Fine Jewellery & Watches, Dubai',
          'VLORÁ is a family-run jewellery and watch house in Dubai, since 1983. Shop rings, earrings, necklaces, bracelets, bangles, pendants and watches.',
          body, f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>', 'home')


def page_collection(slug, title, intro, items):
    path = f'collections/{slug}/index.html'
    d = depth_of(path)
    metals = sorted({p['metal'] for p in items})
    prices = [p['price'] for p in items] or [0]
    mf = ''.join(f'<label class="chk"><input type="checkbox" name="metal" value="{esc(m)}"> {esc(m)}</label>' for m in metals)
    sub = ''.join(f'<a class="chip{" is-on" if CAT_SLUG.get(c) == slug else ""}" href="{link(d, "collections/" + CAT_SLUG[c] + "/")}">{c}</a>' for c in CATEGORIES)
    body = f'''
<section class="page-head"><div class="wrap">{crumbs(d, [("Shop", "collections/all/"), (title, None)] if slug != "all" else [("Shop", None)])}
  <h1 class="h-xl">{esc(title)}</h1><p class="lede">{esc(intro)}</p>
  <div class="chips"><a class="chip{" is-on" if slug == "all" else ""}" href="{link(d, "collections/all/")}">All</a>{sub}</div></div></section>
<section class="section tight"><div class="wrap">
  <div class="toolbar" id="toolbar" data-min="{min(prices)}" data-max="{max(prices)}">
    <button class="btn btn-ghost btn-small filter-toggle" id="filter-toggle" aria-expanded="false">Filter &amp; sort</button>
    <p class="result-count" id="result-count" aria-live="polite">{len(items)} pieces</p>
    <div class="filters" id="filters">
      <div class="f-group"><span class="f-label">Metal</span>{mf or '<span class="muted">-</span>'}</div>
      <div class="f-group"><label class="f-label" for="f-price">Price</label><select id="f-price"><option value="">Any price</option><option value="0-5000">Under AED 5,000</option>
        <option value="5000-10000">AED 5,000 to 10,000</option><option value="10000-20000">AED 10,000 to 20,000</option><option value="20000-999999">Over AED 20,000</option></select></div>
      <div class="f-group"><label class="f-label" for="f-sort">Sort</label><select id="f-sort"><option value="">Featured</option><option value="new">Newest first</option>
        <option value="asc">Price: low to high</option><option value="desc">Price: high to low</option><option value="name">Name A to Z</option></select></div>
      <div class="f-group"><label class="f-label" for="f-q">Find</label><input id="f-q" type="search" placeholder="Search this page" autocomplete="off"></div>
      <button class="btn btn-ghost btn-small" id="f-reset" type="button">Reset</button>
    </div>
  </div>
  <div class="grid-cards" id="grid" data-page-size="24">{"".join(card(d, p) for p in items) or '<p class="empty">New pieces are coming soon.</p>'}</div>
  <p class="no-results" id="no-results" hidden>No pieces match those filters. <button class="link-btn" id="f-reset2">Clear filters</button></p>
  <div class="more-wrap"><button class="btn" id="load-more" hidden>Show more</button></div>
</div></section>
'''
    shell(path, title, intro, body)


def page_product(p):
    path = f'products/{p["slug"]}/index.html'
    d = depth_of(path)
    thumbs = ''.join(f'<button class="thumb{" is-on" if i == 0 else ""}" data-thumb="{i}" aria-label="Show picture {i + 1}">{img_tag(d, p, i)}</button>' for i in range(len(p['images'])))
    mains = ''.join(f'<div class="pic{" is-on" if i == 0 else ""}" data-pic="{i}">{img_tag(d, p, i, lazy=(i > 0))}</div>' for i in range(len(p['images'])))
    spec = []
    if p.get('metal'): spec.append(('Metal', (f"{p['purity']}K " if p.get('purity') else '') + p['metal']))
    if p.get('stone'): spec.append(('Stone', p['stone'] + (f" ({p['stone_ct']} ct)" if p.get('stone_ct') else '')))
    if p.get('metal_g'): spec.append(('Metal weight', f"{p['metal_g']} g"))
    if p.get('collection'): spec.append(('Collection', p['collection']))
    spec.append(('Reference', p['sku']))
    specs = ''.join(f'<div><dt>{k}</dt><dd>{esc(str(v))}</dd></div>' for k, v in spec)
    related = [q for q in PRODUCTS if q['category'] == p['category'] and q['sku'] != p['sku']][:4]
    msg = f"Hello VLORÁ, I am interested in {p['name']} ({p['sku']}), {money(p['price'])}."
    sample = '<p class="sample-note">Sample listing for layout preview. Name, picture and price are placeholders.</p>' if p.get('sample') else ''
    stock = '<p class="stock">Please ask us about availability.</p>' if p.get('stock', 1) > 0 else '<p class="stock">Currently unavailable. Message us to enquire.</p>'
    body = f'''
<section class="section tight"><div class="wrap">{crumbs(d, [("Shop", "collections/all/"), (p["category"], "collections/" + CAT_SLUG[p["category"]] + "/"), (p["name"], None)])}
 <div class="pdp">
  <div class="gallery"><div class="pics">{mains}</div><div class="thumbs">{thumbs}</div></div>
  <div class="pdp-info"><p class="eyebrow">{esc(p["category"])}</p><h1 class="h-lg">{esc(p["name"])}</h1>
    <p class="sub big">{esc(sub_line(p))}</p><p class="price big">{money(p["price"])}</p>{sample}
    <p class="desc">{esc(p["description"])}</p>
    <div class="buy"><div class="qty" data-qty><button type="button" data-q="-1" aria-label="Decrease quantity">&minus;</button><input id="pdp-qty" value="1" inputmode="numeric" aria-label="Quantity"><button type="button" data-q="1" aria-label="Increase quantity">+</button></div>
      <button class="btn btn-primary" data-add="{esc(p["sku"])}" data-qty-from="#pdp-qty">Add to bag</button>
      <button class="btn btn-ghost heart-lg" data-wish="{esc(p["sku"])}" aria-pressed="false">Save</button></div>
    <a class="btn btn-wa" href="{wa_link(msg)}" rel="noopener">{ICON["wa"]} Enquire on WhatsApp</a>
    {stock}
    <dl class="specs">{specs}</dl>
    <p class="fine">Prices are in UAE dirhams. VAT and delivery are confirmed when we confirm your order.</p>
  </div></div></div></section>
<section class="section section-tint"><div class="wrap"><header class="sec-head"><p class="eyebrow">More to explore</p><h2 class="h-lg">You may also like</h2></header>
  <div class="grid-cards">{"".join(card(d, q) for q in related)}</div></div></section>
'''
    ld = {"@context": "https://schema.org", "@type": "Product", "name": p['name'], "sku": p['sku'], "category": p['category'],
          "description": p['description'], "brand": {"@type": "Brand", "name": "VLORÁ"}}
    if not p.get('sample'):
        ld["offers"] = {"@type": "Offer", "priceCurrency": "AED", "price": p['price'], "url": f"{SITE['domain']}/products/{p['slug']}/"}
    shell(path, f"{p['name']}, {p['metal']}", p['description'][:155], body,
          f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>', noindex=bool(p.get('sample')), in_sitemap=not p.get('sample'))


def simple_page(slug, title, desc, inner, noindex=False):
    path = f'pages/{slug}/index.html'
    d = depth_of(path)
    body = f'<section class="page-head"><div class="wrap">{crumbs(d, [(title, None)])}<h1 class="h-xl">{esc(title)}</h1></div></section><section class="section tight"><div class="wrap prose">{inner}</div></section>'
    shell(path, title, desc, body, noindex=noindex)


def page_about():
    simple_page('about', 'About', 'VLORÁ is a family-run jewellery retail and manufacturing business based in Dubai, United Arab Emirates.', f'''
<p class="lede">VLORÁ is a family-run jewellery retail and manufacturing business based in Dubai, United Arab Emirates. Our mark carries the year {SITE["since"]}.</p>
<p>We offer fine jewellery and watches chosen for how they look and how they last. Every piece is made to be worn often and kept for a long time.</p>
<p class="draft">Draft text. Please replace this page with your own story: how the business began, who runs it, what you are proud of and how your pieces are made.</p>
<h2>Visit or get in touch</h2><p>Our team is happy to help you choose, answer questions about a piece, or arrange a visit. <a href="{link(2, "pages/contact/")}">Contact us</a>.</p>''')


def page_contact():
    d = 2
    wa = wa_link()
    simple_page('contact', 'Contact', 'Contact VLORÁ in Dubai by WhatsApp, phone or email, or visit our showroom.', f'''
<div class="contact-grid"><div>
<h2>Talk to us</h2>
<ul class="plain big">
<li><strong>WhatsApp</strong><br><a href="{wa}" rel="noopener">{esc(SITE["phone_display"])}</a></li>
<li><strong>Phone</strong><br><a href="tel:{re.sub(r"[^+0-9]", "", SITE["phone_display"])}">{esc(SITE["phone_display"])}</a></li>
<li><strong>Email</strong><br><a href="mailto:{esc(SITE["email"])}">{esc(SITE["email"])}</a></li>
<li><strong>Showroom</strong><br>{esc(SITE["address"])}</li>
<li><strong>Hours</strong><br>{esc(SITE["hours"])}</li></ul></div>
<form class="form" id="contact-form" data-wa="{SITE["whatsapp"]}" data-email="{esc(SITE["email"])}">
<h2>Send an enquiry</h2>
<label>Your name<input name="name" required autocomplete="name"></label>
<label>Phone or WhatsApp<input name="phone" required autocomplete="tel"></label>
<label>Your message<textarea name="msg" rows="5" required></textarea></label>
<div class="form-actions"><button class="btn btn-primary" type="submit" data-via="wa">Send on WhatsApp</button><button class="btn btn-ghost" type="submit" data-via="mail">Send by email</button></div>
<p class="fine">This opens WhatsApp or your email app with your message ready to send.</p></form></div>''')


def page_faq():
    qa = [("How do I order?", "Add pieces to your bag and choose Request order. We receive your details, confirm availability, and then arrange payment and delivery with you directly."),
          ("Can I see a piece before buying?", "Yes. Contact us to arrange a visit to the showroom, or message us on WhatsApp and we can share more pictures."),
          ("Which currency are prices in?", "All prices are in UAE dirhams (AED)."),
          ("How do I care for my jewellery?", "See our care guide for simple, practical advice."),
          ("What about delivery, returns and exchanges?", "Please read our shipping and returns page, or ask us before you order.")]
    inner = ''.join(f'<details class="faq"><summary>{q}</summary><p>{a}</p></details>' for q, a in qa)
    simple_page('faq', 'FAQ', 'Answers to common questions about ordering from VLORÁ.', inner)


def page_bespoke():
    simple_page('bespoke', 'Bespoke', 'Have a piece made for you, from first sketch to final polish.', f'''
<p class="lede">Your idea, made by our own hands in Dubai.</p>
<h2>How it works</h2><p>Tell us what you have in mind: a sketch, a photo, a stone you already own. We discuss design, metal and budget, then agree a final drawing before anything is made.</p>
<h2>Making and finishing</h2><p>Your piece is crafted, set and polished in our workshop, and checked before it reaches you.</p>
<h2>Start a conversation</h2><p><a href="{link(2, "pages/contact/")}">Contact us</a> to arrange a consultation.</p>
<p class="draft">Draft text. Please review and adjust to match how your bespoke service really works, including timelines.</p>''')


def page_care():
    simple_page('care-guide', 'Care guide', 'Simple habits that keep gold, diamonds and watches looking their best.', '''
<p class="lede">A little care goes a long way. These habits suit most fine jewellery.</p>
<h2>Everyday wear</h2><p>Put jewellery on last, after perfume, creams and hairspray, and take it off first at the end of the day.</p>
<h2>Keep it away from</h2><p>Chlorine, harsh cleaning products, and heavy exercise or gardening. Chemicals and knocks can dull metal and loosen settings.</p>
<h2>Cleaning</h2><p>Soak in lukewarm water with a drop of mild soap, brush gently with a soft brush, rinse, and pat dry with a soft cloth.</p>
<h2>Storage</h2><p>Store each piece separately in a soft pouch or lined box so pieces do not scratch each other.</p>
<h2>Check-ups</h2><p>Have settings and clasps checked from time to time. Ask us if you would like a piece inspected.</p>
<p class="draft">Draft text. Please review and adjust to match your own advice, especially for watches and coloured stones.</p>''')


def page_shipping():
    simple_page('shipping-returns', 'Shipping & returns', 'Delivery, returns and exchange information for VLORÁ orders.', '''
<p class="draft">Policy details to be confirmed by VLORA before launch. The points below are placeholders to complete.</p>
<h2>Delivery</h2><p>[Confirm: delivery areas, delivery times, delivery charges, insurance and signature on delivery.]</p>
<h2>VAT</h2><p>[Confirm: whether displayed prices include VAT and how VAT is shown on invoices.]</p>
<h2>Returns and exchanges</h2><p>[Confirm: return window, condition of items, made-to-order or resized items, and how refunds are paid.]</p>
<h2>Questions</h2><p>Message us on WhatsApp or email and we will be glad to help.</p>''')


def page_privacy():
    simple_page('privacy', 'Privacy policy', 'How VLORÁ handles personal information.', f'''
<p class="draft">Draft for review. Please have this policy checked against your legal requirements before launch.</p>
<h2>What we collect</h2><p>When you send an enquiry or request an order, you give us your name, phone number, email and delivery details. We use them only to respond to you and fulfil your order.</p>
<h2>This website</h2><p>Your shopping bag and saved items are kept in your own browser on your device. They are not sent to us until you submit an order request or message.</p>
<h2>Contact</h2><p>{esc(SITE["legal_name"])}, Dubai, United Arab Emirates. {esc(SITE["email"])}</p>''')


def page_terms():
    simple_page('terms', 'Terms of service', 'Terms of use for the VLORÁ website and orders.', f'''
<p class="draft">Draft for review. Please have these terms checked against your legal requirements before launch.</p>
<h2>Orders</h2><p>An order request is not a confirmed sale. A sale is confirmed once we confirm availability and price with you and payment is arranged.</p>
<h2>Prices</h2><p>Prices are shown in UAE dirhams and may change. Pictures are for illustration and finished pieces may vary slightly.</p>
<h2>The seller</h2><p>{esc(SITE["legal_name"])}, Dubai, United Arab Emirates.</p>''')


def page_wishlist():
    path = 'wishlist/index.html'
    d = 1
    body = f'''<section class="page-head"><div class="wrap">{crumbs(d, [("Wishlist", None)])}<h1 class="h-xl">Your wishlist</h1><p class="lede">Pieces you have saved on this device.</p></div></section>
<section class="section tight"><div class="wrap"><div class="grid-cards" id="wish-grid"></div><p class="empty" id="wish-empty" hidden>You have not saved anything yet. Tap the heart on any piece to keep it here.</p></div></section>'''
    shell(path, 'Wishlist', 'Pieces you have saved.', body, noindex=True, in_sitemap=False)


def page_checkout():
    path = 'checkout/index.html'
    d = 1
    body = f'''<section class="page-head"><div class="wrap">{crumbs(d, [("Request order", None)])}<h1 class="h-xl">Request your order</h1>
<p class="lede">Send us your details and your bag. We will confirm availability and arrange payment and delivery with you.</p></div></section>
<section class="section tight"><div class="wrap checkout">
  <form class="form" id="checkout-form" data-wa="{SITE["whatsapp"]}" data-email="{esc(SITE["email"])}">
    <h2>Your details</h2>
    <label>Full name<input name="name" required autocomplete="name"></label>
    <div class="two"><label>Phone or WhatsApp<input name="phone" required autocomplete="tel"></label><label>Email<input name="email" type="email" required autocomplete="email"></label></div>
    <div class="two"><label>Emirate or city<input name="city" required autocomplete="address-level2"></label><label>Delivery or pick-up<select name="mode"><option>Delivery</option><option>Pick up from showroom</option></select></label></div>
    <label>Delivery address<textarea name="address" rows="3" autocomplete="street-address"></textarea></label>
    <label>Notes for us (ring size, gift message, timing)<textarea name="notes" rows="3"></textarea></label>
    <label class="chk"><input type="checkbox" required> I have read the <a href="{link(d, "pages/terms/")}">terms</a> and <a href="{link(d, "pages/privacy/")}">privacy policy</a>.</label>
    <div class="form-actions"><button class="btn btn-primary" type="submit" data-via="wa">Send request on WhatsApp</button><button class="btn btn-ghost" type="submit" data-via="mail">Send by email</button></div>
    <p class="fine">This opens WhatsApp or your email app with your order ready to send. Nothing is charged now.</p>
  </form>
  <aside class="summary" id="summary" aria-label="Order summary"></aside>
</div></section>'''
    shell(path, 'Request order', 'Send your order request to VLORÁ.', body, noindex=True, in_sitemap=False)


def page_404():
    d = 0
    body = f'<section class="page-head"><div class="wrap"><h1 class="h-xl">Page not found</h1><p class="lede">That page is not here. Try the <a href="{link(d, "collections/all/")}">collection</a> or go <a href="{link(d)}">home</a>.</p></div></section>'
    shell('404.html', 'Page not found', 'Page not found.', body, noindex=True, in_sitemap=False)


# ---------------------------------------------------------------- build
def build():
    for p in PRODUCTS:
        p.setdefault('images', [f"{p['sku']}-a.svg", f"{p['sku']}-b.svg"])
    # static assets
    for sub in ('assets',):
        src = os.path.join(ROOT, sub)
        if os.path.abspath(OUT) != ROOT:
            shutil.copytree(src, os.path.join(OUT, sub), dirs_exist_ok=True)
    # favicon
    sym = open(os.path.join(ROOT, 'assets/img/vlora-symbol-cream.svg'), encoding='utf-8').read()
    sym = re.sub(r'viewBox="[^"]*"', 'viewBox="640 30 375 450"', sym, count=1)
    sym = re.sub(r' width="\d+" height="\d+"', ' width="64" height="64"', sym, count=1)
    sym = sym.replace('<svg ', '<svg ', 1).replace('\n<path', '\n<rect x="640" y="30" width="375" height="450" rx="60" fill="#0c193b"/>\n<path', 1)
    write('assets/img/favicon.svg', sym)
    # placeholder product pictures (only for sample products)
    for p in PRODUCTS:
        if p.get('sample'):
            write(f"assets/img/products/{p['sku']}-a.svg", placeholder_svg(p, 'a'))
            write(f"assets/img/products/{p['sku']}-b.svg", placeholder_svg(p, 'b'))
    # data for the browser
    slim = [dict(sku=p['sku'], slug=p['slug'], name=p['name'], cat=p['category'], metal=p['metal'], price=p['price'],
                 sub=sub_line(p), img=p['images'][0], sample=bool(p.get('sample'))) for p in PRODUCTS]
    write('assets/js/data.js', 'window.VL=' + json.dumps({"products": slim, "whatsapp": SITE['whatsapp'], "email": SITE['email'],
                                                           "currency": "AED", "categories": CATEGORIES}, ensure_ascii=False) + ';')
    page_home()
    page_collection('all', 'All jewellery & watches', 'Every piece in the VLORÁ collection.', PRODUCTS)
    page_collection('gold', 'Gold', 'Fine jewellery in yellow, white and rose gold.', [p for p in PRODUCTS if 'Gold' in p['metal']])
    page_collection('diamond', 'Diamond', 'Diamond jewellery, set and finished by hand.', [p for p in PRODUCTS if p.get('stone') == 'Diamond'])
    page_collection('new-arrivals', 'New arrivals', 'The newest pieces to join the collection.', [p for p in PRODUCTS if p.get('new')])
    blurbs = {'Rings': 'Solitaires, bands and statement rings.', 'Earrings': 'Studs, drops and hoops for every day and every occasion.',
              'Necklaces': 'Pendants, chains and rivières.', 'Bracelets': 'Tennis, link and chain bracelets.',
              'Bangles': 'Slim bangles and cuffs in gold and diamonds.', 'Pendants': 'Pendants to wear alone or layered.',
              'Watches': 'Dress watches and jeweled watches.'}
    for c in CATEGORIES:
        page_collection(CAT_SLUG[c], c, blurbs[c], [p for p in PRODUCTS if p['category'] == c])
    for p in PRODUCTS:
        page_product(p)
    page_about(); page_bespoke(); page_contact(); page_faq(); page_care(); page_shipping(); page_privacy(); page_terms()
    page_wishlist(); page_checkout(); page_404()
    today = datetime.date.today().isoformat()
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'<url><loc>{esc(u)}</loc><lastmod>{today}</lastmod></url>\n' for u in sorted(set(PAGES))) + '</urlset>\n'
    write('sitemap.xml', sm)
    write('robots.txt', f"User-agent: *\nAllow: /\nDisallow: /_src/\nDisallow: /checkout/\nSitemap: {SITE['domain']}/sitemap.xml\n")
    if not ARGS.preview:
        write('.htaccess', open(os.path.join(HERE, 'htaccess.txt')).read())
    print(f"Built {len(PRODUCTS)} products, {len(PAGES)} indexable pages into {OUT}")


build()
