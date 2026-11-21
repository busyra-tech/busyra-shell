#!/usr/bin/env python3
"""Gabungkan i18n/parts/*.json → i18n/en.json, periksa jumlah placeholder {} sama."""
import json, pathlib, sys

root = pathlib.Path(__file__).resolve().parent.parent / "i18n"
merged, bad = {}, []
for part in sorted((root / "parts").glob("*.json")):
    for k, v in json.loads(part.read_text(encoding="utf-8")).items():
        if not isinstance(v, str) or not v.strip():
            bad.append(f"{part.name}: kosong: {k!r}")
            continue
        if k.count("{}") != v.count("{}"):
            bad.append(f"{part.name}: jumlah {{}} beda: {k!r} -> {v!r}")
            continue
        merged.setdefault(k, v)
(root / "en.json").write_text(json.dumps(dict(sorted(merged.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"{len(merged)} entri → i18n/en.json")
if bad:
    print("\n".join(bad), file=sys.stderr)
    sys.exit(1)
