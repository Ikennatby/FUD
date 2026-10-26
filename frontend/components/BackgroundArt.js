import { Burger, Cup, Donut, Fries, Pizza, Plate } from "./Art";

// Food doodles that float in the margins behind every page. They are faint on phones and bolder on wide screens.
const ITEMS = [
  { C: Burger, side: "left", top: "9%", w: 150, rot: -12, delay: 0 },
  { C: Fries, side: "right", top: "16%", w: 100, rot: 10, delay: -2 },
  { C: Donut, side: "left", top: "38%", w: 92, rot: 14, delay: -4 },
  { C: Pizza, side: "right", top: "44%", w: 124, rot: -14, delay: -1 },
  { C: Cup, side: "left", top: "66%", w: 80, rot: -8, delay: -3 },
  { C: Plate, side: "right", top: "70%", w: 150, rot: 8, delay: -5 },
];

export default function BackgroundArt() {
  return (
    <div className="bg-art" aria-hidden="true">
      <span className="bg-glow g1" /><span className="bg-glow g2" />
      {ITEMS.map(({ C, side, top, w, rot, delay }, i) => (
        <span key={i} className="bg-doodle" style={{ top, [side]: "1.5%", "--w": `${w}px`, "--r": `${rot}deg`, animationDelay: `${delay}s` }}>
          <C decorative />
        </span>
      ))}
    </div>
  );
}