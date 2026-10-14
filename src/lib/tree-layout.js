// ---------------------------------------------------------------------------
// Tree layout — a simple tidy-tree approximation, hand-rolled (no d3-hierarchy
// or similar). Good enough for the shallow, low-arity trees IDS decomposition
// produces (max arity 3, rarely more than 5-6 levels deep).
//
// Algorithm, in two passes:
//
//   1. Bottom-up: give every node a "slot width" — a leaf gets a fixed
//      minimum width; an internal node's width is the sum of its
//      children's widths plus the gaps between them (so a subtree never
//      overlaps its neighbor).
//
//   2. Top-down: walk the tree again, this time handing each node a
//      starting x offset. A node is centered over the horizontal span of
//      its children; a childless node is centered in its own slot. `y` is
//      just depth * rowHeight, since depth already encodes the row.
//
// The result is a *new* tree (nodes are shallow-cloned with x/y/width
// added) — the input tree from tree-builder.js is left untouched.
// ---------------------------------------------------------------------------

export const LAYOUT_CONSTANTS = {
  leafWidth: 76, // minimum horizontal slot for a childless node
  hGap: 22, // horizontal gap between sibling subtrees
  rowHeight: 96, // vertical distance between depth levels
  topPadding: 40,
  sidePadding: 40,
};

function computeWidth(node, constants) {
  if (node.children.length === 0) {
    return { ...node, _width: constants.leafWidth, children: [] };
  }

  const laidOutChildren = node.children.map((child) => computeWidth(child, constants));
  const childrenWidth =
    laidOutChildren.reduce((sum, c) => sum + c._width, 0) +
    constants.hGap * (laidOutChildren.length - 1);

  const width = Math.max(childrenWidth, constants.leafWidth);

  return { ...node, _width: width, children: laidOutChildren };
}

function assignPosition(node, xStart, constants) {
  const centerX = xStart + node._width / 2;
  const y = constants.topPadding + node.depth * constants.rowHeight;

  if (node.children.length === 0) {
    return { ...node, x: centerX, y };
  }

  let cursor = xStart + (node._width - childrenSpan(node, constants)) / 2;
  const children = node.children.map((child) => {
    const laidOut = assignPosition(child, cursor, constants);
    cursor += child._width + constants.hGap;
    return laidOut;
  });

  return { ...node, x: centerX, y, children };
}

function childrenSpan(node, constants) {
  return (
    node.children.reduce((sum, c) => sum + c._width, 0) +
    constants.hGap * (node.children.length - 1)
  );
}

// Computes the total width/height so the caller can size an SVG viewBox.
function measure(node, constants) {
  let maxDepth = node.depth;
  (function walk(n) {
    maxDepth = Math.max(maxDepth, n.depth);
    n.children.forEach(walk);
  })(node);

  return {
    width: node._width + constants.sidePadding * 2,
    height: constants.topPadding * 2 + maxDepth * constants.rowHeight,
  };
}

export function layoutTree(root, constants = LAYOUT_CONSTANTS) {
  const withWidths = computeWidth(root, constants);
  const { width, height } = measure(withWidths, constants);
  const positioned = assignPosition(withWidths, constants.sidePadding, constants);
  return { root: positioned, width, height };
}
