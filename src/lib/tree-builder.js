import { OPERATORS } from "../data/ids-data.js";

// ---------------------------------------------------------------------------
// Recursive IDS tree builder.
//
// Turns a single character + a { char: idsString } dictionary into a
// normalized node tree:
//
//   { id, type: "character", value, ids, level, depth, children: [...] }
//   { id, type: "operator",  value, level, depth, children: [...] }
//
// A character node has either zero children (it's a leaf — no further
// decomposition known) or exactly one child: the operator node describing
// how it decomposes. An operator node has 2 or 3 children, which are the
// component characters, recursively expanded the same way.
//
// Two separate counters are tracked as we recurse:
//   - `depth`: increments by 1 at every node (character or operator). This
//     is a pure tree depth and drives vertical position in the layout.
//   - `level`: increments by 1 only once per decomposition step. An
//     operator node and the character children it produces all share the
//     same `level`, which is what the UI uses to pick the depth color
//     (see styles.css / colorForLevel in components/IDSTree.jsx).
//
// A `visited` set guards against cyclical demo data (a character that,
// through some chain, decomposes into itself) so the recursion always
// terminates.
// ---------------------------------------------------------------------------

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `n${idCounter}`;
}

export function buildTree(character, dictionary) {
  idCounter = 0;
  return buildCharacterNode(character, dictionary, 0, 0, new Set());
}

function buildCharacterNode(char, dictionary, depth, level, visited) {
  const ids = dictionary[char];
  const isLeaf = !ids || visited.has(char);

  if (isLeaf) {
    return {
      id: nextId(),
      type: "character",
      value: char,
      ids: null,
      depth,
      level,
      children: [],
    };
  }

  const nextVisited = new Set(visited);
  nextVisited.add(char);

  const operatorNode = buildOperatorNode(ids, dictionary, depth + 1, level + 1, nextVisited);

  return {
    id: nextId(),
    type: "character",
    value: char,
    ids,
    depth,
    level,
    children: [operatorNode],
  };
}

// Parses a prefix-notation IDS string into an expression tree. Real
// datasets nest operators (e.g. "⿱木⿰木木"), so each operator consumes
// `arity` sub-expressions, each of which is a character or another operator.
export function parseExpr(glyphs, pos) {
  const glyph = glyphs[pos];
  const meta = OPERATORS[glyph];
  if (!meta) return { expr: { char: glyph }, next: pos + 1 };

  const args = [];
  let next = pos + 1;
  for (let i = 0; i < meta.arity && next < glyphs.length; i++) {
    const parsed = parseExpr(glyphs, next);
    args.push(parsed.expr);
    next = parsed.next;
  }
  return { expr: { op: glyph, args }, next };
}

function buildOperatorNode(idsString, dictionary, depth, level, visited) {
  // Array.from (not string indexing) so component characters outside the
  // BMP aren't split into surrogate halves.
  const { expr } = parseExpr(Array.from(idsString), 0);
  return buildFromExpr(expr, dictionary, depth, level, visited);
}

// A nested operator is a further decomposition step, so it gets level + 1
// (a new color); plain component characters share their operator's level.
function buildFromExpr(expr, dictionary, depth, level, visited) {
  if (!expr.op) return buildCharacterNode(expr.char, dictionary, depth, level, visited);

  return {
    id: nextId(),
    type: "operator",
    value: expr.op,
    depth,
    level,
    children: expr.args.map((arg) =>
      buildFromExpr(arg, dictionary, depth + 1, arg.op ? level + 1 : level, visited)
    ),
  };
}

// Builds a tree straight from a user-written IDS string (Compose mode).
// Components are NOT looked up in the dictionary: the user picked them as
// atoms, so they stay leaves. An incomplete expression yields fewer children.
export function buildTreeFromIds(idsString) {
  const glyphs = Array.from(idsString);
  if (glyphs.length === 0) return null;
  idCounter = 0;
  const { expr } = parseExpr(glyphs, 0);
  return buildFromExpr(expr, {}, 0, expr.op ? 1 : 0, new Set());
}

// Puts a root *character* node above an operator tree, the way Decompose's tree starts with the
// character itself. Compose uses it so its (upside-down) tree ends in the new character.
// `image` is an optional picture of that character; without one the node shows a placeholder.
export function wrapWithRoot(operatorRoot, image = null) {
  const shift = (n) => ({ ...n, depth: n.depth + 1, children: n.children.map(shift) });
  return {
    id: "root",
    type: "character",
    value: "",
    glyphRoot: true,
    image,
    ids: null,
    depth: 0,
    level: 0,
    children: [shift(operatorRoot)],
  };
}

// Flattens the tree into a Map<id, { node, parentId }>, and separately
// returns id -> array of ancestor ids (root-first, excluding self).
// Used by the UI to compute "related" nodes for hover/pin highlighting.
export function indexTree(root) {
  const byId = new Map();
  const ancestors = new Map();

  function walk(node, parentId, ancestorChain) {
    byId.set(node.id, { node, parentId });
    ancestors.set(node.id, ancestorChain);
    node.children.forEach((child) => walk(child, node.id, [...ancestorChain, node.id]));
  }

  walk(root, null, []);
  return { byId, ancestors };
}

export function collectDescendantIds(node, acc = new Set()) {
  node.children.forEach((child) => {
    acc.add(child.id);
    collectDescendantIds(child, acc);
  });
  return acc;
}
