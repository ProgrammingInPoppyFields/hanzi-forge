import React, { useRef, useState } from "react";
import { OPERATORS } from "../data/ids-data.js";
import OperatorIcon from "./OperatorIcon.jsx";

// The Compose input. Operators (⿰ ⿱ ...) have no reliable font glyphs, so the field shows
// the expression as tokens: parts as characters and operators as their pictograms.
// Typing, pasting and Backspace all work on the (invisible) text input laid over the strip.
// "show raw text" swaps to a plain text box, for copying or pasting the literal IDS characters.
export default function IdsField({ ids, onChange, onUndo }) {
  const inputRef = useRef(null);
  const [raw, setRaw] = useState(false);

  function commit(text) {
    const clean = text.replace(/\s/g, "");
    if (!clean) return;
    // pasting/typing a whole expression (starts with an operator) replaces; anything else appends
    onChange(OPERATORS[Array.from(clean)[0]] ? clean : ids + clean);
  }

  function flush(el) {
    commit(el.value);
    el.value = "";
  }

  return (
    <div className="ids-field-wrap">
      {raw ? (
        <input
          className="ids-field ids-field--raw"
          type="text"
          value={ids}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, ""))}
          placeholder="paste an IDS string"
          spellCheck={false}
          aria-label="IDS string (raw text)"
        />
      ) : (
        <div className="ids-field" onClick={() => inputRef.current?.focus()}>
          <div className="ids-field__tokens" aria-label="Current IDS expression">
            {Array.from(ids).map((ch, i) =>
              OPERATORS[ch] ? (
                <OperatorIcon key={i} operator={ch} size={30} className="ids-field__op" />
              ) : (
                <span key={i} className="ids-field__char">{ch}</span>
              )
            )}
            <span className="ids-field__caret" />
            {!ids && <span className="ids-field__hint">type, paste, or pick below</span>}
          </div>
          <input
            ref={inputRef}
            className="ids-field__capture"
            type="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Type or paste parts"
            onInput={(e) => {
              if (!e.nativeEvent.isComposing) flush(e.target);
            }}
            onCompositionEnd={(e) => flush(e.target)}
            onPaste={(e) => {
              e.preventDefault();
              commit(e.clipboardData.getData("text"));
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !e.target.value) onUndo();
            }}
          />
        </div>
      )}

      <button type="button" className="ids-field__toggle" onClick={() => setRaw((r) => !r)}>
        {raw ? "show icons" : "show raw text"}
      </button>
    </div>
  );
}
