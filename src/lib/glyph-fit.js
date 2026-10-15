// ---------------------------------------------------------------------------
// Typeset invented characters.
//
// Draws a composed character from real typeface outlines (Noto Sans SC Regular, see
// scripts/build-outlines.py) instead of stretched glyphs or hand strokes:
//
//   * every part is scaled into its slot, then its outline is grown or shrunk so that vertical AND
//     horizontal stems come out at one thickness T (the offset is elliptical: canvas strokes in a
//     non-uniformly scaled space use an elliptical pen)
//   * an enclosed part goes into the real empty space inside its enclosing part (found by
//     rasterising the outer part and searching for the largest free rectangle)
//   * parts that still touch are shrunk until they clear
//
// Geometry decisions run on small bitmaps; the final drawing is vector-sharp at any size.
// ---------------------------------------------------------------------------
import { layoutGlyph } from "./ids-compose.js";
import { getGlyph } from "./stroke-glyph.js";

const ENCLOSING = "⿴⿵⿶⿷⿸⿹⿺";
const GAP = 1.6; // minimum clear space between parts (100-unit square)
const STRETCH = 0.35; // how far a part may stretch beyond its natural proportions
const THIN = 300; // thin parts (一 丨 丿) never stretch across their thin axis
const MIN_EXT = 90;
const MAX_ERODE = 26; // font units
const K = 2; // pixels per unit for geometry bitmaps

const pathCache = new WeakMap();
function pathOf(outlines, ch) {
  let map = pathCache.get(outlines);
  if (!map) pathCache.set(outlines, (map = new Map()));
  if (!map.has(ch)) map.set(ch, new Path2D(outlines.glyphs[ch].d));
  return map.get(ch);
}

// ---------------------------------------------------------------- planning
export function makeMeasure(outlines, strokes) {
  return (char) => {
    const g = outlines.glyphs[char];
    if (!g) return null;
    const [x0, y0, x1, y1] = g.b;
    const sk = getGlyph(strokes, char);
    return { w: Math.max(x1 - x0, 90), h: Math.max(y1 - y0, 90), strokes: sk ? sk.lines.length : 3 };
  };
}

function planFor(expr, measure) {
  const leaves = layoutGlyph(expr, measure).filter((b) => !b.empty);
  const groups = [];
  const enclosures = [];
  let idx = 0;
  (function walk(e, group) {
    if (!e.op) {
      groups[idx++] = group;
      return;
    }
    const start = idx;
    const g = e.op === "⿻" ? `overlay${start}` : group;
    e.args.forEach((a) => walk(a, g));
    if (ENCLOSING.includes(e.op) && e.args.length === 2 && !e.args[0].op && !e.args[1].op) {
      enclosures.push({ outer: start, inner: start + 1 });
    }
  })(expr, null);

  const parts = leaves.map((b, i) => ({ char: b.char, box: { x: b.x, y: b.y, w: b.w, h: b.h }, group: groups[i] }));
  // heavier stems for simple characters; lighter as they get denser or their slots get smaller
  const total = leaves.reduce((t, b) => t + (measure(b.char)?.strokes ?? 3), 0);
  const minDim = Math.min(...leaves.map((b) => Math.min(b.w, b.h)));
  const T = Math.max(1.8, Math.min(7.0, 4.7 + (19 - total) * 0.3, 0.09 * minDim));
  return { T, parts, enclosures };
}

// One stem thickness for the whole character. Each part has a natural stem at the size it ends up
// (font stem x scale); the common stem sits a little above the lightest part (so small parts are never
// clogged), never above the median (so nothing is made heavier than text would be), and never so
// low that the biggest part would be thinned past what its outline can take.
function commonStem(outlines, placed) {
  const natural = placed.map((p) => {
    const g = outlines.glyphs[p.char];
    return (g.s[0] * p.sx + g.s[1] * p.sy) / 2;
  });
  const sorted = [...natural].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const lightest = sorted[0];
  const floor = 0.4 * sorted[sorted.length - 1];
  return Math.max(1.4, Math.min(8, Math.max(floor, Math.min(lightest * 1.3, median))));
}

// ---------------------------------------------------------------- fitting one part
function placePart(outlines, char, box, T) {
  const g = outlines.glyphs[char];
  const [x0, y0, x1, y1] = g.b;
  const w = x1 - x0;
  const h = y1 - y0;
  const [sv, sh] = g.s;

  const fullX = Math.max(box.w - T, 1) / Math.max(w, MIN_EXT);
  const fullY = Math.max(box.h - T, 1) / Math.max(h, MIN_EXT);
  const u = Math.min(fullX, fullY);
  let sx = w >= THIN ? u ** (1 - STRETCH) * fullX ** STRETCH : u;
  let sy = h >= THIN ? u ** (1 - STRETCH) * fullY ** STRETCH : u;

  let dx = 0;
  let dy = 0;
  for (let i = 0; i < 4; i++) {
    // the offset depends on the scale and the scale on the offset; growing/shrinking moves the ink box by d on each side
    dx = Math.max((T / sx - sv) / 2, -MAX_ERODE);
    dy = Math.max((T / sy - sh) / 2, -MAX_ERODE);
    const f = Math.min(box.w / ((w + 2 * dx) * sx), box.h / ((h + 2 * dy) * sy), 1);
    sx *= f;
    sy *= f;
  }
  dx = Math.max((T / sx - sv) / 2, -MAX_ERODE);
  dy = Math.max((T / sy - sh) / 2, -MAX_ERODE);

  return {
    char, box: { ...box }, sx, sy, dx, dy,
    cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
    ox: box.x + box.w / 2, oy: box.y + box.h / 2,
  };
}

// ---------------------------------------------------------------- drawing one part
const matrixFor = (p, k, origin) =>
  new DOMMatrix()
    .translate(-origin.x * k, -origin.y * k)
    .scale(k)
    .translate(p.ox - p.sx * p.cx, p.oy - p.sy * p.cy)
    .scale(p.sx, p.sy);

function dilate(ctx, path, M, rx, ry) {
  const ex = Math.max(rx, 0.01);
  const ey = Math.max(ry, 0.01);
  const warped = new Path2D();
  warped.addPath(path, new DOMMatrix().scale(1 / ex, 1 / ey));
  ctx.save();
  ctx.setTransform(M.multiply(new DOMMatrix().scale(ex, ey)));
  ctx.lineWidth = 2;
  ctx.lineJoin = "miter";
  ctx.miterLimit = 3;
  ctx.fill(warped, "evenodd");
  ctx.stroke(warped);
  ctx.restore();
}

function erode(ctx, path, M, rx, ry) {
  ctx.save();
  ctx.setTransform(M);
  ctx.fill(path, "evenodd");
  ctx.restore();
  const warped = new Path2D();
  const ex = Math.max(rx, 0.01);
  const ey = Math.max(ry, 0.01);
  warped.addPath(path, new DOMMatrix().scale(1 / ex, 1 / ey));
  ctx.save();
  ctx.setTransform(M.multiply(new DOMMatrix().scale(ex, ey)));
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineWidth = 2;
  ctx.lineJoin = "miter";
  ctx.miterLimit = 3;
  ctx.stroke(warped);
  ctx.restore();
}

// `extra` grows the part further by that many output units (used for clearance tests)
function paintPart(ctx, outlines, p, M, extra = 0) {
  const path = pathOf(outlines, p.char);
  const rx = p.dx + extra / p.sx;
  const ry = p.dy + extra / p.sy;
  if (rx + ry >= 0) dilate(ctx, path, M, Math.max(rx, 0.01), Math.max(ry, 0.01));
  else erode(ctx, path, M, Math.max(-rx, 0.01), Math.max(-ry, 0.01));
}

function newCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

// the whole 100x100 square as a K-px-per-unit bitmap (1 = ink)
function maskOf(outlines, p, extra = 0) {
  const n = 100 * K;
  const canvas = newCanvas(n, n);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  paintPart(ctx, outlines, p, matrixFor(p, K, { x: 0, y: 0 }), extra);
  const data = ctx.getImageData(0, 0, n, n).data;
  const mask = new Uint8Array(n * n);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 110 ? 1 : 0;
  return mask;
}

// ---------------------------------------------------------------- enclosed parts
function freeRect(outlines, outer, nominal, T, region) {
  const n = 100 * K;
  const occupied = maskOf(outlines, outer, GAP * 2 + T / 2);
  const free = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const ux = (x + 0.5) / K;
      const uy = (y + 0.5) / K;
      const inside = ux >= region.x && ux <= region.x + region.w && uy >= region.y && uy <= region.y + region.h;
      free[y * n + x] = inside && !occupied[y * n + x] ? 1 : 0;
    }
  }
  const sat = new Int32Array((n + 1) * (n + 1));
  for (let y = 0; y < n; y++) {
    let row = 0;
    for (let x = 0; x < n; x++) {
      row += free[y * n + x];
      sat[(y + 1) * (n + 1) + (x + 1)] = sat[y * (n + 1) + (x + 1)] + row;
    }
  }
  const allFree = (x, y, w, h) => {
    const xa = Math.ceil(x * K), ya = Math.ceil(y * K), xb = Math.floor((x + w) * K), yb = Math.floor((y + h) * K);
    if (xa < 0 || ya < 0 || xb > n || yb > n || xb <= xa || yb <= ya) return false;
    const s = (yy, xx) => sat[yy * (n + 1) + xx];
    return s(yb, xb) - s(ya, xb) - s(yb, xa) + s(ya, xa) === (xb - xa) * (yb - ya);
  };

  const ncx = nominal.x + nominal.w / 2;
  const ncy = nominal.y + nominal.h / 2;
  const centers = [];
  for (let cx = 0; cx <= 100; cx += 1) {
    for (let cy = 0; cy <= 100; cy += 1) {
      const d2 = (cx - ncx) ** 2 + (cy - ncy) ** 2;
      if (d2 <= 900) centers.push([cx, cy, d2]);
    }
  }
  centers.sort((a, b) => a[2] - b[2]);
  for (let s = 1; s >= 0.25; s -= 0.05) {
    const rw = nominal.w * s;
    const rh = nominal.h * s;
    for (const [cx, cy] of centers) {
      if (allFree(cx - rw / 2, cy - rh / 2, rw, rh)) return { x: cx - rw / 2, y: cy - rh / 2, w: rw, h: rh };
    }
  }
  const s = 0.4;
  return { x: ncx - (nominal.w * s) / 2, y: ncy - (nominal.h * s) / 2, w: nominal.w * s, h: nominal.h * s };
}

const overlaps = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] && b[i]) return true;
  return false;
};

// ---------------------------------------------------------------- public API
// Returns { placed, T }; null if some part has no outline.
export function composeGlyph(outlines, expr, strokes) {
  const measure = makeMeasure(outlines, strokes);
  const plan = planFor(expr, measure);
  if (plan.parts.some((p) => !outlines.glyphs[p.char])) return null;

  const { parts, enclosures } = plan;
  const innerOf = new Map(enclosures.map((e) => [e.inner, e.outer]));

  const placeAll = (T) => {
    const out = new Array(parts.length);
    parts.forEach((p, i) => {
      if (!innerOf.has(i)) out[i] = placePart(outlines, p.char, p.box, T);
    });
    for (const [j, i] of innerOf) {
      const box = freeRect(outlines, out[i], parts[j].box, T, parts[i].box);
      out[j] = placePart(outlines, parts[j].char, box, T);
    }
    return out;
  };

  // place once to see how big every part really ends up, choose the common stem from that, place again
  const T = commonStem(outlines, placeAll(3));
  const placed = placeAll(T);

  // resolve any remaining collisions by shrinking the smaller (or enclosed) part
  for (let round = 0; round < 40; round++) {
    let clash = false;
    const solid = placed.map((p) => maskOf(outlines, p));
    const padded = placed.map((p) => maskOf(outlines, p, GAP * 0.5));
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const gi = parts[i].group;
        if (gi != null && gi === parts[j].group) continue;
        if (!overlaps(padded[i], solid[j])) continue;
        clash = true;
        let k = innerOf.has(j) || areaOf(placed[j]) <= areaOf(placed[i]) ? j : i;
        if (innerOf.get(i) === j) k = i;
        const b = placed[k].box;
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const box = { x: cx - (b.w * 0.93) / 2, y: cy - (b.h * 0.93) / 2, w: b.w * 0.93, h: b.h * 0.93 };
        placed[k] = placePart(outlines, parts[k].char, box, T);
        solid[k] = maskOf(outlines, placed[k]);
        padded[k] = maskOf(outlines, placed[k], GAP * 0.5);
      }
    }
    if (!clash) break;
  }
  return { placed, T };
}

const areaOf = (p) => p.box.w * p.box.h;

// Paints a composed glyph onto a canvas element (square; the 100-unit square fills it).
export function paintGlyph(canvas, outlines, composed, { color = "#111" } = {}) {
  const px = canvas.width;
  const k = px / 100;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, px, px);
  if (!composed) return;

  for (const p of composed.placed) {
    const m = 10; // margin around the slot, in units, for outline growth
    const origin = { x: Math.max(p.box.x - m, 0), y: Math.max(p.box.y - m, 0) };
    const w = Math.ceil((Math.min(p.box.x + p.box.w + m, 100) - origin.x) * k);
    const h = Math.ceil((Math.min(p.box.y + p.box.h + m, 100) - origin.y) * k);
    const tmp = newCanvas(w, h);
    const tctx = tmp.getContext("2d");
    paintPart(tctx, outlines, p, matrixFor(p, k, origin));
    tctx.globalCompositeOperation = "source-in";
    tctx.fillStyle = color;
    tctx.fillRect(0, 0, w, h);
    ctx.drawImage(tmp, origin.x * k, origin.y * k);
  }
}
