#!/usr/bin/env python3
"""Build the shared item catalogue from Sunday Board's library.

Reads  src/data/ingredients.txt and src/data/supplies.txt  (repo root)
Writes app/supabase/seed/catalog.json and starter_packs.json

Choices (see docs/data-model.md):
  * Category paths are relative to My Home and reuse the names the owner's family
    already had in TenBy12 (Pantry, Spices, Cooking oils, Cleaning supplies…), so
    imported items and new catalogue items land in the same places.
  * Names drop descriptive brackets when that stays unique: "Toor dal (arhar, split)"
    becomes "Toor dal", with "arhar" kept as another name for search.
  * Supplies sold in many sizes become one product with optional sizes.
  * Restock mode: long-lasting things (dals, spices, detergent) are Staples; fresh
    food and one-off purchases (cookware, decor) are As needed.

    python3 app/supabase/seed/build_catalog.py
"""
import json
import pathlib
import re
from collections import OrderedDict

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = pathlib.Path(__file__).resolve().parent

DESCRIPTORS = {
    'split', 'skinned', 'whole', 'dry', 'dried', 'fresh', 'ground', 'canned', 'frozen', 'raw', 'in shell',
    'in sauce', 'flat-leaf', 'sweet', 'turkish', 'large', 'small', 'baby', 'ripe', 'unripe', 'green', 'red',
    'yellow', 'white', 'black', 'boneless', 'skinless', 'bone-in', 'peeled', 'shelled', 'unsalted', 'salted',
    'roasted', 'cooked', 'powder', 'paste', 'leaves', 'seed', 'seeds', 'organic', 'plain', 'full fat',
    'low fat', 'whole milk', 'block', 'dried block', 'sliced', 'chopped', 'minced', 'pods',
}

# Extra everyday names people search by (US and Indian), keyed by catalogue name start.
EXTRA_ALIASES = {
    'coriander leaves': ['cilantro', 'dhania leaves', 'kothimbir'],
    'okra': ['bhindi', 'lady finger'],
    'eggplant': ['brinjal', 'baingan'],
    'aubergine': ['eggplant', 'brinjal', 'baingan'],
    'bottle gourd': ['doodhi', 'lauki', 'dudhi'],
    'bitter gourd': ['karela'],
    'cauliflower': ['gobi'],
    'cabbage': ['patta gobi'],
    'potato': ['aloo', 'potatoes'],
    'spinach': ['palak'],
    'fenugreek leaves': ['methi'],
    'drumstick': ['moringa', 'saragva', 'shevga'],
    'onion': ['onions', 'kanda', 'pyaz'],
    'tomato': ['tomatoes', 'tamatar'],
    'ginger': ['adrak', 'aale'],
    'garlic': ['lahsun', 'lasun'],
    'green chilli': ['hari mirch', 'green chili'],
    'chickpea flour': ['besan', 'gram flour'],
    'paneer': ['cottage cheese'],
    'yogurt': ['curd', 'dahi'],
    'ghee': ['clarified butter'],
    'capsicum': ['bell pepper', 'shimla mirch'],
    'curd / dahi': ['yogurt', 'yoghurt'],
    'egg': ['eggs', 'anda'],
    'cow milk': ['milk', 'doodh'],
    'toilet roll': ['toilet paper'],
    'kitchen paper towel': ['paper towels', 'kitchen roll'],
    'facial tissue box': ['tissues', 'kleenex'],
    'adhesive bandage': ['band-aid', 'plaster'],
    'table salt': ['salt', 'namak'],
    'tea leaves': ['tea', 'chai patti'],
    'match box': ['matches', 'matchbox'],
    'chandan paste': ['sandalwood paste'],
}

KITCHEN = {
    'Vegetables': 'Vegetables', 'Fungi & sea greens': 'Vegetables', 'Fruits': 'Fruits',
    'Herbs & spices': 'Spices', 'Dals & pulses': 'Pantry', 'Grains & flours': 'Pantry',
    'Baking & pantry': 'Pantry', 'Sweeteners': 'Pantry', 'Nuts & seeds': 'Dried fruits',
    'Oils & fats': 'Cooking oils', 'Condiments & sauces': 'Sauces', 'Dairy & eggs': 'Dairy',
    'Beverages': 'Beverages', 'Bread & noodles': 'Baked goods', 'Plant proteins': 'Tofu & plant proteins',
    'Meat & poultry': 'Meat & fish', 'Fish & seafood': 'Meat & fish',
}
STAPLE_KITCHEN = {'Spices', 'Pantry', 'Dried fruits', 'Cooking oils', 'Sauces', 'Beverages'}

SUPPLY_PATHS = {
    'Cleaning': ['Cleaning supplies'], 'Laundry': ['Cleaning supplies', 'Laundry'],
    'Pest control': ['Cleaning supplies', 'Pest control'], 'Paper & disposables': ['Cleaning supplies', 'Paper & disposables'],
    'Personal care': ['Toiletries'], 'Bathroom': ['Bathrooms'], 'Health & first aid': ['Health & first aid'],
    'Cookware': ['Cooking supplies'], 'Bakeware': ['Cooking supplies'], 'Kitchen tools': ['Cooking supplies'],
    'Food storage': ['Cooking supplies'], 'Tableware': ['Cooking supplies'], 'Small appliances': ['Cooking supplies'],
    'Office & stationery': ['Office supplies'], 'School supplies': ['School supplies'],
    'Craft & hobby': ['Office supplies', 'Craft & hobby'], 'Electronics accessories': ['Office supplies', 'Electronics'],
    'Garden & outdoor': ['Gardening'], 'Seasonal': ['Seasonal'],
    'Tools': ['Tools'], 'Hardware': ['Tools', 'Hardware'], 'Plumbing': ['Tools', 'Plumbing'],
    'Electrical & lighting': ['Tools', 'Electrical & lighting'], 'Batteries & power': ['Tools', 'Batteries'],
    'Bedding & linens': ['Household', 'Bedding & linens'], 'Home decor': ['Household', 'Decor'],
    'Storage & organisation': ['Household', 'Storage'], 'Sewing & mending': ['Household', 'Sewing'],
    'Shoe care': ['Household', 'Shoe care'], 'Safety & emergency': ['Household', 'Safety'],
    'Baby & kids': ['Kids'], 'Pet supplies': ['Pets'],
    'Pooja & festival': ['Pooja & festivals'], 'Party & celebration': ['Parties'],
    'Travel': ['Travel & sports', 'Travel'], 'Sports & fitness': ['Travel & sports', 'Sports'], 'Car care': ['Travel & sports', 'Car care'],
}
STAPLE_SUPPLIES = {
    'Cleaning', 'Laundry', 'Pest control', 'Paper & disposables', 'Personal care', 'Bathroom', 'Health & first aid',
    'Food storage', 'Office & stationery', 'School supplies', 'Batteries & power', 'Pet supplies', 'Baby & kids',
    'Pooja & festival',
}
FRESH_HERBS = {'mint leaves', 'curry leaves', 'thai basil', 'holy basil', 'parsley', 'chervil', 'lemongrass',
               'kaffir lime leaf', 'pandan leaf', 'vietnamese coriander', 'basil', 'dill', 'tarragon', 'coriander leaves'}


def split_name(raw):
    """'Toor dal (arhar, split)' -> ('Toor dal', ['arhar'], ['split'])."""
    m = re.match(r'^(.*?)\s*\((.*)\)\s*$', raw)
    base, inner = (m.group(1), m.group(2)) if m else (raw, '')
    aliases, descr = [], []
    for part in re.split(r'[,/]', inner):
        p = part.strip()
        if not p:
            continue
        (descr if p.lower() in DESCRIPTORS or all(w in DESCRIPTORS for w in p.lower().split()) else aliases).append(p)
    if ' / ' in base:
        aliases += [b.strip() for b in base.split(' / ')[1:]]
    return base.strip(), aliases, descr


def extra_aliases(name):
    n = name.lower()
    return [a for k, v in EXTRA_ALIASES.items() if n == k or n.startswith(k + ' ') or n == k + 's' for a in v]


def search_text(name, aliases):
    return ' '.join([name, *aliases]).lower()


def ingredients():
    rows = [l.rstrip('\n').split('|') for l in open(ROOT / 'src/data/ingredients.txt', encoding='utf-8')
            if l.strip() and not l.startswith('#')]
    parsed = [(r, *split_name(r[0])) for r in rows]
    base_count = {}
    for _, base, _, _ in parsed:
        base_count[base.lower()] = base_count.get(base.lower(), 0) + 1
    # When several share a base ("Okra (bhindi)", "Okra (baby)"), the single variant
    # whose brackets hold only other names (no descriptors) gets the plain name "Okra".
    plain_variant = {}
    for r, base, aliases, descr in parsed:
        if base_count[base.lower()] > 1 and not descr:
            plain_variant.setdefault(base.lower(), []).append(r[0])
    out = []
    for r, base, aliases, descr in parsed:
        group, cuisines = r[1], r[-1].split()
        unique = base_count[base.lower()] == 1 or plain_variant.get(base.lower()) == [r[0]]
        name = base if unique else r[0]
        aisle = KITCHEN[group]
        text = r[0].lower()
        is_fresh_herb = group == 'Herbs & spices' and (
            'fresh' in text or base.lower() in FRESH_HERBS or
            (('leaves' in base.lower() or 'leaf' in base.lower()) and 'dried' not in text
             and 'bay leaf' not in base.lower() and 'kasuri' not in base.lower()))
        if is_fresh_herb:
            aisle = 'Vegetables'
        if group == 'Bread & noodles' and re.search(r'noodle|pasta|spaghetti|vermicelli|macaroni|penne|ramen|udon|soba|lasagn|couscous', text):
            aisle = 'Pantry'
        al = list(OrderedDict.fromkeys(a for a in aliases + extra_aliases(base) if a.lower() != name.lower()))
        out.append({
            'name': name, 'aliases': al, 'category_path': ['Kitchen', aisle],
            'restock_mode': 'staple' if aisle in STAPLE_KITCHEN else 'as_needed',
            'tags': ['indian'] if 'in' in cuisines else [], 'sizes': [],
        })
    return out


def supplies():
    groups = OrderedDict()
    for line in open(ROOT / 'src/data/supplies.txt', encoding='utf-8'):
        if not line.strip() or line.startswith('#'):
            continue
        name, cat, _unit, tags = (line.rstrip('\n').split('|') + [''])[:4]
        base, _, size = name.partition(', ')
        key = (base.strip().lower(), cat)
        g = groups.setdefault(key, {'name': base.strip(), 'cat': cat, 'sizes': [], 'indian': False})
        if size:
            g['sizes'].append(size.strip())
        g['indian'] |= 'in' in tags.split()
    out = []
    for g in groups.values():
        base, aliases, _ = split_name(g['name'])
        out.append({
            'name': g['name'], 'aliases': aliases, 'category_path': SUPPLY_PATHS[g['cat']],
            'restock_mode': 'staple' if g['cat'] in STAPLE_SUPPLIES else 'as_needed',
            'tags': ['indian'] if g['indian'] else [], 'sizes': g['sizes'],
        })
    return out


STARTER_PACKS = [
    ('indian-kitchen', 'Indian kitchen basics', 'Dals, flours, spices and masalas most Indian kitchens keep', [
        'Toor dal', 'Moong dal', 'Chana dal', 'Urad dal', 'Masoor dal', 'Rajma', 'Kabuli chana', 'Chickpea flour',
        'Basmati rice', 'Sona masoori rice', 'Wheat flour', 'Semolina', 'Poha', 'Turmeric', 'Cumin seed', 'Mustard seed',
        'Coriander powder', 'Red chilli powder', 'Kashmiri chilli powder', 'Garam masala', 'Asafoetida',
        'Fenugreek seed', 'Green cardamom', 'Clove', 'Cinnamon', 'Bay leaf', 'Black pepper', 'Chaat masala',
        'Sambar powder', 'Pav bhaji masala', 'Kasuri methi', 'Amchur', 'Tamarind', 'Jaggery', 'Ghee',
        'Mustard oil', 'Sunflower oil', 'Table salt', 'Sugar', 'Tea leaves', 'Mango pickle'],
    ),
    ('fresh-weekly', 'Weekly fresh basics', 'Vegetables, fruit and dairy many families buy every week', [
        'Onion', 'Tomato', 'Potato', 'Ginger', 'Garlic', 'Green chilli', 'Coriander leaves', 'Curry leaves',
        'Lemon', 'Spinach', 'Cauliflower', 'Okra', 'Carrot', 'Cucumber', 'Capsicum', 'Banana', 'Apple',
        'Cow milk', 'Curd / dahi', 'Paneer', 'Egg', 'Butter (salted)', 'Whole wheat bread'],
    ),
    ('cleaning', 'Cleaning and laundry', 'Detergents, cleaners and the everyday disposables', [
        'Laundry detergent powder', 'Liquid detergent', 'Fabric softener', 'Dish soap', 'Dishwasher tablets',
        'All-purpose cleaner', 'Floor cleaner (phenyl)', 'Glass cleaner', 'Toilet bowl cleaner', 'Bleach',
        'Sponge scourer', 'Microfibre cloth', 'Rubber gloves', 'Bin bag', 'Kitchen paper towel', 'Aluminium foil',
        'Cling film', 'Zip-lock bag'],
    ),
    ('toiletries', 'Bathroom and toiletries', 'Soap, toothpaste, tissue and personal care', [
        'Toilet roll', 'Facial tissue box', 'Hand wash refill', 'Bath soap', 'Body wash', 'Shampoo', 'Conditioner',
        'Toothpaste', 'Toothbrush', 'Dental floss', 'Deodorant', 'Moisturiser', 'Coconut oil', 'Sunscreen',
        'Razor', 'Cotton buds', 'Sanitary pad', 'Adhesive bandage'],
    ),
    ('pooja', 'Pooja basics', 'Everyday pooja and festival supplies', [
        'Agarbatti (incense sticks)', 'Camphor', 'Diya', 'Cotton wicks', 'Kumkum', 'Haldi', 'Chandan paste', 'Ghee',
        'Match box', 'Dhoop'],
    ),
]


def match_pack(names, catalog):
    """Find each wanted name: exact name, then other name, then name prefix."""
    by_name = {c['name'].lower(): c for c in catalog}
    found, missing = [], []
    for want in names:
        w = want.lower()
        hit = by_name.get(w)
        if not hit:
            hit = next((c for c in catalog if split_name(c['name'])[0].lower() == w), None)
        if not hit:
            hit = next((c for c in catalog if w in (a.lower() for a in c['aliases'])), None)
        if not hit:
            starts = sorted((c for c in catalog if c['name'].lower().startswith(w)), key=lambda c: len(c['name']))
            hit = starts[0] if starts else None
        (found if hit else missing).append(hit['name'] if hit else want)
    return list(OrderedDict.fromkeys(found)), missing


def main():
    catalog, seen = [], set()
    for row in ingredients() + supplies():
        if row['name'].lower() in seen:
            continue
        seen.add(row['name'].lower())
        row['search_text'] = search_text(row['name'], row['aliases'])
        catalog.append(row)
    packs = []
    for i, (pid, name, desc, wanted) in enumerate(STARTER_PACKS):
        found, missing = match_pack(wanted, catalog)
        if missing:
            print(f'  {name}: not in catalogue -> {", ".join(missing)}')
        packs.append({'id': pid, 'name': name, 'description': desc, 'sort': i, 'items': found})
    (OUT / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (OUT / 'starter_packs.json').write_text(json.dumps(packs, ensure_ascii=False, indent=1), encoding='utf-8')
    staples = sum(c['restock_mode'] == 'staple' for c in catalog)
    print(f'{len(catalog)} catalogue products ({staples} staples), {len(packs)} starter packs')


if __name__ == '__main__':
    main()
