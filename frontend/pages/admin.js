import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { fmtDate, fmtTime } from "../lib/status";

export default function Admin() {
  const [stalls, setStalls] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [open, setOpen] = useState(null);
  const [reply, setReply] = useState("");
  const [ann, setAnn] = useState({ subject: "", message: "", audience: "all", important: false });
  const [result, setResult] = useState("");
  const [pay, setPay] = useState(null);
  const [payBusy, setPayBusy] = useState(false);
  const [error, setError] = useState("");

  const loadTickets = () => api("/admin/support/").then(setTickets).catch((e) => setError(e.message));
  useEffect(() => {
    api("/admin/stalls/").then(setStalls).catch((e) => setError(e.message));
    loadTickets();
    const t = setInterval(loadTickets, 5000); // new messages appear within seconds
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (tickets.length && window.location.hash === "#support") document.getElementById("support")?.scrollIntoView(); }, [tickets.length]);

  const decide = async (id, approved) => {
    try {
      const s = await api(`/admin/stalls/${id}/`, { method: "POST", body: { approved } });
      setStalls((all) => all.map((x) => (x.id === id ? s : x)));
    } catch (e) { setError(e.message); }
  };
  const checkPayments = async () => {
    setPayBusy(true); setError("");
    try { setPay(await api("/admin/payments/")); } catch (e) { setError(e.message); }
    setPayBusy(false);
  };
  const send = async (e) => {
    e.preventDefault(); setResult(""); setError("");
    try {
      const d = await api("/admin/announce/", { method: "POST", body: ann });
      setResult(`Sent in-app to ${d.in_app} people and by email to ${d.emails}.`);
      setAnn({ ...ann, subject: "", message: "" });
    } catch (err) { setError(err.message); }
  };
  const sendReply = async (e, id) => {
    e.preventDefault();
    try { await api(`/admin/support/${id}/reply/`, { method: "POST", body: { message: reply } }); setReply(""); loadTickets(); }
    catch (err) { setError(err.message); }
  };
  const close = async (id) => { try { await api(`/admin/support/${id}/close/`, { method: "POST" }); loadTickets(); } catch (e) { setError(e.message); } };

  return (
    <section>
      <h1>Admin</h1>
      {error && <p className="error">{error}</p>}

      <h2>Stall approvals</h2>
      <div className="stall">
        {stalls.length === 0 && <p className="muted">No stalls yet.</p>}
        {stalls.map((s) => {
          const same = s.payout_ready && stalls.filter((x) => x.payout_ready && x.bank_name === s.bank_name && x.account_last4 === s.account_last4).length > 1;
          return (
          <div key={s.id} className="row">
            <span>{s.name} <span className="muted">· {s.items.length} items · {s.payout_ready ? `pays out to ${s.bank_name || "bank"} ending ${s.account_last4}` : "no bank account"}</span>
              {same && <span className="chip open" title="Two stalls share this payout account">same account as another stall</span>}</span>
            <span className={s.approved ? "ok" : "muted"}>{s.approved ? "Approved" : "Pending"}</span>
            <button onClick={() => decide(s.id, !s.approved)}>{s.approved ? "Revoke" : "Approve"}</button>
          </div>
          );
        })}
      </div>

      <h2>Where did the money go?</h2>
      <div className="stall">
        <p className="muted">Asks Paystack which stall account each recent real payment was routed to. Takes a few seconds.</p>
        <button onClick={checkPayments} disabled={payBusy}>{payBusy ? "Checking…" : "Check recent payments"}</button>
        {pay && <p className="muted">Paystack key mode: <strong>{pay.mode}</strong></p>}
        {pay && pay.rows.length === 0 && <p className="muted">No real payments yet.</p>}
        {pay && pay.payouts?.length > 0 && <h3>Paid out to stalls (Paystack settlements)</h3>}
        {pay && pay.payouts?.map((p) => (
          <div key={p.stall} className="row">
            <span>{p.stall}
              <small>{p.error ? p.error : p.settlements.length === 0 ? "Nothing settled yet. Paystack pays out on its schedule, usually the next business day."
                : p.settlements.map((s) => `₦${s.amount.toLocaleString()} ${s.status}${s.date ? ` (${s.date})` : ""}`).join(" · ")}</small></span>
            <span className="muted">{p.bank}</span>
          </div>
        ))}
        {pay && <h3>Recent payments</h3>}
        {pay && pay.rows.map((r) => (
          <div key={r.order} className="row">
            <span>Order #{r.order} · {r.stall} · ₦{Number(r.amount).toLocaleString()}
              <small>{r.error ? r.error : r.ok ? `Routed to the stall's account (${r.bank || r.routed_to})` : r.routed_to ? `Routed to a different account (${r.bank || r.routed_to})` : "Not split: all of it stayed with your main Paystack account"}</small></span>
            <span className={`chip ${r.ok ? "verified" : "unverified"}`}>{r.ok ? "OK" : "Check"}</span>
          </div>
        ))}
      </div>

      <h2>Send an update</h2>
      <form className="stall form-grid" onSubmit={send}>
        <input placeholder="Subject" value={ann.subject} onChange={(e) => setAnn({ ...ann, subject: e.target.value })} />
        <textarea rows={4} placeholder="Your message" value={ann.message} onChange={(e) => setAnn({ ...ann, message: e.target.value })} />
        <div className="inline" style={{ margin: 0 }}>
          <select value={ann.audience} onChange={(e) => setAnn({ ...ann, audience: e.target.value })}>
            <option value="all">Everyone</option><option value="students">Students</option><option value="stalls">Stall owners</option>
          </select>
          <label className="check"><input type="checkbox" checked={ann.important} onChange={(e) => setAnn({ ...ann, important: e.target.checked })} /> Important service notice (sent to everyone)</label>
        </div>
        <p className="muted">Without that box, only people who opted in to announcements are messaged. Emails go to verified addresses only.</p>
        {result && <p className="ok">{result}</p>}
        <button disabled={!ann.subject || !ann.message}>Send update</button>
      </form>

      <h2 id="support">Support inbox {tickets.some((t) => t.awaiting) && <span className="chip new">needs reply</span>}</h2>
      {tickets.length === 0 && <p className="muted">No messages yet. When someone writes in Help & support, you'll see it here and get a notification.</p>}
      {tickets.map((t) => (
        <div key={t.id} className="stall">
          <div className="row" style={{ border: 0, cursor: "pointer" }} onClick={() => setOpen(open === t.id ? null : t.id)}>
            <span><strong>{t.subject}</strong> <span className="muted">· {t.user} · {fmtDate(t.updated)}</span></span>
            <span className={`chip ${t.awaiting ? "new" : t.status}`}>{t.awaiting ? "needs reply" : t.status}</span>
          </div>
          {open === t.id && (
            <>
              <div className="thread chat-thread">
                {t.messages.map((m, i) => <div key={i} className={`bubble ${m.from_staff ? "me" : ""}`}>{m.text}<small>{m.from_staff ? "You" : t.user} · {fmtTime(m.created)}</small></div>)}
              </div>
              <form className="inline" onSubmit={(e) => sendReply(e, t.id)}>
                <input placeholder="Write a reply and press Enter" value={reply} onChange={(e) => setReply(e.target.value)} />
                <button disabled={!reply.trim()}>Reply</button>
                {t.status === "open" && <button type="button" className="ghost-dark" onClick={() => close(t.id)}>Close</button>}
              </form>
            </>
          )}
        </div>
      ))}
    </section>
  );
}