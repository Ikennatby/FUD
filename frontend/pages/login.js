import { useState } from "react";
import { useRouter } from "next/router";
import { api, setAuth } from "../lib/api";

export default function Login() {
  const router = useRouter();
  const [f, setF] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    try {
      const d = await api("/login/", { method: "POST", body: f });
      setAuth({ access: d.access, role: d.role, username: d.username });
      router.push(d.role === "stall_admin" ? "/stall" : d.role === "platform_admin" ? "/admin" : "/");
    } catch (err) { setError(err.message.startsWith("No active account") ? "Wrong username or password." : err.message); }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h1>Log in</h1>
      {error && <p className="error">{error}</p>}
      <input placeholder="Username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
      <input type="password" placeholder="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      <button>Log in</button>
    </form>
  );
}
