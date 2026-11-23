#!/usr/bin/env python3
"""Bundle small Chinese fonts that cover exactly the characters the app uses.

The fonts are subsets of Noto Sans SC / Noto Serif SC (SIL Open Font License),
taken from the @fontsource packages, so the app looks the same offline on any device.

Usage (after adding or changing lessons):
  npm pack @fontsource/noto-sans-sc @fontsource/noto-serif-sc
  mkdir sans serif && tar xzf fontsource-noto-sans-sc-*.tgz -C sans && tar xzf fontsource-noto-serif-sc-*.tgz -C serif
  pip install fonttools brotli
  python3 tools/build_fonts.py sans/package serif/package
"""
import io
import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'fonts'
# CJK ideographs, CJK punctuation and full-width forms.
WANTED = re.compile(r'[　-〿一-鿿＀-￯‘’“”…—·]')


def used_chars():
    chars = set()
    for pattern in ('data/**/*.json', 'js/*.js', 'index.html'):
        for f in ROOT.glob(pattern):
            chars.update(WANTED.findall(f.read_text(encoding='utf-8')))
    return chars


def build(pkg: Path, family: str, weight: int, chars: set, out_name: str):
    files = sorted((pkg / 'files').glob(f'{family}-*-{weight}-normal.woff2'))
    parts = []
    covered = set()
    for f in files:
        font = TTFont(f)
        cmap = font.getBestCmap()
        hit = {c for c in chars if ord(c) in cmap} - covered
        if not hit:
            continue
        covered |= hit
        opts = subset.Options()
        opts.flavor = None
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.notdef_outline = True
        sub = subset.Subsetter(opts)
        sub.populate(text=''.join(sorted(hit)))
        sub.subset(font)
        tmp = OUT / f'.part-{len(parts)}.otf'
        font.flavor = None
        font.save(tmp)
        parts.append(tmp)
    missing = chars - covered
    merged = Merger().merge([str(p) for p in parts])
    merged.flavor = 'woff2'
    merged.save(OUT / out_name)
    for p in parts:
        p.unlink()
    size = (OUT / out_name).stat().st_size
    print(f'{out_name}: {len(covered)} chars from {len(parts)} chunks, {size // 1024} KB'
          + (f', missing {"".join(sorted(missing))}' if missing else ''))


def main():
    sans, serif = Path(sys.argv[1]), Path(sys.argv[2])
    OUT.mkdir(exist_ok=True)
    chars = used_chars()
    print(f'{len(chars)} characters used')
    build(sans, 'noto-sans-sc', 400, chars, 'noto-sans-sc-400.woff2')
    build(sans, 'noto-sans-sc', 500, chars, 'noto-sans-sc-500.woff2')
    build(serif, 'noto-serif-sc', 500, chars, 'noto-serif-sc-500.woff2')


if __name__ == '__main__':
    main()
