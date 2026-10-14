// Stroke skeletons: each character is a list of polylines (its stroke centre
// lines), in a ~1024-unit space, y pointing down. Parsed once per character.
const cache = new Map();

export function getGlyph(strokes, char) {
  const raw = strokes?.[char];
  if (!raw) return null;
  if (cache.has(raw)) return cache.get(raw);

  const lines = raw.split(";").map((stroke) =>
    stroke.split(" ").map((pt) => pt.split(",").map(Number))
  );
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const line of lines) {
    for (const [x, y] of line) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  const glyph = { lines, x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
  cache.set(raw, glyph);
  return glyph;
}

// How much a part may stretch to fill its slot: 0 keeps its natural
// proportions, 1 stretches it fully (what the old font-based version did).
const STRETCH = 0.55;
const MIN_EXTENT = 90; // keeps 一 / 丨 (zero thickness) from producing infinite scale

// Maps a glyph's skeleton into `box` (in the output space), returning SVG
// path data. Stretching is blended so parts squeeze but don't distort wildly,
// and the result is centred, so a narrow part like 亻 stays narrow.
export function fitGlyph(glyph, box) {
  const bw = Math.max(glyph.w, MIN_EXTENT);
  const bh = Math.max(glyph.h, MIN_EXTENT);
  const fullX = box.w / bw;
  const fullY = box.h / bh;
  const uniform = Math.min(fullX, fullY);
  const sx = uniform ** (1 - STRETCH) * fullX ** STRETCH;
  const sy = uniform ** (1 - STRETCH) * fullY ** STRETCH;

  const cx = (glyph.x0 + glyph.x1) / 2;
  const cy = (glyph.y0 + glyph.y1) / 2;
  const ox = box.x + box.w / 2;
  const oy = box.y + box.h / 2;

  return glyph.lines
    .map((line) =>
      line
        .map(([x, y], i) => {
          const px = (ox + (x - cx) * sx).toFixed(1);
          const py = (oy + (y - cy) * sy).toFixed(1);
          return `${i === 0 ? "M" : "L"}${px} ${py}`;
        })
        .join(" ")
    )
    .join(" ");
}
