import React, { useMemo, useState } from "react";
import { OPERATORS } from "../data/ids-data.js";
import { buildTreeFromIds } from "../lib/tree-builder.js";
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
import OperatorIcon from "../components/OperatorIcon.jsx";
import { IdsInlineHtml } from "../components/IdsInline.jsx";

const COMMON_PARTS = Array.from(
  "一丨丶丿乙亅二十八人亻儿入厂匚刀力又口囗土士夕大女子宀小尸山工己巾广弓心戈手日月木水火田目石禾米糸言貝車金門雨頁魚鳥彳氵扌艹忄犭阝"
);

const OPERATOR_KEYS = Object.keys(OPERATORS);

// "jǐng" -> "jing", so people can search pinyin without typing tone marks.
const stripTones = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Compose({ dictionary, strokes }) {
  const [ids, setIds] = useState("⿱八亅");
  const [blocked, setBlocked] = useState(null);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const reverse = useMemo(
    () => (dictionary ? buildReverseIndex(dictionary.ids) : null),
    [dictionary]
  );

  const rules = useMemo(() => (dictionary ? buildRules(dictionary.ids) : null), [dictionary]);

  const searchIndex = useMemo(
    () =>
      dictionary
        ? Object.entries(dictionary.info).map(([char, i]) => ({
            char,
            pinyin: stripTones(i.pinyin),
            meaning: i.meaning.toLowerCase(),
          }))
        : [],
    [dictionary]
  );

  const results = useMemo(() => {
    const q = stripTones(query.trim());
    if (!q) return [];
    const exact = [];
    const rest = [];
    for (const e of searchIndex) {
      if (e.char === query.trim() || e.pinyin.split(", ").includes(q)) exact.push(e.char);
      else if (e.pinyin.startsWith(q) || e.meaning.includes(q)) rest.push(e.char);
      if (exact.length + rest.length >= 60) break;
    }
    return [...exact, ...rest].slice(0, 48);
  }, [query, searchIndex]);

  const { expr, missing, extra } = useMemo(() => parseIds(ids), [ids]);
  const tree = useMemo(() => buildTreeFromIds(ids), [ids]);

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

  let status;
  if (!expr) status = "Start with an operator, then add its parts.";
  else if (missing > 0) status = `Needs ${missing} more ${missing === 1 ? "part" : "parts"}.`;
  else if (existing) status = null;
  else status = "Not in the dictionary — a character that (as far as this list knows) has never existed.";

  return (
    <>
      <section className="forge-stage">
        <div className="forge-glyph">
          {expr ? <ComposedGlyph expr={expr} strokes={strokes} /> : <div className="forge-glyph__blank">?</div>}
        </div>

        <div className="meta-block">
          {existing && (
            <div className="meta-line">
              <span className="meta-pinyin">Already exists: {existing}</span>
              {existingInfo && <span className="meta-meaning">{existingInfo.pinyin} · {existingInfo.meaning}</span>}
            </div>
          )}
          {blocked && <div className="meta-line forge-status forge-status--blocked">{blocked}</div>}
          {status && (
            <div className={`meta-line forge-status${complete && !existing ? " forge-status--new" : ""}`}>
              {status}
            </div>
          )}
        </div>
      </section>

      <section className="forge-bar">
        <div className="forge-strip" aria-label="Current IDS expression">
          {ids ? <IdsInlineHtml ids={ids} iconSize={22} /> : <span className="forge-strip__hint">empty</span>}
        </div>

        <div className="forge-actions">
          <input
            className="forge-input"
            type="text"
            value={ids}
            onChange={(e) => tryUpdate(e.target.value.replace(/\s/g, ""))}
            placeholder="paste an IDS string"
            spellCheck={false}
            aria-label="IDS string"
          />
          <button type="button" onClick={undo} disabled={!ids}>Undo</button>
          <button type="button" onClick={() => tryUpdate("")} disabled={!ids}>Clear</button>
          <button type="button" onClick={copy} disabled={!ids}>{copied ? "Copied" : "Copy IDS"}</button>
          <button type="button" onClick={surprise} disabled={!rules}>Surprise me</button>
        </div>
      </section>

      <section className="palette">
        <h2 className="palette__title">Operators</h2>
        <div className="palette__row">
          {OPERATOR_KEYS.map((op) => (
            <button
              key={op}
              type="button"
              className="op-button"
              title={`${op}  ${OPERATORS[op].label}`}
              aria-label={OPERATORS[op].label}
              disabled={!canAppend(`o:${op}`)}
              onClick={() => append(op)}
            >
              <OperatorIcon operator={op} size={22} />
              <span className="op-button__label">{OPERATORS[op].label}</span>
            </button>
          ))}
        </div>

        <h2 className="palette__title">Parts</h2>
        <div className="palette__row">
          {COMMON_PARTS.map((c) => (
            <button
              key={c}
              type="button"
              className="part-button"
              disabled={!canAppend(`c:${c}`)}
              onClick={() => append(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <input
          className="forge-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="find any part: a character, pinyin, or English (e.g. water, ma)"
          spellCheck={false}
          aria-label="Search parts"
        />
        {results.length > 0 && (
          <div className="palette__row">
            {results.map((c) => (
              <button
                key={c}
                type="button"
                className="part-button"
                title={`${dictionary.info[c].pinyin} · ${dictionary.info[c].meaning}`}
                disabled={!canAppend(`c:${c}`)}
                onClick={() => append(c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </section>

      {tree && (
        <section className="tree-section">
          <TreeView tree={tree} />
        </section>
      )}
    </>
  );
}
