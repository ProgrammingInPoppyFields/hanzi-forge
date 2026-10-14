// Loads public/strokes.json (see scripts/build-dictionary.mjs).
export async function loadStrokes() {
  const res = await fetch(`${import.meta.env.BASE_URL}strokes.json`);
  if (!res.ok) throw new Error(`Failed to load strokes (${res.status})`);
  return res.json();
}
