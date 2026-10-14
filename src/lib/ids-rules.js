import { OPERATORS } from "../data/ids-data.js";
import { parseExpr } from "./tree-builder.js";

// ---------------------------------------------------------------------------
// Composition rules, learned from the dictionary instead of hand-written.
//
// Every operand slot has a *role* (left, top, outer part of ⿴, ...). Walking
// all real decompositions records which parts (and which sub-operators) have
// ever filled each role. A part is allowed in a slot only if it has filled
// that role in at least one real character (three, for enclosing and overlaid parts). So 雨 can go on top of a ⿱ (as
// in 霜) but never around something in a ⿴, because no real character does
// that. Only the *role* is checked, not the exact pair, so new pairings of
// individually plausible parts stay possible.
// ---------------------------------------------------------------------------

const ENCLOSURES = ["⿴", "⿵", "⿶", "⿷", "⿸", "⿹", "⿺"];

export function roleOf(op, index) {
  switch (op) {
    case "⿰": return index === 0 ? "left" : "right";
    case "⿲": return ["left", "hmid", "right"][index];
    case "⿱": return index === 0 ? "top" : "bottom";
    case "⿳": return ["top", "vmid", "bottom"][index];
    case "⿻": return "overlay";
    default: // enclosures: each kind opens differently, so the outer part is per-operator
      return index === 0 ? `outer:${op}` : "inner";
  }
}

export function describeRole(role) {
  const named = {
    left: "the left side",
    right: "the right side",
    hmid: "the middle of a three-part row",
    top: "the top",
    bottom: "the bottom",
    vmid: "the middle of a three-part stack",
    inner: "the inside of an enclosure",
    overlay: "part of an overlay",
  };
  if (role.startsWith("outer:")) {
    const label = OPERATORS[role.slice(6)].label;
    return `the outside of ${/^[aeiou]/.test(label) ? "an" : "a"} ${label}`;
  }
  return named[role];
}

// Keys: "c:八" for a component character, "o:⿰" for a nested operator.
const charKey = (c) => `c:${c}`;
const opKey = (o) => `o:${o}`;
const keyOf = (expr) => (expr.op ? opKey(expr.op) : charKey(expr.char));

export function describeKey(key) {
  return key.startsWith("o:") ? `a "${OPERATORS[key.slice(2)].label}" combination` : key.slice(2);
}

// Roles like "left" can safely learn from a single example, but wrapping and
// overlaying are structural tricks where a one-off is the dataset's oddity,
// not a rule (舁 wraps something in only 舆 and 輿; 厂 overlays in only 严).
// So those roles need this many distinct real characters before a part may
// fill them.
export const MIN_ROLE_USES = 3;

const minUsesFor = (role) =>
  role.startsWith("outer:") || role === "overlay" ? MIN_ROLE_USES : 1;

export function buildRules(idsMap) {
  const counts = new Map(); // role -> Map(key -> number of real characters)

  function visit(expr) {
    if (!expr.op) return;
    expr.args.forEach((arg, i) => {
      if (!arg.op && arg.char === "？") return; // "unknown" placeholder isn't a real part
      const role = roleOf(expr.op, i);
      if (!counts.has(role)) counts.set(role, new Map());
      const byKey = counts.get(role);
      byKey.set(keyOf(arg), (byKey.get(keyOf(arg)) ?? 0) + 1);
      visit(arg);
    });
  }

  for (const ids of Object.values(idsMap)) visit(parseExpr(Array.from(ids), 0).expr);

  const pools = new Map();
  for (const [role, byKey] of counts) {
    const needed = minUsesFor(role);
    pools.set(role, new Set([...byKey].filter(([, n]) => n >= needed).map(([key]) => key)));
  }
  return pools;
}

export const isAllowed = (rules, role, key) => rules.get(role)?.has(key) ?? false;

// First rule broken by the placed operands, or null. Empty slots are fine.
export function findViolation(expr, rules) {
  if (!expr || !expr.op) return null;
  for (let i = 0; i < expr.args.length; i++) {
    const arg = expr.args[i];
    const role = roleOf(expr.op, i);
    if (!isAllowed(rules, role, keyOf(arg))) return { role, key: keyOf(arg) };
    const inner = findViolation(arg, rules);
    if (inner) return inner;
  }
  return null;
}

// Role of the first unfilled slot in prefix order (where the next token goes),
// or null when the expression is complete.
export function nextOpenRole(expr) {
  if (!expr || !expr.op) return null;
  const arity = OPERATORS[expr.op].arity;
  for (let i = 0; i < arity; i++) {
    const arg = expr.args[i];
    if (!arg) return roleOf(expr.op, i);
    const inner = nextOpenRole(arg);
    if (inner) return inner;
  }
  return null;
}

export const violationMessage = ({ role, key }) =>
  minUsesFor(role) > 1
    ? `Blocked: ${describeKey(key)} is not common enough to be ${describeRole(role)}.`
    : `Blocked: ${describeKey(key)} never works as ${describeRole(role)}.`;

// Random *valid* expression: every slot is filled from its role's pool.
export function randomValidExpression(rules, preferred, depth = 0) {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const op = pick(Object.keys(OPERATORS));

  const fill = (i) => {
    const pool = [...(rules.get(roleOf(op, i)) ?? [])];
    const chars = pool.filter((k) => k.startsWith("c:")).map((k) => k.slice(2));
    const familiar = chars.filter((c) => preferred.includes(c));
    const ops = pool.filter((k) => k.startsWith("o:"));
    if (depth === 0 && ops.length && Math.random() < 0.25) {
      // Nested operator: build it, then splice its string in.
      const nested = randomValidExpression(rules, preferred, 1);
      if (isAllowed(rules, roleOf(op, i), opKey(nested[0]))) return nested;
    }
    return pick(familiar.length ? familiar : chars);
  };

  return op + Array.from({ length: OPERATORS[op].arity }, (_, i) => fill(i)).join("");
}
