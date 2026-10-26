import { useEffect, useState } from "react";
import Link from "next/link";
import Pic from "../components/Pic";
import Progress from "../components/Progress";
import { api, media, naira } from "../lib/api";
import { fmtDate, statusLabel } from "../lib/status";

export default function Orders({ embedded }) {
  const [orders, setOrders] = useState(null);
  const [tab, setTab] = useState("progress");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(null);

  const load = () => api("/orders/").then(setOrders).catch((e) => setError(e.message));

  useEffect(() => {
    // On first load, ask Paystack about unpaid orders, in case a payment went through but we missed the redirect.
    api("/orders/").then(async (list) => {
      setOrders(list);
      const unpaid = list.filter((o) => !o.paid);
      if (unpaid.length) {
        await Promise.all(unpaid.map((o) => api(`/checkouts/${o.id}/check/`, { method: "POST" }).catch(() => null)));
        load();
      }
    }).catch((e) => setError(e.message));
    const t = setInterval(load, 15000); // refresh so status changes show up
    return () => clearInterval(t);
  }, []);

  const payNow = async (id) => {
    setBusy(id); setError(""); setNotice("");
    try {
      const d = await api(`/checkouts/${id}/pay/`, { method: "POST" });
      if (d.authorization_url) { window.location.href = d.authorization_url; return; }
      setNotice("That payment had already gone through.");
      load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  };
  const recheck = async (id) => {
    setBusy(id); setError(""); setNotice("");
    try {
      const d = await api(`/checkouts/${id}/check/`, { method: "POST" });
      setNotice(d.paid ? "Payment confirmed. Your order is with the stalls." : d.payment);
      load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  };

  const list = (orders || []).filter((o) => (tab === "progress" ? o.active : !o.active));
  const count = (active) => (orders || []).filter((o) => o.active === active).length;

  return (
    <section>
      {!embedded && <h1>My orders</h1>}
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "progress"} className={`tab ${tab === "progress" ? "active" : ""}`} onClick={() => setTab("progress")}>In progress ({count(true)})</button>
        <button role="tab" aria-selected={tab === "history"} className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>History ({count(false)})</button>
      </div>
      {error && <p className="error">{error}</p>}
      {notice && <p className="note">{notice}</p>}
      {orders === null && !error && <div className="stall skeleton" />}
      {orders && list.length === 0 && !error && (
        <p className="muted">{tab === "progress" ? "You have no orders in progress." : "Your finished orders will show here."} {tab === "progress" && <Link href="/">Browse the menu</Link>}</p>
      )}
      {list.map((o) => (
        <div key={o.id} className="stall">
          <h2>Order #{o.id} <span className="muted">· {statusLabel(o)} · {fmtDate(o.created)}</span></h2>
          {o.campus && <p className="muted">{o.campus}</p>}
          <Progress status={o.status} />
          {o.parts.map((p) => (
            <div key={p.id} className="bill-group">
              <h3>{p.stall} <span className="chip">{statusLabel(p)}</span></h3>
              {p.lines.map((l, i) => (
                <div key={i} className="row item-row">
                  <Pic src={media(l.image)} name={l.name} size={40} />
                  <span className="grow">{l.qty} × {l.name}</span>
                  <span>{naira(l.qty * l.price)}</span>
                </div>
              ))}
              <div className="bill-line"><span>Delivery fee</span><span>{p.delivery_fee ? naira(p.delivery_fee) : "Free"}</span></div>
            </div>
          ))}
          <div className="bill">
            <div className="bill-line"><span>Food</span><span>{naira(o.subtotal)}</span></div>
            <div className="bill-line"><span>Delivery</span><span>{o.delivery_fee ? naira(o.delivery_fee) : "Free"}</span></div>
            <p className="total bill-total"><span>Total</span><span>{naira(o.total)}</span></p>
          </div>
          {o.paid && <Link className="btn" href={`/orders/${o.id}`}>Track order</Link>}
          {!o.paid && (
            <div className="inline">
              <button onClick={() => payNow(o.id)} disabled={busy === o.id}>Pay now</button>
              <button className="ghost-dark" onClick={() => recheck(o.id)} disabled={busy === o.id}>I&apos;ve paid, check again</button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}