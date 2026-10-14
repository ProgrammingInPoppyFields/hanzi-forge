import React from "react";

// Keeps only the first Unicode code point (Array.from is grapheme-aware
// enough to avoid splitting surrogate pairs) — so pasting a whole word
// still leaves exactly one character in the field.
function firstCharacter(value) {
  const chars = Array.from(value);
  return chars.length > 0 ? chars[0] : "";
}

export default function CharacterInput({ value, onChange }) {
  return (
    <input
      className="character-input"
      type="text"
      inputMode="text"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      value={value}
      placeholder="警"
      onChange={(e) => onChange(firstCharacter(e.target.value))}
      aria-label="Enter a Han character"
    />
  );
}
