import React from "react";
import { layoutGlyph } from "../lib/ids-compose.js";
import { getGlyph, fitGlyph } from "../lib/stroke-glyph.js";

// Draws an invented character. Each part's stroke skeleton is squeezed into
// its slot and re-stroked at one shared line weight, so a crowded character
// looks like one hand wrote it rather than several pasted-in glyphs. (Parts
// with no skeleton fall back to a stretched font glyph.) Unfilled slots show
// as dashed boxes.
const STROKE_WIDTH = 3.2;
const FALLBACK_FONT_SIZE = 92;

export default function ComposedGlyph({ expr, strokes }) {
  const measure = (char) => {
    const glyph = getGlyph(strokes, char);
    return glyph && { w: Math.max(glyph.w, 90), h: Math.max(glyph.h, 90), strokes: glyph.lines.length };
  };
  const boxes = layoutGlyph(expr, measure);

  return (
    <svg className="composed-glyph" viewBox="0 0 100 100" role="img" aria-label="Composed character">
      {boxes.map((b, i) => {
        if (b.empty) {
          return (
            <rect
              key={i}
              className="composed-glyph__empty"
              x={b.x + 2}
              y={b.y + 2}
              width={Math.max(b.w - 4, 0)}
              height={Math.max(b.h - 4, 0)}
            />
          );
        }

        const glyph = getGlyph(strokes, b.char);
        if (glyph) {
          return <path key={i} className="composed-glyph__stroke" d={fitGlyph(glyph, b)} strokeWidth={STROKE_WIDTH} />;
        }

        return (
          <text
            key={i}
            className="composed-glyph__char"
            fontSize={FALLBACK_FONT_SIZE}
            textAnchor="middle"
            dominantBaseline="central"
            transform={`translate(${b.x + b.w / 2} ${b.y + b.h / 2}) scale(${b.w / 100} ${b.h / 100})`}
          >
            {b.char}
          </text>
        );
      })}
    </svg>
  );
}
