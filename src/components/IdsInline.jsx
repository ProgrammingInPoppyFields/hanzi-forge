import React from "react";
import { OPERATORS } from "../data/ids-data.js";
import OperatorIcon from "./OperatorIcon.jsx";

// Renders a raw IDS string (e.g. "⿱敬言") as a mix of plain character
// text and the vector OperatorIcon — used anywhere a raw IDS expression is
// shown outside the main tree (the metadata line, the on-hover caption),
// so the operator never falls back to a font's missing-glyph box.

export function IdsInlineHtml({ ids, iconSize = 14 }) {
  return (
    <span className="ids-inline">
      {Array.from(ids).map((ch, i) =>
        OPERATORS[ch] ? (
          <OperatorIcon key={i} operator={ch} size={iconSize} />
        ) : (
          <span key={i}>{ch}</span>
        )
      )}
    </span>
  );
}

// SVG variant: lays glyphs out along a single row by hand (SVG text has no
// inline-flow of its own), centered under (x, y).
export function IdsInlineSvg({ ids, x = 0, y = 0 }) {
  const glyphs = Array.from(ids);
  const slot = 15;
  const totalWidth = glyphs.length * slot;
  const startX = x - totalWidth / 2 + slot / 2;

  return (
    <g>
      {glyphs.map((ch, i) => {
        const cx = startX + i * slot;
        return OPERATORS[ch] ? (
          <OperatorIcon key={i} operator={ch} size={13} x={cx} y={y} />
        ) : (
          <text key={i} x={cx} y={y} textAnchor="middle" dominantBaseline="central">
            {ch}
          </text>
        );
      })}
    </g>
  );
}
