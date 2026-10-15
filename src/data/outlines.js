// Loads public/outlines.json (see scripts/build-outlines.py): typeface outlines for every part.
export async function loadOutlines() {
  const res = await fetch(`${import.meta.env.BASE_URL}outlines.json`);
  if (!res.ok) throw new Error(`Failed to load outlines (${res.status})`);
  return res.json();
}
