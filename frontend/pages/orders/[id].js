import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Icon from "../../components/Icon";
import Pic from "../../components/Pic";
import { api, mapsLink, media, naira } from "../../lib/api";
import { STAGES, fmtDate, fmtTime, stageIndex, statusLabel } from "../../lib/status";

export default function Track() {
  const { query, isReady } = useRouter();
  const [o, setO] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isReady) return;
    let stop = false;
    const load = () => api(`/checkouts/${query.id}/`).then((d) => { if (!stop) setO(d); }).catch((e) => { if (!stop) setError(e.message); });
    load();
    const t = setInterval(load, 8000); // live updates
    return () => { stop = true; clearInterval(t); };
  }, [isReady, query.id]);

  if (error) return <section><p className="error">{error}</p><Link href="/orders">Back to my orders</Link></section>;
  if (!o) return <div className="track"><div className="status-card skeleton" style={{ height: 150 }} /><div className="stall skeleton" style={{ height: 280 }} /></div>;

  const cur = o.status === "awaiting_payment" ? -1 : stageIndex(o.status);
  const closed = o.status === "completed" || o.status === "cancelled";
  const headline = o.status === "cancelled" ? "Order cancelled" : o.status === "awaiting_payment" ? "Waiting for payment" : STAGES[cur].label;
  const sub = o.status === "cancelled" ? statusLabel(o) : o.status === "awaiting_payment" ? "Pay from My orders to send it to the stalls" : STAGES[cur].hint;
  const many = o.parts.length > 1;

  return (
    <div className="track">
      <div className={`status-card ${o.status}`}>
        <p className="eyebrow">{o.parts.map((p) => p.stall).join(" + ")} · Order #{o.id}</p>
        <h1>{headline}</h1>
        <p className="lead">{sub}{many && o.paid && !closed ? " (the stall that is furthest behind sets this)" : ""}</p>
        {!closed && <span className="live"><i /> Updating live</span>}
      </div>

      {o.parts.map((p) => {
        const pc = p.status === "awaiting_payment" ? -1 : stageIndex(p.status);
        const at = {};
        (p.events || []).forEach((e) => { at[e.status] = e.at; });
        return (
          <div key={p.id} className="stall">
            <h2>{p.stall} <span className="chip">{statusLabel(p)}</span></h2>
            {p.status !== "cancelled" && (
              <ol className="timeline">
                {STAGES.map((s, i) => {
                  const state = i < pc || (p.status === "completed" && i === pc) ? "done" : i === pc ? "now" : "todo";
                  return (
                    <li key={s.key} className={`tl ${state}`} style={{ "--i": i }}>
                      <span className="dot">{state === "done" ? <Icon name="check" size={16} /> : null}</span>
                      <span><strong>{s.label}</strong><small>{s.hint}</small></span>
                      <time>{at[s.key] ? fmtTime(at[s.key]) : ""}</time>
                    </li>
                  );
                })}
              </ol>
            )}
            {p.lines.map((l, i) => (
              <div key={i} className="row item-row">
                <Pic src={media(l.image)} name={l.name} size={40} />
                <span className="grow">{l.qty} × {l.name}</span>
                <span>{naira(l.qty * l.price)}</span>
              </div>
            ))}
            <div className="bill-line"><span>Delivery fee</span><span>{p.delivery_fee ? naira(p.delivery_fee) : "Free"}</span></div>
          </div>
        );
      })}

      <div className="stall">
        <h2>Your bill <span className="muted">· {fmtDate(o.created)}</span></h2>
        <div className="bill">
          <div className="bill-line"><span>Food</span><span>{naira(o.subtotal)}</span></div>
          <div className="bill-line"><span>Delivery</span><span>{o.delivery_fee ? naira(o.delivery_fee) : "Free"}</span></div>
          <p className="total bill-total"><span>Total</span><span>{naira(o.total)}</span></p>
        </div>
        <h3>Delivery details</h3>
        <p>{o.pickup || "No pickup spot saved."}</p>
        {o.phone && <p className="muted">Phone shared with the stalls: {o.phone}</p>}
        {o.lat != null && o.lng != null && <p><a href={mapsLink(o.lat, o.lng)} target="_blank" rel="noopener noreferrer">Location you shared (open map)</a></p>}
      </div>
      <p><Link href="/orders">← All my orders</Link></p>
    </div>
  );
}