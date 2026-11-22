import { useEffect, useMemo, useRef, useState } from "react";

// A 3D pie chart drawn with plain SVG (no extra packages). The pie is a tilted ellipse that is stacked in layers
// to give it thickness. It sweeps open when it appears, a slice pops out when you hover or tap it,
// and the whole chart floats gently.
const W = 400, H = 280, CX = 200, CY = 112, RX = 150, RY = 80, DEPTH = 28, LAYERS = 15, POP = 16;
const TAU = Math.PI * 2;

const point = (a, lift = 0) => [CX + RX * Math.sin(a), CY - RY * Math.cos(a) + lift]; // a = angle clockwise from 12 o'clock
const ease = (t) => 1 - Math.pow(1 - t, 3);

function sector(a0, a1, lift) {
  if (a1 - a0 < 0.0004) return "";
  const [x0, y0] = point(a0, lift);
  if (a1 - a0 >= TAU - 0.0004) { // a full circle is drawn as two halves, because one arc cannot start and end at the same spot
    const [mx, my] = point(a0 + Math.PI, lift);
    return `M${CX} ${CY + lift}L${x0} ${y0}A${RX} ${RY} 0 1 1 ${mx} ${my}A${RX} ${RY} 0 1 1 ${x0} ${y0}Z`;
  }
  const [x1, y1] = point(a1, lift);
  return `M${CX} ${CY + lift}L${x0} ${y0}A${RX} ${RY} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}Z`;
}

function shade(hex, f) { // f below 1 makes the colour darker
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.round(v * f).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// slices: [{ label, value, color }], active: index or null, onActive(index or null), animateKey: change it to replay the sweep
export default function PieChart3D({ slices, active, onActive, animateKey, label }) {
  const [t, setT] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) { setT(1); return; }
    const start = performance.now();
    const run = (now) => {
      const p = Math.min(1, (now - start) / 1300);
      setT(p);
      if (p < 1) raf.current = requestAnimationFrame(run);
    };
    setT(0);
    raf.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf.current);
  }, [animateKey]);

  const parts = useMemo(() => {
    const total = slices.reduce((s, x) => s + x.value, 0) || 1;
    let at = 0;
    return slices.map((s) => {
      const a0 = at;
      at += (s.value / total) * TAU;
      return { ...s, a0, a1: at, mid: (a0 + at) / 2 };
    });
  }, [slices]);

  const sweep = ease(t) * TAU;
  const rise = ease(Math.min(1, t * 1.25)); // the pie also grows its thickness as it opens
  const lifts = Array.from({ length: LAYERS }, (_, i) => (DEPTH * rise * (LAYERS - 1 - i)) / (LAYERS - 1)); // bottom layer first

  return (
    <svg className="pie3d" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onMouseLeave={() => onActive(null)}>
      <defs>
        <radialGradient id="pie-gloss" gradientUnits="userSpaceOnUse" cx="150" cy="70" r="230">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".5" />
          <stop offset=".55" stopColor="#ffffff" stopOpacity=".06" />
          <stop offset="1" stopColor="#000000" stopOpacity=".12" />
        </radialGradient>
        <filter id="pie-blur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="9" /></filter>
      </defs>
      <ellipse className="pie3d-shadow" cx={CX} cy={CY + DEPTH + 26} rx={RX * 0.98} ry={RY * 0.78} fill="#14231a" opacity=".28" filter="url(#pie-blur)" />
      <g className="pie3d-float">
        {lifts.map((lift, li) =>
          parts.map((p, i) => {
            const a1 = Math.min(p.a1, sweep);
            if (p.a0 >= sweep) return null;
            const top = li === lifts.length - 1;
            const on = active === i;
            const dx = on ? Math.sin(p.mid) * POP : 0;
            const dy = on ? -Math.cos(p.mid) * POP * (RY / RX) : 0;
            return (
              <path
                key={`${li}-${i}`}
                d={sector(p.a0, a1, lift)}
                fill={top ? p.color : shade(p.color, 0.62)}
                stroke={top ? "#ffffff" : shade(p.color, 0.62)}
                strokeWidth={top ? 1.6 : 0.8}
                strokeLinejoin="round"
                className="pie3d-slice"
                style={{ transform: `translate(${dx}px, ${dy}px)`, cursor: "pointer", opacity: active === null || on ? 1 : 0.72 }}
                onMouseEnter={() => onActive(i)}
                onClick={() => onActive(on ? null : i)}
              />
            );
          })
        )}
        {parts.map((p, i) => {
          if (p.a0 >= sweep) return null;
          const on = active === i;
          return (
            <path
              key={`g${i}`}
              d={sector(p.a0, Math.min(p.a1, sweep), 0)}
              fill="url(#pie-gloss)"
              pointerEvents="none"
              className="pie3d-slice"
              style={{ transform: `translate(${on ? Math.sin(p.mid) * POP : 0}px, ${on ? -Math.cos(p.mid) * POP * (RY / RX) : 0}px)` }}
            />
          );
        })}
      </g>
    </svg>
  );
}