import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import PieChart3D from "../components/PieChart3D";
import { api, getAuth, naira } from "../lib/api";

const COLORS = ["#1c7a43", "#f2a900", "#e5483b", "#2f6fb5", "#8e5bd3"];
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const parseKey = (key) => key.split("-").map(Number);
const monthName = (key, style = "long") => { const [y, m] = parseKey(key); return new Date(y, m - 1, 1).toLocaleString("en-NG", { month: style, year: style === "long" ? "numeric" : undefined }); };
const shiftKey = (key, delta) => { const [y, m] = parseKey(key); const i = y * 12 + (m - 1) + delta; return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`; };

// A number that counts up to its new value.
function useCountUp(target, ms = 900) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) { setShown(target); from.current = target; return; }
    const start = performance.now(), begin = from.current;
    let raf;
    const run = (now) => {
      const p = Math.min(1, (now - start) / ms);
      const value = begin + (target - begin) * (1 - Math.pow(1 - p, 3));
      setShown(value); from.current = value;
      if (p < 1) raf = requestAnimationFrame(run);
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return Math.round(shown);
}

function Stat({ label, value, note, money = true }) {
  const n = useCountUp(value);
  return (
    <div className="earn-stat">
      <span className="earn-stat-label">{label}</span>
      <strong>{money ? naira(n) : n.toLocaleString()}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

export default function Earnings() {
  const router = useRouter();
  const [month, setMonth] = useState(""); // "" means this month; the server tells us the exact one
  const [data, setData] = useState(null);
  const [active, setActive] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [grown, setGrown] = useState(false); // lets the bars grow after they appear

  useEffect(() => {
    const a = getAuth();
    if (!a) { router.replace("/login"); return; }
    if (a.role !== "stall_admin") { setError("This page is for stall owners."); setLoading(false); return; }
    let stop = false;
    setLoading(true); setGrown(false);
    api(`/my-stall/earnings/?month=${month}`)
      .then((d) => { if (!stop) { setData(d); setError(""); setActive(null); setTimeout(() => !stop && setGrown(true), 60); } })
      .catch((e) => { if (!stop) setError(e.message); })
      .finally(() => { if (!stop) setLoading(false); });
    return () => { stop = true; };
  }, [month]);

  if (error && !data) return <section><h1>Track earnings</h1><p className="error">{error}</p></section>;
  if (!data) return <section><h1>Track earnings</h1><div className="stall skeleton" style={{ height: 260 }} /></section>;

  const weeks = data.weeks.map((w, i) => ({ ...w, color: COLORS[i % COLORS.length], name: `Week ${w.week}`, dates: `${w.from}–${w.to} ${monthName(data.month, "short").split(" ")[0]}` }));
  const empty = data.total === 0;
  const slices = empty ? [{ label: "No earnings yet", value: 1, color: "#cfd8c9" }] : weeks.map((w) => ({ label: w.name, value: w.total, color: w.color }));
  const picked = !empty && active !== null ? weeks[active] : null;
  const topWeek = Math.max(1, ...weeks.map((w) => w.total));
  const topMonth = Math.max(1, ...data.history.map((h) => h.total));
  const isCurrent = data.month >= data.current;

  return (
    <section className={`earn ${loading ? "is-loading" : ""}`}>
      <h1>Track earnings</h1>
      <p className="muted">Money from paid orders, including delivery fees. Cancelled and refunded orders are not counted.</p>
      {error && <p className="error">{error}</p>}

      <div className="earn-month">
        <button className="ghost-dark" onClick={() => setMonth(shiftKey(data.month, -1))} aria-label="Previous month">‹</button>
        <h2>{monthName(data.month)}</h2>
        <button className="ghost-dark" onClick={() => setMonth(shiftKey(data.month, 1))} disabled={isCurrent} aria-label="Next month">›</button>
        {!isCurrent && <button className="small" onClick={() => setMonth(data.current)}>This month</button>}
      </div>

      <div className="earn-stats">
        <Stat label="Earned this month" value={data.total} note={`${data.orders} order${data.orders === 1 ? "" : "s"}`} />
        <Stat label="Average order" value={data.average} />
        <Stat label={`After the ${data.fee_percent}% platform fee`} value={data.after_fee} note="Estimate" />
        <Stat label="Still being prepared" value={data.in_progress} note="Not delivered yet" />
      </div>

      <div className="stall earn-chart-card">
        <h2>Weekly share of the month</h2>
        <div className="earn-chart">
          <PieChart3D
            slices={slices}
            active={empty ? null : active}
            onActive={setActive}
            animateKey={`${data.month}-${data.total}`}
            label={empty ? "No earnings this month yet" : `Weekly earnings for ${monthName(data.month)}`}
          />
          <div className="earn-callout" aria-live="polite">
            {empty && <span>No paid orders in {monthName(data.month)} yet.</span>}
            {!empty && picked && <><i style={{ background: picked.color }} /><span><strong>{picked.name}</strong> ({picked.dates}): {naira(picked.total)} · {picked.share}% · {picked.orders} order{picked.orders === 1 ? "" : "s"}</span></>}
            {!empty && !picked && <span>Tap or hover a slice to see that week.</span>}
          </div>
        </div>

        <ul className="earn-legend">
          {weeks.map((w, i) => (
            <li key={w.week}>
              <button type="button" className={`earn-legend-row ${active === i ? "on" : ""}`} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onClick={() => setActive(active === i ? null : i)}>
                <i style={{ background: w.color }} />
                <span className="earn-legend-name">{w.name}<small>{w.dates}</small></span>
                <span className="earn-legend-amount">{naira(w.total)}<small>{w.share}%</small></span>
              </button>
              <div className="earn-bar"><span style={{ width: grown ? `${(100 * w.total) / topWeek}%` : "0%", background: w.color }} /></div>
            </li>
          ))}
        </ul>
        {data.best_week && <p className="muted">Best week so far: <strong>Week {data.best_week}</strong>.</p>}
      </div>

      <div className="stall">
        <h2>Weekly breakdown</h2>
        <div className="earn-table" role="table" aria-label="Weekly earnings">
          <div className="earn-tr earn-th" role="row"><span>Week</span><span>Orders</span><span>Food</span><span>Delivery</span><span>Total</span></div>
          {weeks.map((w) => (
            <div key={w.week} className="earn-tr" role="row">
              <span><span className="earn-wk"><i style={{ background: w.color }} />{w.name}</span><small>{w.dates}</small></span>
              <span>{w.orders}</span><span>{naira(w.food)}</span><span>{naira(w.delivery)}</span><strong>{naira(w.total)}</strong>
            </div>
          ))}
          <div className="earn-tr earn-total" role="row"><span>Month</span><span>{data.orders}</span><span>{naira(data.food)}</span><span>{naira(data.delivery)}</span><strong>{naira(data.total)}</strong></div>
        </div>
      </div>

      <div className="stall">
        <h2>Last 6 months</h2>
        <ul className="earn-months">
          {data.history.map((h) => (
            <li key={h.month}>
              <button type="button" className={`earn-month-row ${h.month === data.month ? "on" : ""}`} onClick={() => setMonth(h.month)}>
                <span>{monthName(h.month, "short")}</span>
                <span className="earn-bar"><span style={{ width: grown ? `${(100 * h.total) / topMonth}%` : "0%" }} /></span>
                <strong>{naira(h.total)}</strong>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="muted small-text">
        The platform fee is worked out from the total including delivery. Paystack&apos;s own processing fee may also come off your payout depending on how fees are set up, and payouts reach your bank on Paystack&apos;s schedule. <Link href="/stall">Back to my stall</Link>
      </p>
    </section>
  );
}