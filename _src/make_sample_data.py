"""Creates SAMPLE products so the site can be previewed before real data arrives.
Every product written here is flagged "sample": true and shows a "Sample" tag on the site.
Real products come from the spreadsheet via import_products.py instead."""
import json, re, os

def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

CATS = {
 'Rings':     ('RNG', [("Emerald-Cut Solitaire Ring","Diamond",0.50,3.4,12500),("Halo Diamond Ring","Diamond",0.75,3.9,16800),
                        ("Classic Band Ring","",0,4.2,3900),("Three-Stone Ring","Diamond",0.90,4.1,18900),
                        ("Stackable Pavé Ring","Diamond",0.25,2.6,5200),("Sapphire Cocktail Ring","Sapphire",1.20,5.5,9800),
                        ("Signet Ring","",0,6.8,4600)]),
 'Earrings':  ('ERG', [("Diamond Stud Earrings","Diamond",0.60,2.0,7400),("Drop Earrings","Diamond",0.80,3.2,11200),
                        ("Huggie Hoops","",0,3.6,3300),("Emerald-Cut Earrings","Emerald",1.10,3.0,8900)]),
 'Necklaces': ('NCK', [("Solitaire Pendant Necklace","Diamond",0.40,2.8,6800),("Rivière Necklace","Diamond",2.40,14.0,34500),
                        ("Fine Chain Necklace","",0,5.1,2900)]),
 'Bracelets': ('BRC', [("Tennis Bracelet","Diamond",2.00,9.5,27800),("Link Bracelet","",0,11.0,5400)]),
 'Bangles':   ('BNG', [("Slim Gold Bangle","",0,12.0,5900),("Diamond Cuff Bangle","Diamond",0.55,16.5,14900)]),
 'Pendants':  ('PND', [("Emerald-Cut Pendant","Emerald",0.70,2.2,4800),("Initial Pendant","",0,1.9,1800)]),
 'Watches':   ('WCH', [("Dress Watch, Navy Dial","",0,0,8600),("Ladies Diamond Watch","Diamond",0.35,0,13400)]),
}
METALS = ["Yellow Gold","White Gold","Rose Gold"]
out = []
n = {}
for cat, (pre, items) in CATS.items():
    for i, (name, stone, ct, g, price) in enumerate(items):
        metal = METALS[i % 3]
        n[pre] = n.get(pre, 0) + 1
        sku = f"{pre}-{n[pre]:04d}"
        full = f"{name}"
        stone_txt = f" with {stone.lower()}" if stone else ""
        desc = (f"A sample listing for layout testing: {name.lower()} in 18K {metal.lower()}{stone_txt}. "
                f"Replace this text with your own description.")
        out.append(dict(sku=sku, name=full, slug=slug(f"{full}-{metal}-{sku}"), category=cat,
                        collection="Signature" if i % 2 == 0 else "Classics", metal=metal, purity=18,
                        stone=stone, stone_ct=ct, metal_g=g, price=price, stock=3 + i,
                        description=desc, images=[f"{sku}-a.svg", f"{sku}-b.svg"],
                        featured=(i == 0), new=(i % 3 == 1), supplier_code="", sample=True))
os.makedirs(os.path.join(os.path.dirname(__file__), 'data'), exist_ok=True)
json.dump(out, open(os.path.join(os.path.dirname(__file__), 'data', 'products.json'), 'w'), indent=1)
print(len(out), "sample products")
