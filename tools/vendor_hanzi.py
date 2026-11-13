#!/usr/bin/env python3
"""Copy stroke data for every Chinese character used in data/lessons/*.json
into vendor/hanzi-data/, so handwriting practice works offline and without a CDN.

Usage:
    npm pack hanzi-writer-data@2.0.1 && tar xzf hanzi-writer-data-2.0.1.tgz
    python3 tools/vendor_hanzi.py package/

Characters missing from vendor/ are still loaded from the jsDelivr CDN at runtime.
"""
import json, pathlib, re, shutil, sys

root = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
if not src or not src.is_dir():
    sys.exit(__doc__)

han = re.compile(r"[一-鿿]")
chars = set()
for f in sorted((root / "data" / "lessons").glob("*.json")):
    lesson = json.loads(f.read_text("utf-8"))
    for w in lesson.get("vocab", []):
        chars.update(han.findall(w["hanzi"]))

out = root / "vendor" / "hanzi-data"
out.mkdir(parents=True, exist_ok=True)
missing = []
for ch in sorted(chars):
    f = src / f"{ch}.json"
    if f.exists():
        shutil.copyfile(f, out / f"{ch}.json")
    else:
        missing.append(ch)
shutil.copyfile(src / "ARPHICPL.TXT", out / "ARPHICPL.TXT")
print(f"{len(chars) - len(missing)} characters copied to {out.relative_to(root)}")
if missing:
    print("missing:", "".join(missing))
