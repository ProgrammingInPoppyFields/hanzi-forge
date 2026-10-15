import React, { useEffect, useState } from "react";
import { DEFAULT_CHARACTER } from "./data/ids-data.js";
import { loadDictionary } from "./data/dictionary.js";
import { loadStrokes } from "./data/strokes.js";
import { loadOutlines } from "./data/outlines.js";
import Decompose from "./pages/Decompose.jsx";
import Compose from "./pages/Compose.jsx";

const TABS = [
  { id: "decompose", label: "Decompose", arrow: "↓" },
  { id: "compose", label: "Compose", arrow: "↑" },
];

function currentTab() {
  return window.location.hash === "#compose" ? "compose" : "decompose";
}

const goTo = (tab) => {
  window.location.hash = `#${tab}`;
};

export default function App() {
  const [tab, setTab] = useState(currentTab);
  const [dictionary, setDictionary] = useState(null);
  const [strokes, setStrokes] = useState(null);
  const [outlines, setOutlines] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // Each side keeps its own input; the cross-links hand one over to the other.
  const [char, setChar] = useState(DEFAULT_CHARACTER);
  const [composeIds, setComposeIds] = useState("⿱八亅");

  useEffect(() => {
    loadDictionary().then(setDictionary).catch(setLoadError);
    loadStrokes().then(setStrokes).catch(() => setStrokes({}));
  }, []);

  // The typeface outlines are ~1 MB and only Compose needs them
  useEffect(() => {
    if (tab === "compose" && !outlines) loadOutlines().then(setOutlines).catch(() => {});
  }, [tab, outlines]);

  useEffect(() => {
    const onHash = () => setTab(currentTab());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1 className="wordmark">
          <span className="wordmark__latin">HANZI FORGE</span>
          <span className="wordmark__rule" aria-hidden="true" />
          <span className="wordmark__han" lang="zh-Hant">漢字煉成</span>
        </h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={`tab${tab === t.id ? " tab--active" : ""}`}
            >
              {t.label} <span className="tab__arrow" aria-hidden="true">{t.arrow}</span>
            </a>
          ))}
        </nav>
      </header>

      {tab === "compose" ? (
        <Compose
          dictionary={dictionary}
          strokes={strokes}
          outlines={outlines}
          ids={composeIds}
          setIds={setComposeIds}
          onOpenInDecompose={(c) => {
            setChar(c);
            goTo("decompose");
          }}
        />
      ) : (
        <Decompose
          dictionary={dictionary}
          loadError={loadError}
          char={char}
          setChar={setChar}
          onOpenInCompose={(ids) => {
            setComposeIds(ids);
            goTo("compose");
          }}
        />
      )}

      <footer className="footer">
        <span>hover a node to trace its branch — click to pin</span>
      </footer>
    </div>
  );
}
