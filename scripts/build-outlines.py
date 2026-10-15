"""Builds public/outlines.json: Noto Sans SC Regular outlines for every character used as a part.

Compose draws invented characters from these real typeface outlines (see src/lib/glyph-fit.js).
Per character it stores:
  d: SVG path (font units, y pointing down)
  b: ink bounding box [x0, y0, x1, y1]
  s: [vertical-stroke width, horizontal-stroke height], measured from the outline itself

Needs:  pip install fonttools shapely numpy
Run:    python3 scripts/build-outlines.py            (downloads the font on first run, ~8 MB)
Noto Sans SC is licensed under the SIL Open Font License.
"""
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from shapely import contains_xy
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache"
FONT_URL = "https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf"
FONT_PATH = CACHE / "NotoSansSC-Regular.otf"
DEFAULT_STEM = 80.0

CACHE.mkdir(parents=True, exist_ok=True)
if not FONT_PATH.exists():
    print("downloading", FONT_URL)
    urllib.request.urlretrieve(FONT_URL, FONT_PATH)

font = TTFont(FONT_PATH)
cmap = font.getBestCmap()
glyphs = font.getGlyphSet()


def outline_geometry(name):
    pen = RecordingPen()
    glyphs[name].draw(pen)
    rings, cur = [], []
    for op, args in pen.value:
        if op == "moveTo":
            cur = [args[0]]
        elif op == "lineTo":
            cur.append(args[0])
        elif op == "curveTo":
            p0, (p1, p2, p3) = cur[-1], args
            for i in range(1, 17):
                t = i / 16
                a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3
                cur.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
        elif op in ("closePath", "endPath") and len(cur) >= 3:
            rings.append(cur)
            cur = []
    geom = None
    for ring in rings:
        poly = Polygon([(x, -y) for x, y in ring]).buffer(0)
        geom = poly if geom is None else geom.symmetric_difference(poly)
    return geom


def mode_of_runs(mask, step):
    lengths = []
    for line in mask:
        run = 0
        for v in line:
            if v:
                run += 1
            elif run:
                lengths.append(run * step)
                run = 0
        if run:
            lengths.append(run * step)
    lengths = [n for n in lengths if 28 <= n <= 200]
    if not lengths:
        return DEFAULT_STEM
    hist, edges = np.histogram(lengths, bins=np.arange(28, 209, 8))
    k = int(np.argmax(hist))
    return float((edges[k] + edges[k + 1]) / 2)


def stems(geom):
    """Most common stroke thickness along rows (vertical strokes) and along columns (horizontal strokes)."""
    x0, y0, x1, y1 = geom.bounds
    step = 4
    X, Y = np.meshgrid(np.arange(x0 + step / 2, x1, step), np.arange(y0 + step / 2, y1, step))
    ink = contains_xy(geom, X, Y)
    return mode_of_runs(ink, step), mode_of_runs(ink.T, step)


dictionary = json.loads((ROOT / "public" / "dictionary.json").read_text(encoding="utf8"))
parts = set()
for ids in dictionary["ids"].values():
    for ch in ids:
        if not ("⿰" <= ch <= "⿻") and ch != "？":
            parts.add(ch)

out = {}
for i, ch in enumerate(sorted(parts)):
    name = cmap.get(ord(ch))
    if not name:
        continue
    svg = SVGPathPen(glyphs, ntos=lambda v: str(int(round(v))))
    glyphs[name].draw(TransformPen(svg, (1, 0, 0, -1, 0, 0)))
    bp = BoundsPen(glyphs)
    glyphs[name].draw(bp)
    x0, y0, x1, y1 = bp.bounds
    sv, sh = stems(outline_geometry(name))
    out[ch] = {"d": svg.getCommands(), "b": [round(x0), round(-y1), round(x1), round(-y0)], "s": [sv, sh]}
    if i % 300 == 0:
        print(f"{i}/{len(parts)}", file=sys.stderr)

target = ROOT / "public" / "outlines.json"
target.write_text(json.dumps({"upm": 1000, "glyphs": out}, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
print(f"wrote {target}: {len(out)} of {len(parts)} parts, {target.stat().st_size // 1024} KB")
