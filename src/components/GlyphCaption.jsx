import React from "react";
import { IdsInlineHtml } from "./IdsInline.jsx";

// The label stack under the big character, identical on both sides:
//   line 1: reading (bold) + meaning (gray)      line 2: the IDS string      then any notes
// Decompose fills it from the dictionary; Compose fills the same slots for an invented character.
export default function GlyphCaption({ primary, tone, secondary, ids, notes = [] }) {
  return (
    <div className="meta-block">
      <div className="meta-line">
        <span className={`meta-pinyin${tone ? ` meta-pinyin--${tone}` : ""}`}>{primary}</span>
        <span className="meta-meaning">{secondary}</span>
      </div>
      <div className="meta-line meta-ids">{ids ? <IdsInlineHtml ids={ids} /> : "—"}</div>
      {notes.map((n) => (
        <div key={n.text} className={`meta-line forge-status forge-status--${n.kind}`}>
          {n.text}
        </div>
      ))}
    </div>
  );
}
