import { useState } from "react";
import Link from "next/link";
import { api, naira } from "../lib/api";

export default function Recommend() {
  const [f, setF] = useState({ budget: "", health: "none", goal: "balanced", meal: "" });
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

    const go = async (e) => {
    e.preventDefault();
    try {
      const campus = localStorage.getItem("fud_campus") || "";
      setRes(await api(`/recommend/?${new URLSearchParams({ ...f, campus })}`));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section>
      <h1>Meals that fit you</h1>
      <form className="card" style={{ margin: "0 0 1.5rem", maxWidth: 420 }} onSubmit={go}>
        <input type="number" placeholder="Budget (₦), optional" value={f.budget} onChange={set("budget")} />
        <select value={f.meal} onChange={set("meal")}>
          <option value="">Meal: based on the time now</option>
          <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option><option value="snack">Snack</option>
        </select>
        <select value={f.goal} onChange={set("goal")}>
          <option value="balanced">Goal: eat balanced</option><option value="weight_loss">Goal: lose weight</option>
          <option value="muscle_gain">Goal: build muscle</option>
        </select>
        <select value={f.health} onChange={set("health")}>
          <option value="none">Health: nothing to account for</option><option value="diabetes">Health: diabetes</option>
          <option value="hypertension">Health: high blood pressure</option><option value="ulcer">Health: ulcer</option>
        </select>
        <button>Find meals</button>
      </form>
      {error && <p className="error">{error}</p>}
      {res && res.note && <p className="note">{res.note}</p>}
      {res && res.ai_hint && <p className="muted">Want a personal tip from AI? Turn it on under <Link href="/profile?tab=privacy">Privacy</Link>.</p>}
      {res && res.picks.length === 0 && <p>Nothing matches. Try a higher budget or a different goal.</p>}
      {res && res.picks.map((p) => (
        <div key={p.id} className="row">
          <span><strong>{p.name}</strong> <span className="muted">· {p.stall}{p.why.length ? ` · ${p.why.join(", ")}` : ""}</span></span>
          <span className="price">{naira(p.price)}</span>
        </div>
      ))}
      {res && <p className="muted">General food guidance, not medical advice. <Link href="/">Go to the menu to order.</Link></p>}
    </section>
  );
}
