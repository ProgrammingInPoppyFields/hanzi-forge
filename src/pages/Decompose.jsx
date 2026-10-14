import React, { useMemo, useState } from "react";
import { DEFAULT_CHARACTER } from "../data/ids-data.js";
import { buildTree } from "../lib/tree-builder.js";
import TreeView from "../components/TreeView.jsx";
import CharacterInput from "../components/CharacterInput.jsx";
import { IdsInlineHtml } from "../components/IdsInline.jsx";

export default function Decompose({ dictionary, loadError }) {
  const [inputChar, setInputChar] = useState(DEFAULT_CHARACTER);
  const ids = dictionary?.ids;

  // Empty input falls back to the default example character.
  const character = inputChar || DEFAULT_CHARACTER;
  const tree = useMemo(() => buildTree(character, ids ?? {}), [character, ids]);

  const info = dictionary?.info[character];
  const hasDecomposition = Boolean(ids?.[character]);

  return (
    <>
      <div className="input-row">
        <CharacterInput value={inputChar} onChange={setInputChar} />
      </div>

      <section className="hero">
        <div className="hero-char">{character}</div>

        <div className="meta-block">
          {info && (
            <div className="meta-line">
              <span className="meta-pinyin">{info.pinyin}</span>
              <span className="meta-meaning">{info.meaning}</span>
            </div>
          )}
          <div className="meta-line meta-ids">
            {hasDecomposition ? <IdsInlineHtml ids={ids[character]} /> : "—"}
          </div>
        </div>
      </section>

      <section className="tree-section">
        {hasDecomposition ? (
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
