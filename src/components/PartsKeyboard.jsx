import React, { useMemo, useState } from "react";
import { OPERATORS } from "../data/ids-data.js";
import OperatorIcon from "./OperatorIcon.jsx";

const COMMON_PARTS = Array.from(
  "一丨丶丿乙亅二十八人亻儿入厂匚刀力又口囗土士夕大女子宀小尸山工己巾广弓心戈手日月木水火田目石禾米糸言貝車金門雨頁魚鳥彳氵扌艹忄犭阝"
);
export { COMMON_PARTS };

const OPERATOR_KEYS = Object.keys(OPERATORS);

// "jǐng" -> "jing", so people can search pinyin without typing tone marks.
const stripTones = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// The on-screen "keyboard" for building a character: one row of operators, a search box, and a
// short scrolling grid of parts. Buttons grey out when the next slot can't legally take them.
export default function PartsKeyboard({ dictionary, canAppend, onAppend }) {
  const [query, setQuery] = useState("");

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
    if (!q) return null;
    const exact = [];
    const rest = [];
    for (const e of searchIndex) {
      if (e.char === query.trim() || e.pinyin.split(", ").includes(q)) exact.push(e.char);
      else if (e.pinyin.startsWith(q) || e.meaning.includes(q)) rest.push(e.char);
      if (exact.length + rest.length >= 80) break;
    }
    return [...exact, ...rest].slice(0, 72);
  }, [query, searchIndex]);

  const parts = results ?? COMMON_PARTS;

  return (
    <div className="keyboard" role="group" aria-label="Parts and operators">
      <div className="keyboard__ops">
        {OPERATOR_KEYS.map((op) => (
          <button
            key={op}
            type="button"
            className="key key--op"
            title={OPERATORS[op].label}
            aria-label={OPERATORS[op].label}
            disabled={!canAppend(`o:${op}`)}
            onClick={() => onAppend(op)}
          >
            <OperatorIcon operator={op} size={20} />
          </button>
        ))}
      </div>

      <input
        className="keyboard__search"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search parts: a character, pinyin, or English (water, ma…)"
        spellCheck={false}
        aria-label="Search parts"
      />

      <div className="keyboard__parts">
        {parts.length === 0 && <span className="keyboard__none">no parts match</span>}
        {parts.map((c) => (
          <button
            key={c}
            type="button"
            className="key key--part"
            title={dictionary?.info[c] ? `${dictionary.info[c].pinyin} · ${dictionary.info[c].meaning}` : c}
            disabled={!canAppend(`c:${c}`)}
            onClick={() => onAppend(c)}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
