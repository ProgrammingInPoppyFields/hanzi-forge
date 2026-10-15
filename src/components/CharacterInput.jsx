import React, { useState } from "react";

// First Unicode code point (Array.from keeps surrogate pairs whole).
function firstCharacter(value) {
  const chars = Array.from(value);
  return chars.length > 0 ? chars[0] : "";
}

// What the user just entered, given what the field held before: typing next to the old
// character should give the new one, and typing over a selection should give that.
function newestCharacter(before, value) {
  if (before && value.startsWith(before) && value.length > before.length) {
    return firstCharacter(value.slice(before.length));
  }
  return firstCharacter(value);
}

export default function CharacterInput({ value, onChange }) {
  // While an IME (e.g. Pinyin) is composing, the box holds uncommitted Latin letters. Rewriting
  // the value at that point cancels the composition, so leave it alone until it is committed.
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <input
      className="character-input"
      type="text"
      inputMode="text"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      value={composing ? draft : value}
      placeholder="警"
      onCompositionStart={(e) => {
        setComposing(true);
        setDraft(e.target.value);
      }}
      onCompositionEnd={(e) => {
        setComposing(false);
        onChange(newestCharacter(value, e.target.value));
      }}
      onChange={(e) => {
        if (composing) setDraft(e.target.value);
        else onChange(newestCharacter(value, e.target.value));
      }}
      onPaste={(e) => {
        e.preventDefault();
        onChange(firstCharacter(e.clipboardData.getData("text").trim()));
      }}
      aria-label="Enter a Han character"
    />
  );
}
