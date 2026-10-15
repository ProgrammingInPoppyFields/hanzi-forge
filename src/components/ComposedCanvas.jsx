import React, { useEffect, useRef } from "react";
import { paintGlyph } from "../lib/glyph-fit.js";

// The invented character, drawn in the same typeface as the Decompose side (see lib/glyph-fit.js).
const SIZE = 900; // backing pixels; the element scales down with CSS

export default function ComposedCanvas({ outlines, composed }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) paintGlyph(ref.current, outlines, composed);
  }, [outlines, composed]);

  return (
    <canvas
      ref={ref}
      className="composed-canvas"
      width={SIZE}
      height={SIZE}
      role="img"
      aria-label="Composed character"
    />
  );
}

// A small rendering of the composed glyph as an image URL, for the tree's root node.
export function glyphDataUrl(outlines, composed, px = 120) {
  if (!composed || typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  paintGlyph(canvas, outlines, composed);
  return canvas.toDataURL("image/png");
}
