import React, { useEffect, useState } from "react";
import { loadDictionary } from "./data/dictionary.js";
import { loadStrokes } from "./data/strokes.js";
import Decompose from "./pages/Decompose.jsx";
import Compose from "./pages/Compose.jsx";

const TABS = [
  { id: "decompose", label: "Decompose" },
  { id: "compose", label: "Compose" },
];

function currentTab() {
  return window.location.hash === "#compose" ? "compose" : "decompose";
}

export default function App() {
  const [tab, setTab] = useState(currentTab);
  const [dictionary, setDictionary] = useState(null);
  const [strokes, setStrokes] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    loadDictionary().then(setDictionary).catch(setLoadError);
    loadStrokes().then(setStrokes).catch(() => setStrokes({}));
  }, []);

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
              {t.label}
            </a>
          ))}
        </nav>
      </header>

      {tab === "compose" ? (
        <Compose dictionary={dictionary} strokes={strokes} />
      ) : (
        <Decompose dictionary={dictionary} loadError={loadError} />
      )}

      <footer className="footer">
        <span>hover a node to trace its branch — click to pin</span>
      </footer>
    </div>
  );
}
