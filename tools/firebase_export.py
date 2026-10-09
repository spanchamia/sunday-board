#!/usr/bin/env python3
"""Export every Firestore collection (including nested sub-collections) to JSON.

Read-only: this script never writes to, or deletes from, your database.

    python3 tools/firebase_export.py --key ~/Downloads/your-service-account.json

Writes to ./firebase-export/ (change with --out):
    <collection>.json   one file per top-level collection; each document carries
                        its id and, if it has any, its sub-collections
    schema.txt          every collection with its field names, value types and
                        how many documents use each field (the "schema")
"""
import argparse
import base64
import datetime
import json
import pathlib
import sys
from collections import defaultdict

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    from google.cloud.firestore_v1 import DocumentReference, GeoPoint
except ImportError:
    sys.exit("Missing library. Run:  pip install firebase-admin")


def plain(value):
    """Turn Firestore values into things JSON can hold."""
    if isinstance(value, datetime.datetime):
        return value.isoformat()
    if isinstance(value, DocumentReference):
        return {"__ref__": value.path}          # a link to another document
    if isinstance(value, GeoPoint):
        return {"__geo__": [value.latitude, value.longitude]}
    if isinstance(value, bytes):
        return {"__bytes__": base64.b64encode(value).decode()}
    if isinstance(value, dict):
        return {k: plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [plain(v) for v in value]
    return value


def type_name(value):
    if isinstance(value, datetime.datetime):
        return "timestamp"
    if isinstance(value, DocumentReference):
        return "reference → " + value.parent.id
    if isinstance(value, GeoPoint):
        return "geopoint"
    if isinstance(value, list):
        inner = sorted({type_name(v) for v in value})
        return "list of " + "/".join(inner) if inner else "list"
    if isinstance(value, dict):
        return "map"
    if value is None:
        return "null"
    return type(value).__name__


# schema[collection path pattern] = {"docs": n, "fields": {field: {type: count}}}
schema = defaultdict(lambda: {"docs": 0, "fields": defaultdict(lambda: defaultdict(int))})


def dump_collection(coll, pattern):
    docs = []
    # list_documents() also finds "empty" parent documents that exist only to
    # hold sub-collections; stream() would silently skip those.
    for ref in coll.list_documents():
        snap = ref.get()
        data = (snap.to_dict() if snap.exists else None) or {}
        entry = schema[pattern]
        entry["docs"] += 1
        for field, value in data.items():
            entry["fields"][field][type_name(value)] += 1
        doc = {"__id__": ref.id, **plain(data)}
        subs = {}
        for sub in ref.collections():
            subs[sub.id] = dump_collection(sub, f"{pattern}/*/{sub.id}")
        if subs:
            doc["__subcollections__"] = subs
        docs.append(doc)
    return docs


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--key", required=True, help="service account key file (.json)")
    ap.add_argument("--out", default="firebase-export", help="output folder")
    ap.add_argument("--skip", nargs="*", default=[],
                    help="top-level collections to leave out, e.g. --skip users")
    args = ap.parse_args()

    key = pathlib.Path(args.key).expanduser()
    if not key.exists():
        sys.exit(f"Key file not found: {key}")
    firebase_admin.initialize_app(credentials.Certificate(str(key)))
    db = firestore.client()

    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    for coll in db.collections():
        if coll.id in args.skip:
            print(f"  skipped {coll.id}")
            continue
        docs = dump_collection(coll, coll.id)
        (out / f"{coll.id}.json").write_text(
            json.dumps(docs, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"  {coll.id}: {len(docs)} documents")

    lines = []
    for path in sorted(schema):
        entry = schema[path]
        lines.append(f"{path}  ({entry['docs']} documents)")
        for field in sorted(entry["fields"]):
            types = ", ".join(f"{t} ×{n}" for t, n in sorted(entry["fields"][field].items()))
            lines.append(f"    {field}: {types}")
        lines.append("")
    (out / "schema.txt").write_text("\n".join(lines), encoding="utf-8")
    print(f"Done. Files are in {out.resolve()}")


if __name__ == "__main__":
    main()
