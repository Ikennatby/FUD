import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { api, getAuth, mapsLink, media, naira } from "../lib/api";
import Pic from "./Pic";

const MAX_STALLS = 5; // most stalls one order can include

// A fresh random order, so no stall is always first.
function shuffle(ids) {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Menu() {
  const router = useRouter();
  const [campuses, setCampuses] = useState(null);
  const [campusId, setCampusId] = useState(null);
  const [stalls, setStalls] = useState(null);
  const [cart, setCart] = useState({}); // item id -> { item, stall: { id, name, delivery_fee }, qty }
  const [contact, setContact] = useState({ phone: "", pickup: "" });
  const [loc, setLoc] = useState(null); // { lat, lng, acc } once the student shares their location
  const [locMsg, setLocMsg] = useState("");
  const [locBusy, setLocBusy] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [msg, setMsg] = useState("");
  const [cartMsg, setCartMsg] = useState("");
  const [auth, setAuth] = useState(null);
  const [busy, setBusy] = useState(false);
  const refreshStalls = useRef(null);

  useEffect(() => {
    const a = getAuth();
    setAuth(a);
    if (a?.role === "student") api("/me/").then((m) => setContact((c) => ({ ...c, phone: m.phone || "" }))).catch(() => {});
    api("/campuses/").then((list) => {
      setCampuses(list);
      const saved = Number(localStorage.getItem("fud_campus"));
      if (list.some((c) => c.id === saved)) setCampusId(saved);
    }).catch((e) => setMsg(e.message));
  }, []);

  // Load the stalls of the chosen campus, and refresh every 20 seconds so favourite percentages stay live.
  useEffect(() => {
    if (!campusId) { setStalls(null); return; }
    let stop = false;
    let order = null; // the random order picked when this campus page was opened; kept for the refreshes below
    const load = () => api(`/stalls/?campus=${campusId}`)
      .then((d) => {
        if (stop) return;
        if (!order) order = shuffle(d.map((s) => s.id));
        else d.forEach((s) => { if (!order.includes(s.id)) order.push(s.id); }); // a stall that just opened goes to the end
        const rank = new Map(order.map((id, i) => [id, i]));
        setStalls([...d].sort((a, b) => rank.get(a.id) - rank.get(b.id)));
        setMsg("");
      })
      .catch((e) => { if (!stop) setMsg(e.message); });
    refreshStalls.current = load;
    load();
    const t = setInterval(load, 20000);
    return () => { stop = true; clearInterval(t); };
  }, [campusId]);

  const chooseCampus = (id) => {
    if (id === campusId) return;
    if (Object.keys(cart).length && !confirm("Your cart has items from another campus. Start a new order here?")) return;
    setCart({});
    setStalls(null);
    setFavOnly(false);
    localStorage.setItem("fud_campus", String(id));
    setCampusId(id);
  };
  const changeCampus = () => {
    if (Object.keys(cart).length && !confirm("Changing campus will empty your cart. Continue?")) return;
    setCart({});
    setStalls(null);
    localStorage.removeItem("fud_campus");
    setCampusId(null);
  };

  const add = (stall, item) => {
    const inCart = new Set(Object.values(cart).map((l) => l.stall.id));
    if (!inCart.has(stall.id) && inCart.size >= MAX_STALLS) { setCartMsg(`You can order from up to ${MAX_STALLS} stalls at once.`); return; }
    setCartMsg("");
    setCart((c) => ({
      ...c,
      [item.id]: { item, stall: { id: stall.id, name: stall.name, delivery_fee: stall.delivery_fee }, qty: Math.min((c[item.id]?.qty || 0) + 1, 20) },
    }));
  };
  const change = (id, delta) => setCart((c) => {
    const next = { ...c };
    const qty = next[id].qty + delta;
    if (qty <= 0) delete next[id]; else next[id] = { ...next[id], qty: Math.min(qty, 20) };
    return next;
  });

  const toggleLike = async (s) => {
    if (auth?.role !== "student") { setMsg("Log in as a student to favourite a stall."); return; }
    try {
      const r = await api(`/stalls/${s.id}/like/`, { method: "POST" });
      setStalls((all) => all.map((x) => (x.id === s.id ? { ...x, ...r } : x)));
      setMsg("");
    } catch (e) { setMsg(e.message); }
  };

  // Ask the browser for the student's position. The browser shows its own permission pop-up first.
  const locate = () => {
    if (!navigator.geolocation) { setLocMsg("This browser can't share your location. Describe where you are instead."); return; }
    setLocBusy(true); setLocMsg("");
    navigator.geolocation.getCurrentPosition(
      (p) => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }); setLocBusy(false); },
      (e) => {
        setLocMsg(e.code === 1 ? "Location permission was denied. You can still order. Just describe where you are." : "Couldn't get your location. Try again.");
        setLocBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Cart, grouped by stall, with the bill worked out from the latest stall data.
  const lines = Object.values(cart);
  const groups = [];
  lines.forEach((l) => {
    let g = groups.find((x) => x.stall.id === l.stall.id);
    if (!g) { g = { stall: l.stall, lines: [] }; groups.push(g); }
    g.lines.push(l);
  });
  const feeOf = (g) => (stalls || []).find((s) => s.id === g.stall.id)?.delivery_fee ?? g.stall.delivery_fee;
  const subtotal = lines.reduce((s, l) => s + l.qty * l.item.price, 0);
  const delivery = groups.reduce((s, g) => s + feeOf(g), 0);
  const total = subtotal + delivery;
  const ready = contact.phone.trim().length >= 7 && contact.pickup.trim().length >= 3;

  const place = async () => {
    if (busy) return; // stops a double-click from creating two orders
    setBusy(true); setCartMsg("");
    try {
      const d = await api("/orders/new/", {
        method: "POST",
        body: { lines: lines.map((l) => ({ item: l.item.id, qty: l.qty })), phone: contact.phone, pickup: contact.pickup, lat: loc?.lat, lng: loc?.lng },
      });
      if (d.authorization_url) { window.location.href = d.authorization_url; return; } // go pay on Paystack
      setCart({});
      router.push("/orders"); // test mode: no money moved
      return;
    } catch (e) {
      setCartMsg(e.message);
      refreshStalls.current?.(); // refresh the menu in case items changed
    }
    setBusy(false);
  };

  const campus = (campuses || []).find((c) => c.id === campusId);
  const visible = (stalls || []).filter((s) => !favOnly || s.liked);

  return (
    <>
    <div className="hero">
      <div className="hero-inner">
        <p className="eyebrow">Campus food, no queue</p>
        <h1>Order from your favourite stalls and collect it when it’s ready.</h1>
        <p className="lead">Pick your campus, add meals from one or more stalls, pay once with Paystack, and watch your order move from the kitchen to you.</p>
        <div className="hero-cta">
          <a className="btn" href="#menu">Browse the menu</a>
          <Link className="btn ghost" href="/recommend">Find a meal for me</Link>
        </div>
      </div>
      <div className="blob b1" /><div className="blob b2" />
    </div>

    <div id="menu">
    {!campusId && (
      <section>
        <h2 className="section-title">Choose your campus</h2>
        <p className="muted">Pick the university you want to order from. You can order for a campus even when you’re not on it.</p>
        {msg && <p className="note">{msg}</p>}
        {campuses === null && !msg && <div className="stall skeleton" />}
        {campuses && campuses.length === 0 && <p>No campuses have been added yet. Check back soon.</p>}
        <div className="campus-grid">
          {(campuses || []).map((c) => (
            <button key={c.id} className="campus-card" onClick={() => chooseCampus(c.id)}>
              <Pic src={media(c.picture)} name={c.name} size={84} round />
              <strong>{c.name}</strong>
              <small>{c.stalls} open stall{c.stalls === 1 ? "" : "s"}</small>
            </button>
          ))}
        </div>
      </section>
    )}

    {campusId && (
    <div className="split">
      <section>
        <div className="campus-bar">
          <Pic src={media(campus?.picture)} name={campus?.name || ""} size={40} round />
          <h2 className="section-title">Open stalls · {campus?.name}</h2>
          <button className="ghost-dark small" onClick={changeCampus}>Change campus</button>
        </div>
        <div className="inline">
          <button className={favOnly ? "" : "ghost-dark"} onClick={() => setFavOnly(!favOnly)}>♥ {favOnly ? "Showing favourites" : "Favourites only"}</button>
        </div>
        {msg && <p className="note">{msg}</p>}
        {stalls === null && !msg && [0, 1].map((n) => <div key={n} className="stall skeleton" />)}
        {stalls && stalls.length === 0 && <p>No stalls are open on this campus yet. Stalls appear here once an admin approves them.</p>}
        {stalls && stalls.length > 0 && visible.length === 0 && <p>You haven’t favourited any stall on this campus yet.</p>}
        {visible.map((s, n) => (
          <div key={s.id} className="stall" style={{ "--i": n }}>
            {s.banner && <img className="stall-banner" src={media(s.banner)} alt="" />}
            <div className="stall-head">
              <Pic src={media(s.logo)} name={s.name} size={52} round />
              <div className="grow">
                <h2>{s.name}</h2>
                <small className="muted">{s.delivery_fee ? `Delivery ${naira(s.delivery_fee)}` : "Free delivery"} · {s.like_percent}% of students favourite this ({s.likes})</small>
              </div>
              <button className={`fav ${s.liked ? "on" : ""}`} onClick={() => toggleLike(s)} aria-pressed={s.liked}
                aria-label={s.liked ? `Remove ${s.name} from favourites` : `Add ${s.name} to favourites`}>
                {s.liked ? "♥" : "♡"} {s.like_percent}%
              </button>
            </div>
            {s.items.length === 0 && <p className="muted">No items yet.</p>}
            {s.items.map((i) => (
              <div key={i.id} className="row item-row">
                <Pic src={media(i.image)} name={i.name} size={56} />
                <span className="grow">{i.name}</span>
                <span className="price">{naira(i.price)}</span>
                <button onClick={() => add(s, i)} disabled={auth?.role !== "student"}>Add</button>
              </div>
            ))}
          </div>
        ))}
      </section>

      <aside className="cart">
        <h2>Your order</h2>
        {lines.length === 0 && <p className="muted">Add something from the menu. You can mix meals from different stalls.</p>}
        {groups.map((g) => (
          <div key={g.stall.id} className="bill-group">
            <h3>{g.stall.name}</h3>
            {g.lines.map((l) => (
              <div key={l.item.id} className="row">
                <span>{l.item.name}</span>
                <span className="qty">
                  <button className="small" aria-label={`Remove one ${l.item.name}`} onClick={() => change(l.item.id, -1)}>−</button>
                  {l.qty}
                  <button className="small" aria-label={`Add one ${l.item.name}`} onClick={() => change(l.item.id, 1)}>+</button>
                </span>
                <span>{naira(l.qty * l.item.price)}</span>
              </div>
            ))}
            <div className="bill-line"><span>Delivery fee</span><span>{feeOf(g) ? naira(feeOf(g)) : "Free"}</span></div>
          </div>
        ))}

        {lines.length > 0 && (
          <>
            <h3>Where should we bring it?</h3>
            <div className="form-grid">
              <input type="tel" placeholder="Your phone number (the stall will call you)" autoComplete="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
              <textarea rows={2} maxLength={300} placeholder="Where will you collect it? e.g. Block C gate, Hostel 4 room 12" value={contact.pickup} onChange={(e) => setContact({ ...contact, pickup: e.target.value })} />
              <button type="button" className="ghost-dark" onClick={locate} disabled={locBusy}>{locBusy ? "Finding you…" : loc ? "Update my location" : "Share my location"}</button>
              {loc && <p className="ok">Location shared (about {loc.acc} m). <a href={mapsLink(loc.lat, loc.lng)} target="_blank" rel="noopener noreferrer">Check on map</a></p>}
              {locMsg && <p className="note">{locMsg}</p>}
              <p className="muted small-text">Your phone number, pickup spot and location are shared with the stalls only so they can reach you with this order.</p>
            </div>

            <div className="bill">
              <div className="bill-line"><span>Food</span><span>{naira(subtotal)}</span></div>
              <div className="bill-line"><span>Delivery ({groups.length} stall{groups.length === 1 ? "" : "s"})</span><span>{delivery ? naira(delivery) : "Free"}</span></div>
              <p className="total bill-total"><span>Total</span><span>{naira(total)}</span></p>
            </div>
            {cartMsg && <p className="error">{cartMsg}</p>}
            <button onClick={place} disabled={busy || !ready || auth?.role !== "student"}>{busy ? "Please wait…" : `Pay ${naira(total)} and order`}</button>
            {!ready && <p className="muted small-text">Add your phone number and pickup spot to continue.</p>}
          </>
        )}
        {auth?.role !== "student" && <p className="muted"><Link href="/login">Log in as a student</Link> to order.</p>}
      </aside>
    </div>
    )}
    </div>
    </>
  );
}