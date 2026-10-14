import React from "react";

// ---------------------------------------------------------------------------
// Ideographic Description Characters (U+2FF0-2FFB) have poor, inconsistent
// font coverage across platforms — several common system/browser fonts
// render them as blank "tofu" boxes. Rather than trust the viewer's font
// stack, each operator gets a tiny hand-drawn pictogram that shows its
// actual shape semantics (a split rectangle, an enclosure, an overlay...).
// Works identically standalone (in the metadata line, as plain HTML) and
// nested inside the tree's SVG (an <svg> can be nested inside another).
// ---------------------------------------------------------------------------

const SHAPE = { x0: 2, x1: 22, y0: 2, y1: 22, mid: 12, t1: 2 + 20 / 3, t2: 2 + 40 / 3 };

function shapesFor(operator) {
  const { x0, x1, y0, y1, mid, t1, t2 } = SHAPE;
  const box = <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} />;

  switch (operator) {
    case "⿰": // left / right
      return (
        <>
          {box}
          <line x1={mid} y1={y0} x2={mid} y2={y1} />
        </>
      );
    case "⿱": // top / bottom
      return (
        <>
          {box}
          <line x1={x0} y1={mid} x2={x1} y2={mid} />
        </>
      );
    case "⿲": // left / middle / right
      return (
        <>
          {box}
          <line x1={t1} y1={y0} x2={t1} y2={y1} />
          <line x1={t2} y1={y0} x2={t2} y2={y1} />
        </>
      );
    case "⿳": // top / middle / bottom
      return (
        <>
          {box}
          <line x1={x0} y1={t1} x2={x1} y2={t1} />
          <line x1={x0} y1={t2} x2={x1} y2={t2} />
        </>
      );
    case "⿴": // full enclosure
      return (
        <>
          {box}
          <rect x={mid - 4} y={mid - 4} width={8} height={8} />
        </>
      );
    case "⿻": // overlay
      return (
        <>
          <rect x={x0} y={y0} width={13} height={13} />
          <rect x={x1 - 13} y={y1 - 13} width={13} height={13} />
        </>
      );
    case "⿵": // enclosure from above (open bottom)
      return (
        <>
          <path d={`M${x0},${y1} L${x0},${y0} L${x1},${y0} L${x1},${y1}`} />
          <rect x={mid - 3} y={y1 - 8} width={6} height={6} />
        </>
      );
    case "⿶": // enclosure from below (open top)
      return (
        <>
          <path d={`M${x0},${y0} L${x0},${y1} L${x1},${y1} L${x1},${y0}`} />
          <rect x={mid - 3} y={y0 + 2} width={6} height={6} />
        </>
      );
    case "⿷": // enclosure from left (open right)
      return (
        <>
          <path d={`M${x1},${y0} L${x0},${y0} L${x0},${y1} L${x1},${y1}`} />
          <rect x={x1 - 8} y={mid - 3} width={6} height={6} />
        </>
      );
    case "⿸": // enclosure from upper-left (open lower-right)
      return (
        <>
          <path d={`M${x0},${y1} L${x0},${y0} L${x1},${y0}`} />
          <rect x={x1 - 8} y={y1 - 8} width={6} height={6} />
        </>
      );
    case "⿹": // enclosure from upper-right (open lower-left)
      return (
        <>
          <path d={`M${x0},${y0} L${x1},${y0} L${x1},${y1}`} />
          <rect x={x0 + 2} y={y1 - 8} width={6} height={6} />
        </>
      );
    case "⿺": // enclosure from lower-left (open upper-right)
      return (
        <>
          <path d={`M${x0},${y0} L${x0},${y1} L${x1},${y1}`} />
          <rect x={x1 - 8} y={y0 + 2} width={6} height={6} />
        </>
      );
    default:
      return box;
  }
}

export default function OperatorIcon({
  operator,
  size = 20,
  color = "currentColor",
  className,
  x,
  y,
}) {
  // x/y are only meaningful when this <svg> is nested inside another SVG
  // (positions this sub-viewport there); omitted for standalone HTML use.
  const nestedProps = x != null ? { x: x - size / 2, y: y - size / 2 } : {};

  return (
    <svg
      {...nestedProps}
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ color, display: "inline-block", verticalAlign: "middle", overflow: "visible" }}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {shapesFor(operator)}
    </svg>
  );
}
