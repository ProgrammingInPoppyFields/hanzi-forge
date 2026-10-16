import React from "react";
import { OPERATORS } from "../data/ids-data.js";
import OperatorIcon from "./OperatorIcon.jsx";
import { IdsInlineSvg } from "./IdsInline.jsx";

// Restrained, desaturated palette — one color per recursive decomposition
// level. Level 0 (the root character, before any decomposition) is plain
// ink black. Levels beyond 4 fall back to the deepest defined color rather
// than introducing new hues.
const LEVEL_COLORS = ["#171717", "#c1543f", "#2f8583", "#4f7d4a", "#6a5a95"];

function colorForLevel(level) {
  return LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)];
}

const NODE_CHAR_SIZE = 34;
const NODE_OP_SIZE = 22;

export default function IDSTree({
  root,
  width,
  height,
  activeId,
  relatedIds,
  hoveredId,
  onHover,
  onClick,
}) {
  return (
    <svg
      className="ids-tree-svg"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: width, margin: "0 auto" }}
      role="img"
      aria-label="IDS decomposition tree"
    >
      <TreeEdges node={root} relatedIds={relatedIds} activeId={activeId} />
      <TreeNodes
        node={root}
        relatedIds={relatedIds}
        activeId={activeId}
        hoveredId={hoveredId}
        onHover={onHover}
        onClick={onClick}
      />
    </svg>
  );
}

function isDimmed(nodeId, activeId, relatedIds) {
  return activeId != null && !relatedIds.has(nodeId);
}

// ---------------------------------------------------------------------------
// Edges are rendered as one pass over the whole tree, separately from nodes,
// so every connector sits behind every glyph regardless of draw order.
// A node with one child gets a plain vertical line; a node with 2-3
// children gets a bracket: a stub down from the parent, a horizontal bar
// spanning the children, and a stub down into each child.
// ---------------------------------------------------------------------------
function TreeEdges({ node, relatedIds, activeId }) {
  const edgeColor = colorForLevel(node.children[0]?.level ?? node.level);

  return (
    <>
      {node.children.length === 1 && (
        <line
          className={`ids-edge${isDimmed(node.children[0].id, activeId, relatedIds) ? " ids-edge--dim" : ""}`}
          x1={node.x}
          y1={node.y}
          x2={node.children[0].x}
          y2={node.children[0].y}
          stroke={edgeColor}
        />
      )}

      {node.children.length > 1 && (
        <Bracket
          parent={node}
          children={node.children}
          color={edgeColor}
          activeId={activeId}
          relatedIds={relatedIds}
        />
      )}

      {node.children.map((child) => (
        <TreeEdges key={child.id} node={child} relatedIds={relatedIds} activeId={activeId} />
      ))}
    </>
  );
}

// Each child gets its own horizontal-then-vertical stub (rather than one
// shared bar) so dimming can apply per-branch: hovering one child of a
// ⿲/⿳ operator dims only that child's stub, not its siblings'. The shared
// trunk above the bar only dims when *none* of the children are related.
function Bracket({ parent, children, color, activeId, relatedIds }) {
  const barY = parent.y + (children[0].y - parent.y) / 2;
  const anyChildRelated = children.some((c) => !isDimmed(c.id, activeId, relatedIds));
  const trunkDimmed = activeId != null && !anyChildRelated;

  return (
    <g stroke={color}>
      <line
        className={`ids-edge${trunkDimmed ? " ids-edge--dim" : ""}`}
        x1={parent.x}
        y1={parent.y}
        x2={parent.x}
        y2={barY}
      />
      {children.map((child) => {
        const cls = `ids-edge${isDimmed(child.id, activeId, relatedIds) ? " ids-edge--dim" : ""}`;
        return (
          <React.Fragment key={child.id}>
            <line className={cls} x1={parent.x} y1={barY} x2={child.x} y2={barY} />
            <line className={cls} x1={child.x} y1={barY} x2={child.x} y2={child.y} />
          </React.Fragment>
        );
      })}
    </g>
  );
}

function TreeNodes({ node, relatedIds, activeId, hoveredId, onHover, onClick }) {
  return (
    <>
      <TreeNodeGlyph
        node={node}
        dimmed={isDimmed(node.id, activeId, relatedIds)}
        emphasized={activeId === node.id}
        isHovered={hoveredId === node.id}
        onHover={onHover}
        onClick={onClick}
      />
      {node.children.map((child) => (
        <TreeNodes
          key={child.id}
          node={child}
          relatedIds={relatedIds}
          activeId={activeId}
          hoveredId={hoveredId}
          onHover={onHover}
          onClick={onClick}
        />
      ))}
    </>
  );
}

function TreeNodeGlyph({ node, dimmed, emphasized, isHovered, onHover, onClick }) {
  const color = colorForLevel(node.level);
  const isOperator = node.type === "operator";
  const fontSize = isOperator ? NODE_OP_SIZE : NODE_CHAR_SIZE;

  const classNames = [
    "ids-node",
    isOperator ? "ids-node--operator" : "ids-node--character",
    dimmed ? "ids-node--dim" : "",
    emphasized ? "ids-node--active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const showOperatorTooltip = isOperator && isHovered;
  const showIdsCaption = !isOperator && isHovered && node.ids;

  return (
    <g
      className={classNames}
      data-root-node={node.depth === 0 ? "true" : undefined}
      transform={`translate(${node.x}, ${node.y})`}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onClick(node.id);
      }}
    >
      <circle r={isOperator ? 18 : 26} className="ids-node__halo" />
      {isOperator ? (
        <OperatorIcon operator={node.value} size={fontSize} x={0} y={1} color={color} />
      ) : node.glyphRoot ? (
        node.image ? (
          <image href={node.image} x={-22} y={-22} width={44} height={44} />
        ) : (
          <text fill={color} fontSize={fontSize} textAnchor="middle" dominantBaseline="central" className="ids-node__glyph">？</text>
        )
      ) : (
        <text
          fill={color}
          fontSize={fontSize}
          textAnchor="middle"
          dominantBaseline="central"
          className="ids-node__glyph"
        >
          {node.value}
        </text>
      )}

      {showOperatorTooltip && <OperatorTooltip operatorChar={node.value} color={color} />}

      {showIdsCaption && <IdsInlineSvg ids={node.ids} x={0} y={44} />}
    </g>
  );
}

function OperatorTooltip({ operatorChar, color }) {
  const meta = OPERATORS[operatorChar];
  if (!meta) return null;
  const boxWidth = Math.max(96, meta.label.length * 7.2 + 40);

  return (
    <g transform="translate(0, -42)" className="ids-tooltip">
      <rect x={-boxWidth / 2} y={-16} width={boxWidth} height={28} rx={4} />
      <OperatorIcon
        operator={operatorChar}
        size={16}
        x={-boxWidth / 2 + 16}
        y={-2}
        color="#ffffff"
      />
      <text textAnchor="start" dominantBaseline="central" x={-boxWidth / 2 + 28} y={-2}>
        — {meta.label}
      </text>
    </g>
  );
}
