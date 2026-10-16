import React, { useMemo, useState } from "react";
import { OPERATORS } from "../data/ids-data.js";
import { buildTreeFromIds, wrapWithRoot } from "../lib/tree-builder.js";
import { composeGlyph } from "../lib/glyph-fit.js";
import { parseIds, buildReverseIndex } from "../lib/ids-compose.js";
import {
  buildRules,
  findViolation,
  isAllowed,
  nextOpenRole,
  randomValidExpression,
  violationMessage,
} from "../lib/ids-rules.js";
import TreeView from "../components/TreeView.jsx";
import ComposedGlyph from "../components/ComposedGlyph.jsx";
import ComposedCanvas, { glyphDataUrl } from "../components/ComposedCanvas.jsx";
import GlyphCaption from "../components/GlyphCaption.jsx";
import LeaderLine from "../components/LeaderLine.jsx";
import IdsField from "../components/IdsField.jsx";
import PartsKeyboard, { COMMON_PARTS } from "../components/PartsKeyboard.jsx";

const KEYBOARD_KEY = "hanzi-forge:keyboard-open";

function readOpen() {
  try {
    return localStorage.getItem(KEYBOARD_KEY) === "1";
  } catch {
    return false;
  }
}

export default function Compose({ dictionary, strokes, outlines, ids, setIds, onOpenInDecompose }) {
  const [blocked, setBlocked] = useState(null);
  const [keyboardOpen, setKeyboardOpen] = useState(readOpen);
  const [copied, setCopied] = useState(false);

  const reverse = useMemo(
    () => (dictionary ? buildReverseIndex(dictionary.ids) : null),
    [dictionary]
  );

  const rules = useMemo(() => (dictionary ? buildRules(dictionary.ids) : null), [dictionary]);

  const { expr, missing, extra } = useMemo(() => parseIds(ids), [ids]);
  const complete0 = Boolean(expr) && missing === 0 && extra === 0;

  // The typeset character (needs the outlines); until they load, or while slots are open, the
  // simpler stroke drawing below stands in.
  const composed = useMemo(
    () => (outlines && complete0 ? composeGlyph(outlines, expr, strokes) : null),
    [outlines, complete0, expr, strokes]
  );
  const rootImage = useMemo(() => glyphDataUrl(outlines, composed), [outlines, composed]);
  const tree = useMemo(() => {
    const built = buildTreeFromIds(ids);
    return built ? wrapWithRoot(built, rootImage) : null;
  }, [ids, rootImage]);

  const complete = expr && missing === 0 && extra === 0;
  const existing = complete ? (expr.op ? reverse?.get(ids) : ids) : null;
  const existingInfo = existing ? dictionary?.info[existing] : null;

  const openRole = useMemo(() => nextOpenRole(expr), [expr]);

  // Every change goes through here, so an illegal expression can never be
  // entered, whether it was clicked, typed, or pasted.
  function tryUpdate(next) {
    if (next === "") {
      setIds("");
      setBlocked(null);
      return;
    }
    if (!rules) return;

    const parsed = parseIds(next);
    let problem = null;
    if (!parsed.expr.op) problem = "Blocked: start with an operator, then add its parts.";
    else if (parsed.extra > 0) problem = "Blocked: that expression is already complete.";
    else {
      const violation = findViolation(parsed.expr, rules);
      if (violation) problem = violationMessage(violation);
    }

    if (problem) return setBlocked(problem);
    setIds(next);
    setBlocked(null);
  }

  // Can this token go in the next open slot? (Only operators can start.)
  function canAppend(key) {
    if (!rules) return false;
    if (ids === "") return key.startsWith("o:");
    return openRole ? isAllowed(rules, openRole, key) : false;
  }

  const append = (token) => tryUpdate(ids + token);
  const undo = () => tryUpdate(Array.from(ids).slice(0, -1).join(""));

  function toggleKeyboard() {
    setKeyboardOpen((open) => {
      try {
        localStorage.setItem(KEYBOARD_KEY, open ? "0" : "1");
      } catch {
        // storage can be blocked; the toggle still works for this visit
      }
      return !open;
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(ids);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard can be blocked; the text field above is still selectable.
    }
  }

  function surprise() {
    if (!rules) return;
    let candidate = randomValidExpression(rules, COMMON_PARTS);
    for (let i = 0; i < 30 && reverse?.has(candidate); i++) {
      candidate = randomValidExpression(rules, COMMON_PARTS);
    }
    tryUpdate(candidate);
  }

  // The same label stack Decompose shows under its character, filled in for an invented one.
  let caption;
  if (!expr) {
    caption = { primary: "—", secondary: "start with an operator, then add its parts" };
  } else if (missing > 0) {
    caption = { primary: "…", secondary: `needs ${missing} more ${missing === 1 ? "part" : "parts"}` };
  } else if (existing) {
    caption = {
      primary: existingInfo?.pinyin ?? existing,
      secondary: existingInfo?.meaning ?? "already in the dictionary",
    };
  } else {
    caption = { primary: "unattested", tone: "new", secondary: "no reading · no meaning yet" };
  }
  const notes = [];
  if (existing) notes.push({ kind: "exists", text: `already exists: ${existing}` });
  if (blocked) notes.push({ kind: "blocked", text: blocked });

  return (
    <div className="split split--compose">
      <aside className="split__hero hero">
        <div className="hero-glyph">
          {composed ? (
            <ComposedCanvas outlines={outlines} composed={composed} />
          ) : expr ? (
            <ComposedGlyph expr={expr} strokes={strokes} />
          ) : (
            <span className="hero-char hero-char--blank">?</span>
          )}
        </div>
        <GlyphCaption {...caption} ids={ids} notes={notes} />
      </aside>

      <div className="split__main">
        <section className="forge-input">
          <IdsField ids={ids} onChange={tryUpdate} onUndo={undo} />
          <div className="forge-actions">
            <button type="button" onClick={surprise} disabled={!rules}>Surprise me</button>
            <button type="button" onClick={undo} disabled={!ids}>Undo</button>
            <button type="button" onClick={() => tryUpdate("")} disabled={!ids}>Clear</button>
            <button type="button" onClick={copy} disabled={!ids}>{copied ? "Copied" : "Copy IDS"}</button>
            <button type="button" onClick={() => onOpenInDecompose(existing)} disabled={!existing}>
              Open in Decompose ↓
            </button>
            <button
              type="button"
              className={`forge-actions__keyboard${keyboardOpen ? " is-open" : ""}`}
              onClick={toggleKeyboard}
              aria-expanded={keyboardOpen}
            >
              Keyboard {keyboardOpen ? "–" : "+"}
            </button>
          </div>

          {keyboardOpen && (
            <PartsKeyboard dictionary={dictionary} canAppend={canAppend} onAppend={append} />
          )}
        </section>

        <section className="tree-section tree-section--flipped">
          {tree ? (
            <TreeView tree={tree} flip />
          ) : (
            <p className="no-decomposition">Start with an operator, then add its parts.</p>
          )}
        </section>
      </div>

      <LeaderLine watch={tree} />
    </div>
  );
}
