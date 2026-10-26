import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api, setAuth } from "../lib/api";

export default function Register() {
  const router = useRouter();
  const [f, setF] = useState({ username: "", email: "", phone: "", password: "", role: "student", stall_name: "", campus: "" });
  const [campuses, setCampuses] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { api("/campuses/").then(setCampuses).catch(() => {}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api("/register/", { method: "POST", body: f });
      if (r.dev_code) sessionStorage.setItem("fud_dev_code", r.dev_code);
      const d = await api("/login/", { method: "POST", body: { username: f.username, password: f.password } });
      setAuth({ access: d.access, role: d.role, username: d.username });
      router.push("/verify-email");
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h1>Create your account</h1>
      {error && <p className="error">{error}</p>}
      <select value={f.role} onChange={set("role")}>
        <option value="student">I'm a student</option>
        <option value="stall_admin">I run a food stall</option>
      </select>
      <input placeholder="Username" autoComplete="username" value={f.username} onChange={set("username")} />
      <input type="email" placeholder="Email (we'll send a code to confirm it)" autoComplete="email" value={f.email} onChange={set("email")} />
      <input type="tel" placeholder="Phone number (optional)" autoComplete="tel" value={f.phone} onChange={set("phone")} />
      <input type="password" placeholder="Password (8+ characters)" autoComplete="new-password" value={f.password} onChange={set("password")} />
      {f.role === "stall_admin" && (
        <>
          <input placeholder="Stall name" value={f.stall_name} onChange={set("stall_name")} />
          <select value={f.campus} onChange={set("campus")} required>
            <option value="">Which campus is your stall on?</option>
            {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {campuses.length === 0 && <p className="muted">No campuses have been added yet. Ask the platform admin to create yours first.</p>}
        </>
      )}
      <button disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
    </form>
  );
}