import { useEffect, useState } from "react";
import Pic from "../components/Pic";
import { api, mapsLink, media, naira } from "../lib/api";
import { statusLabel, TAGS } from "../lib/status";

const NEXT = { pending: "accepted", accepted: "preparing", preparing: "ready", ready: "completed" };
const NEXT_LABEL = { accepted: "Accept", preparing: "Start preparing", ready: "Mark ready", completed: "Mark collected" };
const BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "FCMB", code: "214" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "Guaranty Trust Bank", code: "058" },
  { name: "Jaiz Bank", code: "301" },
  { name: "Keystone Bank", code: "082" },
  { name: "Kuda Microfinance Bank", code: "50211" },
  { name: "Moniepoint MFB", code: "50515" },
  { name: "OPay", code: "999992" },
  { name: "PalmPay", code: "999991" },
  { name: "Polaris Bank", code: "076" },
  { name: "Providus Bank", code: "101" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Sterling Bank", code: "232" },
  { name: "Union Bank", code: "032" },
  { name: "United Bank for Africa", code: "033" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
];
export default function Stall() {
  const [stall, setStall] = useState(null);
  const [orders, setOrders] = useState([]);
  const [f, setF] = useState({ name: "", price: "", tags: [] });
  const [itemPic, setItemPic] = useState(null);
  const [itemPicKey, setItemPicKey] = useState(0);
  const [fee, setFee] = useState("");
  const [logo, setLogo] = useState(null);
  const [banner, setBanner] = useState(null);
  const [picKey, setPicKey] = useState(0);
  const [bank, setBank] = useState({ bank_code: "", account_number: "" });
  const [banks, setBanks] = useState([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const loadOrders = () => api("/orders/").then(setOrders).catch(() => {});
  useEffect(() => {
    api("/my-stall/").then((st) => { setStall(st); setFee(String(st.delivery_fee)); }).catch((e) => setError(e.message));
    api("/banks/").then(setBanks).catch(() => {});
    loadOrders();
    const t = setInterval(loadOrders, 15000);
    return () => clearInterval(t);
  }, []);

  const addItem = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData(); // a form upload, so the picture can travel with the item
      fd.append("name", f.name);
      fd.append("price", f.price);
      f.tags.forEach((t) => fd.append("tags", t));
      if (itemPic) fd.append("image", itemPic);
      setStall(await api("/my-stall/", { method: "POST", body: fd }));
      setF({ name: "", price: "", tags: [] }); setItemPic(null); setItemPicKey((k) => k + 1); setError("");
    } catch (err) { setError(err.message); }
  };
  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append("delivery_fee", fee || "0");
      if (logo) fd.append("logo", logo);
      if (banner) fd.append("banner", banner);
      const st = await api("/my-stall/profile/", { method: "POST", body: fd });
      setStall(st); setFee(String(st.delivery_fee)); setLogo(null); setBanner(null); setPicKey((k) => k + 1);
      setMsg("Stall profile saved."); setError("");
    } catch (err) { setError(err.message); }
  };
  const toggleTag = (t) => setF({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] });

  const saveBank = async (e) => {
    e.preventDefault();
    try {
      const chosen = (banks.length ? banks : BANKS).find((b) => b.code === bank.bank_code);
      await api("/my-stall/payout/", { method: "POST", body: { ...bank, bank_name: chosen ? chosen.name : "" } });
      setBank({ bank_code: "", account_number: "" });
      setStall(await api("/my-stall/")); setMsg("Bank account saved. Orders now pay out to it."); setError("");
    } catch (err) { setError(err.message); }
  };
  const advance = async (id, status) => {
    if (status === "cancelled" && !confirm("Cancel this order? The student is refunded through Paystack.")) return;
    try {
      const d = await api(`/orders/${id}/status/`, { method: "POST", body: { status } });
      setError(d.refund_error ? `Order cancelled, but the refund failed: ${d.refund_error}. Refund it from your Paystack dashboard.` : "");
      loadOrders();
    } catch (err) { setError(err.message); }
  };
  const removeItem = async (id, name) => {
    if (!confirm(`Remove "${name}" from your menu?`)) return;
    try { await api(`/my-stall/items/${id}/`, { method: "DELETE" }); setStall(await api("/my-stall/")); setError(""); }
    catch (err) { setError(err.message); }
  };

  if (error && !stall) return <p className="error">{error}</p>;
  if (!stall) return <p>Loading…</p>;
  return (
    <section>
      <h1>{stall.name}</h1>
      {!stall.approved && <p className="note">Waiting for approval. Students can't see your menu yet.</p>}
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok">{msg}</p>}

      <h2>Stall profile</h2>
      <form className="stall form-grid" onSubmit={saveProfile}>
        {stall.banner && <img className="stall-banner" src={media(stall.banner)} alt="Your stall banner" />}
        <div className="stall-head">
          <Pic src={media(stall.logo)} name={stall.name} size={64} round />
          <span className="muted">Campus: {stall.campus_name || "not set yet (ask the platform admin)"}</span>
        </div>
        <label className="muted">Logo
          <input key={`l${picKey}`} type="file" accept="image/*" onChange={(e) => setLogo(e.target.files[0] || null)} />
        </label>
        <label className="muted">Banner
          <input key={`b${picKey}`} type="file" accept="image/*" onChange={(e) => setBanner(e.target.files[0] || null)} />
        </label>
        <label className="muted">Delivery fee (₦), charged once per order. Use 0 for free delivery.
          <input type="number" min="0" value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>
        <button>Save stall profile</button>
      </form>

      <h2>Payouts</h2>
      <p className={stall.payout_ready ? "ok" : "muted"}>{stall.payout_ready ? `Saved: ${stall.bank_name || "Bank account"} ending ${stall.account_last4 || "••••"}. To change it, choose a bank and enter a new number below.` : "Add your bank account. Students' payments go straight to it."}</p>
      <form className="inline" onSubmit={saveBank}>
        <select value={bank.bank_code} onChange={(e) => setBank({ ...bank, bank_code: e.target.value })}>
          <option value="">Choose your bank</option>
          {(banks.length ? banks : BANKS).map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
        <input placeholder="10-digit account number" value={bank.account_number} onChange={(e) => setBank({ ...bank, account_number: e.target.value })} />
        <button>Save bank account</button>
      </form>

      <h2>Menu</h2>
      {stall.items.map((i) => <div key={i.id} className="row item-row"><Pic src={media(i.image)} name={i.name} size={48} /><span className="grow">{i.name} <span className="muted">{i.tags.join(", ")}</span></span><span className="price">{naira(i.price)}</span><button className="danger" onClick={() => removeItem(i.id, i.name)}>Delete</button></div>)}
      <form onSubmit={addItem} style={{ margin: ".75rem 0 1.5rem" }}>
        <div className="inline">
          <input placeholder="Item name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input placeholder="Price (₦)" type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          <button>Add item</button>
        </div>
        <label className="muted">Picture of the food (shows on the menu and in orders)
          <input key={itemPicKey} type="file" accept="image/*" onChange={(e) => setItemPic(e.target.files[0] || null)} />
        </label>
        <p className="muted">Tags help students find the right meal:</p>
        {TAGS.map((t) => <label key={t} style={{ marginRight: ".8rem" }}><input type="checkbox" checked={f.tags.includes(t)} onChange={() => toggleTag(t)} /> {t}</label>)}
      </form>

      <h2>Incoming orders</h2>
      {orders.length === 0 && <p className="muted">No paid orders yet.</p>}
      {orders.map((o) => (
        <div key={o.id} className="stall">
          <strong>{o.student}</strong> <span className="muted">· Order #{o.id} · {statusLabel(o)}</span>
          {o.phone && <p>Phone: <a href={`tel:${o.phone}`}>{o.phone}</a></p>}
          {o.pickup && <p>Collect at: {o.pickup}</p>}
          {o.lat != null && o.lng != null && <p><a href={mapsLink(o.lat, o.lng)} target="_blank" rel="noopener noreferrer">Open the student&apos;s location on the map</a></p>}
          {o.lines.map((l, i) => <div key={i} className="row item-row"><Pic src={media(l.image)} name={l.name} size={40} /><span className="grow">{l.qty} × {l.name}</span><span>{naira(l.qty * l.price)}</span></div>)}
          <div className="bill-line"><span>Food</span><span>{naira(o.subtotal)}</span></div>
          <div className="bill-line"><span>Delivery fee</span><span>{o.delivery_fee ? naira(o.delivery_fee) : "Free"}</span></div>
          <p className="total bill-total"><span>Total</span><span>{naira(o.total)}</span></p>
          {NEXT[o.status] && <button onClick={() => advance(o.id, NEXT[o.status])}>{NEXT_LABEL[NEXT[o.status]]}</button>}
          {!["completed", "cancelled"].includes(o.status) && <> <button className="danger" onClick={() => advance(o.id, "cancelled")}>Cancel order</button></>}
        </div>
      ))}
    </section>
  );
}