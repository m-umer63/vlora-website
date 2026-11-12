#!/usr/bin/env python3
"""Turn the VLORA product Excel into _src/data/catalogue.json (needs: pip install openpyxl).
Usage: python3 _src/import_catalogue.py PRODUCTS.xlsx [--only VJD-0744,VJD-1963] [--out _src/data/catalogue.json]
Also writes a review list of photos / products that need a human decision."""
import argparse, json, os, re
import openpyxl

COL = {'White-Gold': 'w', 'Yellow-Gold': 'y', 'Rose-Gold': 'r', 'Silver': 's'}
SHAPES = ['Round', 'Pear', 'Princess', 'Radiant', 'Oval', 'Emerald', 'Cushion', 'Asscher', 'Marquise', 'Heart']

def parse_file(fn, sku):
    m = re.match(re.escape(sku) + r'_.*?_(\d+)((?:_.*)?)\.[A-Za-z]+$', fn)
    if not m: return None
    idx, tag = int(m.group(1)), m.group(2).lstrip('_')
    cols = ''.join(sorted({v for k, v in COL.items() if k in tag}))
    shp = next((s for s in SHAPES if re.search(r'(^|-)' + s + r'($|-)', tag)), '')
    return idx, cols, shp

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('xlsx'); ap.add_argument('--only', default=''); ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), 'data', 'catalogue.json'))
    a = ap.parse_args(); only = {s for s in a.only.split(',') if s}
    ws = openpyxl.load_workbook(a.xlsx, read_only=True).active
    rows = list(ws.iter_rows(values_only=True)); h = rows[0]
    ov_file = os.path.join(os.path.dirname(a.out), 'catalogue_overrides.json')
    OV = json.load(open(ov_file, encoding='utf-8')) if os.path.exists(ov_file) else {}   # {file name: [colours, shape]} fixes for photos named without colour/shape
    gf = os.path.join(os.path.dirname(a.out), 'untagged_guess.json')
    GUESS = json.load(open(gf, encoding='utf-8')) if os.path.exists(gf) else {}   # colour/shape worked out from the photos themselves
    out, review = [], []
    for r in rows[1:]:
        d = dict(zip(h, r)); sku = d['SKU']
        if only and sku not in only: continue
        files = [f for f in (d.get('Image Files') or '').split(' | ') if f]
        parsed = [(f, parse_file(f, sku)) for f in files]
        parsed = [(f, p) for f, p in parsed if p]; parsed.sort(key=lambda x: x[1][0])
        first_tag = next((p[0] for f, p in parsed if (p[1] and len(p[1]) < 3) or p[2]), None)
        imgs = []
        for f, (idx, cols, shp) in parsed:
            if f in OV: cols, shp = OV[f]
            if len(cols) >= 3: cols = 'w'                  # "all colours" overview photo shows the white-gold piece
            cols = cols.replace('s', '')                   # silver is not sold for now
            if not cols and not shp and f in GUESS and GUESS[f]['margin'] >= 1.1 and GUESS[f]['colvotes'] >= 0.99:
                cols, shp = GUESS[f]['c'], GUESS[f]['s']
            if not cols and not shp:
                if first_tag is None or idx < first_tag: cols = 'w'   # untagged leading photos = default white gold
                else: review.append(f'{sku}: {f} has no colour/shape in its name, left out'); continue
            elif not cols: cols = ''                       # shape only: any colour
            imgs.append({'f': f, 'c': cols, 's': shp})
        metals = [m for m in (d.get('Metal') or '').split(', ') if m]
        if not imgs: review.append(f'{sku}: no photos'); 
        if any(not m.startswith('18K') for m in metals): review.append(f'{sku}: metal is {d.get("Metal")} (not 18K)')
        out.append({'sku': sku, 'name': d['Name'], 'collection': d['Collection'], 'shapes': [s for s in (d.get('Shape') or '').split(', ') if s],
                    'style': d.get('Style'), 'stone_type': d.get('Stone Type'), 'carat': d.get('Carat'), 'clarity': d.get('Clarity'), 'audience': d.get('For Her / For Him'),
                    'folder': d.get('Folder'), 'images': imgs})
    json.dump(out, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    open(os.path.splitext(a.out)[0] + '_review.txt', 'w', encoding='utf-8').write('\n'.join(review))
    print(len(out), 'products;', len(review), 'review items')
if __name__ == '__main__': main()
