import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "../components/Icon";
import { api } from "../lib/api";

// Step 1: enter your email and we send a 6-digit code. Step 2: enter the code and choose a new password.
export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState({ text: "", bad: false });
  const [dev, setDev] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [wait, setWait] = useState(0); // seconds before another code can be requested

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const sendCode = async (e) => {
    e?.preventDefault();
    setBusy(true); setMsg({ text: "", bad: false });
    try {
      const d = await api("/password/forgot/", { method: "POST", body: { email } });
      setDev(d.dev_code || "");
      setStep(2); setWait(60);
      setMsg({ text: `If an account uses ${email.trim()}, a 6-digit code is on its way. It's good for 15 minutes.`, bad: false });
    } catch (err) { setMsg({ text: err.message, bad: true }); }
    setBusy(false);
  };

  const reset = async (e) => {
    e.preventDefault();
    if (pw.length < 8) { setMsg({ text: "Choose a password of at least 8 characters.", bad: true }); return; }
    if (pw !== pw2) { setMsg({ text: "The two passwords don't match.", bad: true }); return; }
    setBusy(true); setMsg({ text: "", bad: false });
    try {
      await api("/password/reset/", { method: "POST", body: { email, code, new_password: pw } });
      setDone(true);
    } catch (err) { setMsg({ text: err.message, bad: true }); }
    setBusy(false);
  };

  if (done) {
    return (
      <div className="verify-wrap">
        <div className="verify-card">
          <span className="verify-icon"><Icon name="check" size={28} /></span>
          <h1>Password changed</h1>
          <p className="muted">You can now log in with your new password.</p>
          <Link href="/login" className="btn">Go to log in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-wrap">
      {step === 1 ? (
        <form className="verify-card" onSubmit={sendCode}>
          <span className="verify-icon"><Icon name="mail" size={28} /></span>
          <h1>Forgot your password?</h1>
          <p className="muted">Enter the email on your account and we&apos;ll send you a code to reset it.</p>
          <input type="email" placeholder="Your email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {msg.text && <p className={msg.bad ? "error" : "ok"}>{msg.text}</p>}
          <button disabled={busy || !email.includes("@")}>{busy ? "Sending…" : "Send reset code"}</button>
          <Link href="/login" className="skip">Back to log in</Link>
        </form>
      ) : (
        <form className="verify-card" onSubmit={reset}>
          <span className="verify-icon"><Icon name="mail" size={28} /></span>
          <h1>Enter your code</h1>
          {msg.text && <p className={msg.bad ? "error" : "ok"}>{msg.text}</p>}
          {dev && <p className="note">Local testing: your code is <strong>{dev}</strong>. It&apos;s also printed in the backend terminal.</p>}
          <input className="codebox" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <input type="password" placeholder="New password (8+ characters)" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <input type="password" placeholder="Type the new password again" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          <button disabled={busy || code.length !== 6 || !pw}>{busy ? "Saving…" : "Change password"}</button>
          <div className="verify-actions">
            <button type="button" className="ghost-dark" onClick={sendCode} disabled={busy || wait > 0}>{wait > 0 ? `Send a new code (${wait}s)` : "Send a new code"}</button>
            <Link href="/login" className="skip">Back to log in</Link>
          </div>
        </form>
      )}
    </div>
  );
}