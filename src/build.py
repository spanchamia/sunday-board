#!/usr/bin/env python3
"""Inject the data tables into the page and write the publishable index.html.

The source page carries __INGREDIENT_TABLE__ and __SUPPLY_TABLE__ placeholders so
it stays editable without 7,000 lines of data in the middle of it. This script
fills them in.

    python3 src/build.py
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "sunday-board.html"
DATA = ROOT / "src" / "data" / "ingredients.txt"
SUPPLIES = ROOT / "src" / "data" / "supplies.txt"
OUT = ROOT / "index.html"

PLACEHOLDER = "__INGREDIENT_TABLE__"
SUP_PLACEHOLDER = "__SUPPLY_TABLE__"


def main() -> int:
    page = SRC.read_text(encoding="utf-8")
    for ph in (PLACEHOLDER, SUP_PLACEHOLDER):
        if ph not in page:
            print(f"error: {ph} not found in {SRC}", file=sys.stderr)
            return 1

    def rows_of(path, label):
        rows = [
            line for line in path.read_text(encoding="utf-8").splitlines()
            if line and not line.startswith("#")
        ]
        table = "\n".join(rows)
        # the table is embedded in a JS template literal, so these would break it
        for bad in ("`", "${"):
            if bad in table:
                raise SystemExit(f"error: {label} data contains {bad!r}")
        return rows, table

    rows, table = rows_of(DATA, "ingredient")
    sup_rows, sup_table = rows_of(SUPPLIES, "supply")

    import datetime, hashlib
    stamp = datetime.date.today().strftime("%d %b") + " " + hashlib.sha1(page.encode()).hexdigest()[:6]
    body = (page.replace(PLACEHOLDER, table)
                .replace(SUP_PLACEHOLDER, sup_table)
                .replace("__BUILD_STAMP__", stamp))

    # The artifact host wraps the page in its own skeleton, so the source has no
    # <head>. A file served from a repo or GitHub Pages needs one — without the
    # charset declaration every dash and arrow renders as mojibake.
    doc = (
        "<!doctype html>\n"
        '<html lang="en">\n'
        "<head>\n"
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        "</head>\n"
        "<body>\n"
        f"{body}\n"
        "</body>\n"
        "</html>\n"
    )
    OUT.write_text(doc, encoding="utf-8")
    print(f"built {OUT.relative_to(ROOT)} — {OUT.stat().st_size // 1024} KB, "
          f"{len(rows)} base ingredients, {len(sup_rows)} supplies, build {stamp}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
