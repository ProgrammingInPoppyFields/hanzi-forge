import React, { useEffect, useRef, useState } from "react";

// A thin elbow line from the big character to the small root glyph of the tree, so the eye can
// follow "this character is that node". It lives inside the .split grid, measures the two ends
// from the DOM, and re-measures on scroll (the big character is sticky) and resize.
// Hidden when the layout stacks to one column.
export default function LeaderLine({ watch }) {
  const ref = useRef(null);
  const [geo, setGeo] = useState(null);

  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return undefined;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const hero = host.querySelector(".hero-glyph");
      const root = host.querySelector("[data-root-node]");
      const main = host.querySelector(".split__main");
      if (window.innerWidth < 900 || !hero || !root || !main) {
        setGeo(null);
        return;
      }
      const h = host.getBoundingClientRect();
      const a = hero.getBoundingClientRect();
      const r = root.getBoundingClientRect();
      const m = main.getBoundingClientRect();
      const x1 = a.right - h.left + 6;
      const y1 = a.top + a.height / 2 - h.top;
      const gutter = (a.right + m.left) / 2 - h.left + 8; // runs down the gap between the columns
      const x2 = r.left - h.left - 10;
      let y2 = r.top + r.height / 2 - h.top;
      let y1b = y1;
      if (Math.abs(y2 - y1) < 8) {
        y1b = y2 = (y1 + y2) / 2; // nearly level: draw it straight
      }
      setGeo({ x1, y1: y1b, gutter: Math.max(x1 + 8, gutter), x2, y2, w: h.width, h: h.height });
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(host);
    schedule();

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [watch]);

  return (
    <svg ref={ref} className="leader" aria-hidden="true" width={geo?.w ?? 0} height={geo?.h ?? 0}>
      {geo && (
        <>
          <path d={`M ${geo.x1} ${geo.y1} H ${geo.gutter} V ${geo.y2} H ${geo.x2}`} />
          <circle cx={geo.x1} cy={geo.y1} r="2.5" />
          <circle cx={geo.x2} cy={geo.y2} r="2.5" />
        </>
      )}
    </svg>
  );
}
