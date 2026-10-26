import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Icon from "../components/Icon";
import { api, getAuth } from "../lib/api";

export default function VerifyEmail() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState({ text: "", bad: false });
  const [dev, setDev] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getAuth()) { router.replace("/login"); return; }
    setDev(sessionStorage.getItem("fud_dev_code") || "");
    api("/me/").then((d) => { if (d.email_verified) router.replace("/"); else setMe(d); }).catch((e) => setMsg({ text: e.message, bad: true }));
  }, []);

  const resend = async () => {
    try {
      const d = await api("/me/email/", { method: "POST", body: { email: me?.email } });
      setDev(d.dev_code || ""); setMsg({ text: `A new code is on its way to ${d.email}.`, bad: false });
    } catch (e) { setMsg({ text: e.message, bad: true }); }
  };
  const verify = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/me/email/verify/", { method: "POST", body: { code } });
      sessionStorage.removeItem("fud_dev_code");
      window.dispatchEvent(new Event("fud:refresh"));
      router.push(getAuth()?.role === "stall_admin" ? "/stall" : "/");
    } catch (err) { setMsg({ text: err.message, bad: true }); setBusy(false); }
  };

  return (
    <div className="verify-wrap">
      <form className="verify-card" onSubmit={verify}>
        <span className="verify-icon"><Icon name="mail" size={28} /></span>
        <h1>Check your email</h1>
        <p className="muted break">We sent a 6-digit code to <strong>{me?.email || "your email"}</strong>. It&apos;s good for 15 minutes.</p>
        {dev && <p className="note">Local testing: your code is <strong>{dev}</strong>. It&apos;s also printed in the backend terminal.</p>}
        <input className="codebox" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        {msg.text && <p className={msg.bad ? "error" : "ok"}>{msg.text}</p>}
        <button disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify email"}</button>
        <div className="verify-actions">
          <button type="button" className="ghost-dark" onClick={resend}>Send a new code</button>
          <Link href="/" className="skip">Skip for now</Link>
        </div>
      </form>
    </div>
  );
}