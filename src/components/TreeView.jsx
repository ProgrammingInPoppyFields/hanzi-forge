import React, { useEffect, useMemo, useState } from "react";
import { indexTree, collectDescendantIds } from "../lib/tree-builder.js";
import { layoutTree } from "../lib/tree-layout.js";
import IDSTree from "./IDSTree.jsx";

// Lays out a built tree and owns hover / pin highlighting, so both pages
// (Decompose and Compose) get identical tree behavior.
// `flip` draws the tree upside down (leaves on top, root at the bottom) for Compose.
function flipY(node, h) {
  return { ...node, y: h - node.y, children: node.children.map((c) => flipY(c, h)) };
}

const FLIP_STUB = 40; // extra room below a flipped tree for the line down into the big glyph

export default function TreeView({ tree, flip = false }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [pinnedId, setPinnedId] = useState(null);

  const laid = useMemo(() => layoutTree(tree), [tree]);
  const root = useMemo(() => (flip ? flipY(laid.root, laid.height) : laid.root), [laid, flip]);
  const { width } = laid;
  const height = flip ? laid.height + FLIP_STUB : laid.height;
  const activeId = pinnedId ?? hoveredId;

  // Node ids are regenerated on every build, so old highlights must go.
  useEffect(() => {
    setHoveredId(null);
    setPinnedId(null);
  }, [tree]);

  // Clicking anywhere that isn't a node clears the pin. (Node clicks call
  // stopPropagation, so they never reach this window listener.)
  useEffect(() => {
    const clear = () => setPinnedId(null);
    window.addEventListener("click", clear);
    return () => window.removeEventListener("click", clear);
  }, []);

  const relatedIds = useMemo(() => {
    if (!activeId) return new Set();
    const { byId, ancestors } = indexTree(root);
    const entry = byId.get(activeId);
    if (!entry) return new Set();

    const related = new Set([activeId]);
    collectDescendantIds(entry.node, related);
    (ancestors.get(activeId) || []).forEach((id) => related.add(id));
    return related;
  }, [root, activeId]);

  return (
    <div className="tree-canvas">
      <IDSTree
        root={root}
        width={width}
        height={height}
        flip={flip}
        activeId={activeId}
        relatedIds={relatedIds}
        hoveredId={hoveredId}
        onHover={setHoveredId}
        onClick={(id) => setPinnedId((cur) => (cur === id ? null : id))}
      />
    </div>
  );
}
