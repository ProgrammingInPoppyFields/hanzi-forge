import { OPERATORS } from "../data/ids-data.js";
import { parseExpr } from "./tree-builder.js";

// Parses a user-written IDS string and reports how complete it is.
//   missing: empty operand slots still to fill
//   extra:   trailing glyphs that don't belong to the expression
export function parseIds(idsString) {
  const glyphs = Array.from(idsString);
  if (glyphs.length === 0) return { expr: null, missing: 0, extra: 0 };

  const { expr, next } = parseExpr(glyphs, 0);
  return { expr, missing: countMissing(expr), extra: glyphs.length - next };
}

function countMissing(expr) {
  if (!expr.op) return 0;
  const arity = OPERATORS[expr.op].arity;
  return (
    arity - expr.args.length + expr.args.reduce((sum, a) => sum + countMissing(a), 0)
  );
}

// Where each operand sits inside its parent's box, as fractions [x, y, w, h].
// Enclosures give the first operand the whole box and tuck the second inside
// the "open" side; ⿻ just stacks two full boxes. The four row/column
// operators are handled separately (see splitShares) so slot sizes can follow
// how wide or tall each part naturally is.
const SLOTS = {
  "⿴": [[0, 0, 1, 1], [0.25, 0.25, 0.5, 0.5]],
  "⿵": [[0, 0, 1, 1], [0.25, 0.35, 0.5, 0.6]],
  "⿶": [[0, 0, 1, 1], [0.25, 0.05, 0.5, 0.6]],
  "⿷": [[0, 0, 1, 1], [0.35, 0.25, 0.6, 0.5]],
  "⿸": [[0, 0, 1, 1], [0.35, 0.35, 0.6, 0.6]],
  "⿹": [[0, 0, 1, 1], [0.05, 0.35, 0.6, 0.6]],
  "⿺": [[0, 0, 1, 1], [0.35, 0.05, 0.6, 0.6]],
  "⿻": [[0, 0, 1, 1], [0, 0, 1, 1]],
};

const FALLBACK = { w: 600, h: 600 };
const GAP = 1.5; // breathing room around each part, in the 100-unit square

// Rough natural size of an expression, from the skeleton bounding boxes.
function naturalSize(expr, measure) {
  if (!expr) return FALLBACK;
  if (!expr.op) return measure(expr.char) ?? FALLBACK;

  const sizes = expr.args.map((a) => naturalSize(a, measure));
  switch (expr.op) {
    case "⿰":
    case "⿲":
      return { w: sum(sizes, "w"), h: Math.max(...sizes.map((z) => z.h)) };
    case "⿱":
    case "⿳":
      return { w: Math.max(...sizes.map((z) => z.w)), h: sum(sizes, "h") };
    default:
      return sizes[0] ?? FALLBACK;
  }
}

const sum = (sizes, key) => sizes.reduce((total, z) => total + z[key], 0);

// Share of the row/column each operand gets: proportional to its natural
// width/height (so 亻 stays slim next to 木), but clamped so no part vanishes.
function splitShares(expr, measure, key) {
  const arity = OPERATORS[expr.op].arity;
  const natural = Array.from({ length: arity }, (_, i) => naturalSize(expr.args[i], measure)[key]);
  const total = sum(natural.map((v) => ({ v })), "v");
  const [lo, hi] = arity === 2 ? [0.32, 0.68] : [0.2, 0.5];
  const clamped = natural.map((v) => Math.min(hi, Math.max(lo, v / total)));
  const norm = clamped.reduce((a, b) => a + b, 0);
  return clamped.map((v) => v / norm);
}

// A compound outer part (e.g. 麻 around 鬼 in 魔) can't be drawn full-size
// with something on top of it, so the corner enclosures fall back to a
// staggered stack: the outer part claims one band, the inner overlaps it a bit.
const COMPOUND_OUTER_SLOTS = {
  "⿸": [[0, 0, 1, 0.62], [0.15, 0.5, 0.85, 0.5]],
  "⿹": [[0, 0, 1, 0.62], [0, 0.5, 0.85, 0.5]],
  "⿺": [[0, 0.38, 1, 0.62], [0.15, 0, 0.85, 0.5]],
};

const COMPLEX_STROKES = 8;

function slotsFor(expr, measure) {
  const outer = expr.args[0];
  const complexOuter = outer && (outer.op || (measure(outer.char)?.strokes ?? 0) >= COMPLEX_STROKES);
  if (complexOuter && COMPOUND_OUTER_SLOTS[expr.op]) return COMPOUND_OUTER_SLOTS[expr.op];

  const horizontal = expr.op === "⿰" || expr.op === "⿲";
  const vertical = expr.op === "⿱" || expr.op === "⿳";
  if (!horizontal && !vertical) return SLOTS[expr.op];

  const shares = splitShares(expr, measure, horizontal ? "w" : "h");
  let cursor = 0;
  return shares.map((share) => {
    const start = cursor;
    cursor += share;
    return horizontal ? [start, 0, share, 1] : [0, start, 1, share];
  });
}

// Flattens an expression into positioned boxes inside a size x size square:
//   { char, x, y, w, h }  for a placed component
//   { empty: true, x, y, w, h }  for an unfilled slot
// `measure(char)` returns a part's natural { w, h, strokes } (or null if unknown).
export function layoutGlyph(expr, measure = () => null, size = 100, box = { x: 0, y: 0, w: size, h: size }) {
  if (expr === null) return [{ empty: true, ...box }];
  if (!expr.op) {
    return [{ char: expr.char, x: box.x + GAP, y: box.y + GAP, w: box.w - 2 * GAP, h: box.h - 2 * GAP }];
  }

  return slotsFor(expr, measure).flatMap(([fx, fy, fw, fh], i) =>
    layoutGlyph(expr.args[i] ?? null, measure, size, {
      x: box.x + fx * box.w,
      y: box.y + fy * box.h,
      w: fw * box.w,
      h: fh * box.h,
    })
  );
}

// IDS string -> first character that has exactly that decomposition.
export function buildReverseIndex(idsMap) {
  const reverse = new Map();
  for (const [char, ids] of Object.entries(idsMap)) {
    if (!reverse.has(ids)) reverse.set(ids, char);
  }
  return reverse;
}
