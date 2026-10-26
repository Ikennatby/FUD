import { STAGES, stageIndex } from "../lib/status";

// A small step bar showing how far along an order is.
export default function Progress({ status }) {
  if (status === "cancelled") return null;
  const cur = status === "awaiting_payment" ? -1 : stageIndex(status);
  return (
    <div className="progress" role="img" aria-label={`Order progress: ${status.replace("_", " ")}`}>
      {STAGES.map((s, i) => (
        <div key={s.key} className={`pstep ${i < cur ? "done" : i === cur ? "now" : ""}`}>
          <span className="pdot" />
          <span className="plabel">{s.short}</span>
        </div>
      ))}
    </div>
  );
}
