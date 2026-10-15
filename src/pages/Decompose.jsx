import React, { useMemo, useState } from "react";
import { DEFAULT_CHARACTER } from "../data/ids-data.js";
import { buildTree } from "../lib/tree-builder.js";
import TreeView from "../components/TreeView.jsx";
import CharacterInput from "../components/CharacterInput.jsx";
import GlyphCaption from "../components/GlyphCaption.jsx";

export default function Decompose({ dictionary, loadError, char, setChar, onOpenInCompose }) {
  const [copied, setCopied] = useState(false);
  const ids = dictionary?.ids;

  // Empty input falls back to the default example character.
  const character = char || DEFAULT_CHARACTER;
  const tree = useMemo(() => buildTree(character, ids ?? {}), [character, ids]);

  const info = dictionary?.info[character];
  const decomposition = ids?.[character];
  const canCompose = Boolean(decomposition) && !decomposition.includes("？");

  function surprise() {
    if (!ids) return;
    const keys = Object.keys(ids);
    setChar(keys[Math.floor(Math.random() * keys.length)]);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(character);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard can be blocked; the character is still selectable on the page.
    }
  }

  return (
    <>
      <section className="forge-input">
        <div className="field-wrap">
          <CharacterInput value={char} onChange={setChar} />
          <span className="field-hint">one Han character · type or paste</span>
        </div>
        <div className="forge-actions">
          <button type="button" onClick={surprise} disabled={!ids}>Surprise me</button>
          <button type="button" onClick={() => setChar("")} disabled={!char}>Clear</button>
          <button type="button" onClick={copy}>{copied ? "Copied" : "Copy character"}</button>
          <button type="button" onClick={() => onOpenInCompose(decomposition)} disabled={!canCompose}>
            Open in Compose ↑
          </button>
        </div>
      </section>

      <section className="hero">
        <div className="hero-glyph">
          <span className="hero-char">{character}</span>
        </div>
        <GlyphCaption
          primary={info ? info.pinyin : "—"}
          secondary={info ? info.meaning : "no reading in the dictionary"}
          ids={decomposition}
        />
      </section>

      <section className="tree-section">
        {decomposition ? (
          <TreeView tree={tree} />
        ) : (
          <p className="no-decomposition">
            {loadError
              ? "Could not load the dictionary. Run npm run build:data."
              : !dictionary
                ? "Loading dictionary…"
                : "No decomposition available in this prototype."}
          </p>
        )}
      </section>
    </>
  );
}
