// Downloads Make Me a Hanzi's dictionary.txt (or reads a local copy if a path
// is passed as the first argument) and writes a trimmed public/dictionary.json:
//   { ids: { 字: "⿰…" }, info: { 字: { pinyin, meaning } } }
// It also writes public/strokes.json: stroke skeletons (Make Me a Hanzi
// "medians") for every character used as a part, so Compose can draw new
// characters with one consistent line weight. y is flipped to screen
// orientation. Format: { 字: "x,y x,y ...;x,y ..." } (strokes split by ";").
// Optional 2nd argument: local path to graphics.txt.
// Run with: npm run build:data
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SOURCE_URL =
  "https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt";
const GRAPHICS_URL =
  "https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt";
const STROKES_OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/strokes.json"
);
const OUT_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/dictionary.json"
);

const localPath = process.argv[2];
const raw = localPath
  ? await readFile(localPath, "utf8")
  : await (await fetch(SOURCE_URL)).text();

const ids = {};
const info = {};

for (const line of raw.split("\n")) {
  if (!line.trim()) continue;
  const entry = JSON.parse(line);
  const char = entry.character;

  // Keep only real IDS expressions (starting with an operator U+2FF0-2FFB);
  // a bare "？" means the source has no decomposition for this character.
  if (/^[\u2FF0-\u2FFB]/.test(entry.decomposition || "")) {
    ids[char] = entry.decomposition;
  }

  const pinyin = (entry.pinyin || []).join(", ");
  const meaning = entry.definition || "";
  if (pinyin || meaning) info[char] = { pinyin, meaning };
}

await mkdir(path.dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, JSON.stringify({ ids, info }));
console.log(
  `Wrote ${OUT_FILE}: ${Object.keys(ids).length} decompositions, ${Object.keys(info).length} info entries`
);

// ---- stroke skeletons for every character that appears as a part ----
const parts = new Set();
for (const expression of Object.values(ids)) {
  for (const glyph of Array.from(expression)) {
    if (!/[\u2FF0-\u2FFB？]/.test(glyph)) parts.add(glyph);
  }
}

const graphicsPath = process.argv[3];
const graphicsRaw = graphicsPath
  ? await readFile(graphicsPath, "utf8")
  : await (await fetch(GRAPHICS_URL)).text();

const strokes = {};
for (const line of graphicsRaw.split("\n")) {
  if (!line.trim()) continue;
  const entry = JSON.parse(line);
  if (!parts.has(entry.character)) continue;
  strokes[entry.character] = entry.medians
    .map((median) => median.map(([x, y]) => `${x},${900 - y}`).join(" "))
    .join(";");
}

await writeFile(STROKES_OUT, JSON.stringify(strokes));
console.log(`Wrote ${STROKES_OUT}: ${Object.keys(strokes).length} of ${parts.size} parts`);
