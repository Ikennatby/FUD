import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Icon from "../components/Icon";
import { api, getAuth, setAuth } from "../lib/api";
import { fmtDate, fmtTime } from "../lib/status";
import Orders from "./orders";

const ROLE = { student: "Student", stall_admin: "Stall owner", platform_admin: "Platform admin" };
const MENU = [
  { key: "history", label: "Order history", icon: "history", roles: ["student"] },
  { key: "account", label: "Account", icon: "user" },
  { key: "privacy", label: "Privacy", icon: "lock" },
  { key: "notifications", label: "Notifications", icon: "bell" },
  { key: "help", label: "Help & support", icon: "help", roles: ["student", "stall_admin"] },
  { key: "inbox", label: "Support inbox", icon: "help", roles: ["platform_admin"], href: "/admin#support" },
  { key: "delete", label: "Delete account", icon: "trash", danger: true },
];

function Toggle({ on, onChange, label, hint, disabled }) {
  return (
    <label className={`toggle ${disabled ? "off" : ""}`}>
      <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" role="switch" checked={!!on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <i className="switch" />
    </label>
  );
}
const Msg = ({ m }) => (m?.text ? <p className={m.bad ? "error" : "ok"}>{m.text}</p> : null);

/* ---------- Account ---------- */
function Account({ me, reload }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(null);
  const [phone, setPhone] = useState(me.phone || "");
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [m, setM] = useState({});
  const say = (k, text, bad = false) => setM((x) => ({ ...x, [k]: { text, bad } }));

  const sendCode = async (target) => {
    try {
      const d = await api("/me/email/", { method: "POST", body: { email: target } });
      setSent(d); say("email", `We sent a 6-digit code to ${d.email}.`);
    } catch (e) { say("email", e.message, true); }
  };
  const verify = async (e) => {
    e.preventDefault();
    try {
      await api("/me/email/verify/", { method: "POST", body: { code } });
      setSent(null); setCode(""); setEmail(""); say("email", "Email verified."); reload();
    } catch (err) { say("email", err.message, true); }
  };
  const savePhone = async (e) => {
    e.preventDefault();
    try { await api("/me/", { method: "PATCH", body: { phone } }); say("phone", "Phone number saved."); reload(); }
    catch (err) { say("phone", err.message, true); }
  };
  const changePw = async (e) => {
    e.preventDefault();
    try {
      await api("/me/password/", { method: "POST", body: pw });
      setPw({ current_password: "", new_password: "" }); say("pw", "Password changed.");
    } catch (err) { say("pw", err.message, true); }
  };

  return (
    <>
      <div className="panel">
        <h2>Your details</h2>
        <div className="row"><span className="muted">Username</span><strong>{me.username}</strong></div>
        <div className="row"><span className="muted">Account type</span><strong>{ROLE[me.role]}</strong></div>
        <div className="row"><span className="muted">Member since</span><strong>{fmtDate(me.joined)}</strong></div>
      </div>

      <div className="panel">
        <h2>Email</h2>
        <p>{me.email || "No email added yet."} {me.email && <span className={`chip ${me.email_verified ? "verified" : "unverified"}`}>{me.email_verified ? "Verified" : "Not verified"}</span>}</p>
        {me.email && !me.email_verified && !sent && <button onClick={() => sendCode(me.email)}>Send me a verification code</button>}
        {sent && (
          <form className="inline" onSubmit={verify}>
            <input className="codebox small-code" inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <button disabled={code.length !== 6}>Verify</button>
          </form>
        )}
        {sent?.dev_code && <p className="note">Local testing: your code is <strong>{sent.dev_code}</strong> (also printed in the backend terminal).</p>}
        <form className="inline" onSubmit={(e) => { e.preventDefault(); sendCode(email); }}>
          <input type="email" placeholder={me.email ? "Change to a new email" : "Add your email"} value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="ghost-dark" disabled={!email}>Send code</button>
        </form>
        <Msg m={m.email} />
      </div>

      <div className="panel">
        <h2>Phone number</h2>
        <form className="inline" onSubmit={savePhone}>
          <input type="tel" placeholder="e.g. 0803 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button>Save</button>
        </form>
        <Msg m={m.phone} />
      </div>

      <div className="panel">
        <h2>Change password</h2>
        <form className="form-grid" onSubmit={changePw}>
          <input type="password" autoComplete="current-password" placeholder="Current password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
          <input type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
          <button disabled={!pw.current_password || !pw.new_password}>Change password</button>
        </form>
        <Msg m={m.pw} />
      </div>
    </>
  );
}

/* ---------- Privacy ---------- */
function Privacy({ me, update }) {
  const [msg, setMsg] = useState("");
  const download = async () => {
    try {
      const d = await api("/me/export/");
      const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = "my-fud-data.json"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setMsg(e.message); }
  };
  return (
    <>
      <div className="panel">
        <h2>Third-party services</h2>
        <p className="muted">You decide which optional services may process your personal data. Changes apply straight away.</p>
        <h3>Needed to run FÜD</h3>
        <div className="row"><span><strong>Paystack</strong><small>Processes your payment. We never see your card details.</small></span><span className="chip verified">Required</span></div>
        <div className="row"><span><strong>Email delivery</strong><small>Sends verification codes and account messages to the address you gave us.</small></span><span className="chip verified">Required</span></div>
        <h3>Optional, off until you say so</h3>
        <Toggle label="AI meal tips" hint="Sends your budget, goal and health choice from Meal picks to Anthropic (the company behind Claude), so it can write a short personal tip."
          on={me.consent_ai} onChange={(v) => update({ consent_ai: v })} />
        <Toggle label="Analytics and performance" hint="Lets us measure how the site is used so we can improve it. No analytics tool is installed yet, and none will run unless this is on."
          on={me.consent_analytics} onChange={(v) => update({ consent_analytics: v })} />
        {me.consent_updated && <p className="muted">Choices last updated {fmtDate(me.consent_updated)}.</p>}
      </div>
      <div className="panel">
        <h2>Your data</h2>
        <p className="muted">Download a copy of your account details, orders and support messages.</p>
        <button onClick={download}>Download my data</button>
        {msg && <p className="error">{msg}</p>}
      </div>
    </>
  );
}

/* ---------- Notifications ---------- */
function Notifications({ me, update }) {
  const [inbox, setInbox] = useState(null);
  const [perm, setPerm] = useState(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [msg, setMsg] = useState("");
  const load = () => api("/notifications/").then(setInbox).catch(() => {});
  useEffect(() => { load(); }, []);

  const toggleBrowser = async (on) => {
    if (!on) return update({ notify_browser: false });
    if (perm === "unsupported") { setMsg("This browser doesn't support notifications."); return; }
    const result = perm === "granted" ? "granted" : await Notification.requestPermission();
    setPerm(result);
    if (result === "granted") { setMsg(""); update({ notify_browser: true }); }
    else setMsg("Notifications are blocked. Allow them for this site in your browser settings, then try again.");
  };
  const markRead = async () => {
    await api("/notifications/read/", { method: "POST" }).catch(() => {});
    load(); window.dispatchEvent(new Event("fud:refresh"));
  };

  return (
    <>
      <div className="panel">
        <h2>How should we reach you?</h2>
        <p className="muted">Pick the ways you'd like to hear about your orders and account.</p>
        <Toggle label="Email" disabled={!me.email_verified}
          hint={me.email_verified ? `Order updates and account messages to ${me.email}.` : "Verify your email in Account to turn this on."}
          on={me.notify_email && me.email_verified} onChange={(v) => update({ notify_email: v })} />
                  <Toggle label="In the app" hint="Updates in the bell menu and this page." on={me.notify_inapp} onChange={(v) => update({ notify_inapp: v })} />
        <Toggle label="Browser pop-ups" hint={perm === "denied" ? "Blocked in your browser settings." : "Pop-ups while FÜD is open. Your browser will ask permission."}
          on={me.notify_browser && perm === "granted"} onChange={toggleBrowser} />
        <Toggle label="Announcements and promotions" hint="News and offers from FÜD. Important service notices are always sent."
          on={me.notify_promos} onChange={(v) => update({ notify_promos: v })} />
        {msg && <p className="error">{msg}</p>}
      </div>
      <div className="panel">
        <div className="row" style={{ border: 0, padding: 0 }}>
          <h2 style={{ margin: 0 }}>Inbox</h2>
          {inbox?.unread > 0 && <button className="ghost-dark small" onClick={markRead}>Mark all as read</button>}
        </div>
        {inbox && inbox.items.length === 0 && <p className="muted">Nothing here yet.</p>}
        {inbox?.items.map((n) => (
          <div key={n.id} className={`note-item ${n.read ? "" : "unread"}`}>
            <strong>{n.title}</strong>
            {n.body && <span>{n.body}</span>}
            <small>{fmtDate(n.created)}{n.link && <> · <a href={n.link}>Open</a></>}</small>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Help: live chat with the admin ---------- */
function Help() {
  const [tickets, setTickets] = useState(null);
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({ subject: "", message: "" });
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const endRef = useRef(null);

  const load = () => api("/support/").then((d) => { setTickets(d); setOpen((cur) => cur ?? d[0]?.id ?? null); }).catch((e) => setError(e.message));
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []); // new replies appear within seconds

  const current = tickets?.find((t) => t.id === open);
  const count = current?.messages.length;
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [count, open]);

  const create = async (e) => {
    e.preventDefault();
    try { const t = await api("/support/", { method: "POST", body: form }); setForm({ subject: "", message: "" }); setOpen(t.id); setError(""); load(); }
    catch (err) { setError(err.message); }
  };
  const send = async (e) => {
    e.preventDefault();
    try { await api(`/support/${open}/reply/`, { method: "POST", body: { message: reply } }); setReply(""); load(); }
    catch (err) { setError(err.message); }
  };

  return (
    <>
      {current && (
        <div className="panel chat">
          <div className="row" style={{ border: 0, padding: 0 }}>
            <h2 style={{ margin: 0 }}>{current.subject}</h2>
            <span className={`chip ${current.status}`}>{current.status}</span>
          </div>
          <div className="thread chat-thread">
            {current.messages.map((m, i) => (
              <div key={i} className={`bubble ${m.from_staff ? "" : "me"}`}>{m.text}<small>{m.from_staff ? "FÜD support" : "You"} · {fmtTime(m.created)}</small></div>
            ))}
            <div ref={endRef} />
          </div>
          <form className="inline" style={{ margin: 0 }} onSubmit={send}>
            <input placeholder="Type a message and press Enter" value={reply} onChange={(e) => setReply(e.target.value)} />
            <button disabled={!reply.trim()}>Send</button>
          </form>
          <p className="muted" style={{ marginBottom: 0 }}>{current.awaiting ? "Sent. An admin will reply here, and you'll get a notification." : "Replies show up here automatically."}</p>
        </div>
      )}
      {tickets?.length > 1 && (
        <div className="panel">
          <h2>Your conversations</h2>
          {tickets.map((t) => (
            <div key={t.id} className="row" style={{ cursor: "pointer" }} onClick={() => setOpen(t.id)}>
              <span><strong>{t.subject}</strong><small>{fmtDate(t.updated)}</small></span>
              <span className={`chip ${t.id === open ? "verified" : t.status}`}>{t.id === open ? "open here" : t.status}</span>
            </div>
          ))}
        </div>
      )}
      <form className="panel form-grid" onSubmit={create}>
        <h2>{tickets?.length ? "Start a new conversation" : "Tell us what's wrong"}</h2>
        <input placeholder="Short title, e.g. “Payment taken but no order”" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <textarea rows={4} placeholder="Describe the problem. Include the stall and roughly when it happened." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        {error && <p className="error">{error}</p>}
        <button disabled={!form.subject.trim() || !form.message.trim()}>Send to support</button>
      </form>
    </>
  );
}

/* ---------- Delete ---------- */
function Delete({ onDone }) {
  const [password, setPassword] = useState("");
  const [sure, setSure] = useState(false);
  const [error, setError] = useState("");
  const go = async (e) => {
    e.preventDefault();
    try { await api("/me/", { method: "DELETE", body: { password } }); onDone(); }
    catch (err) { setError(err.message); }
  };
  return (
    <form className="panel danger-zone form-grid" onSubmit={go}>
      <h2>Delete your account</h2>
      <div>
        <p><strong>What we remove:</strong> your username, email, phone number, saved bank details, notifications and support chats.</p>
        <p><strong>What we keep:</strong> your past paid orders, without your name, because stalls need them for their sales records.</p>
        <p>This can't be undone, and it isn't possible while an order is still in progress.</p>
      </div>
      <input type="password" autoComplete="current-password" placeholder="Enter your password to confirm" value={password} onChange={(e) => setPassword(e.target.value)} />
      <label className="check"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> I understand this is permanent</label>
      {error && <p className="error">{error}</p>}
      <button className="danger" disabled={!sure || !password}>Delete my account</button>
    </form>
  );
}

/* ---------- Page ---------- */
export default function Profile() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");

  const reload = () => api("/me/").then((d) => { setMe(d); window.dispatchEvent(new Event("fud:refresh")); }).catch((e) => setError(e.message));
  useEffect(() => { if (!getAuth()) { router.replace("/login"); return; } reload(); }, []);

  const update = async (patch) => {
    setMe((m) => ({ ...m, ...patch })); // switch it instantly; undo if the server says no
    try { await api("/me/", { method: "PATCH", body: patch }); window.dispatchEvent(new Event("fud:refresh")); }
    catch (e) { setError(e.message); reload(); }
  };
  const leave = () => { setAuth(null); window.dispatchEvent(new Event("fud:refresh")); router.push("/"); };

  if (error && !me) return <p className="error">{error}</p>;
  if (!me) return <div className="profile"><div className="pmenu skeleton" style={{ height: 320 }} /><div className="panel skeleton" style={{ height: 320 }} /></div>;

  const items = MENU.filter((m) => !m.roles || m.roles.includes(me.role));
  const tab = items.find((m) => m.key === router.query.tab) || items[0];
  const go = (key) => { const m = items.find((i) => i.key === key); if (m?.href) router.push(m.href); else router.push({ pathname: "/profile", query: { tab: key } }, undefined, { shallow: true }); };

  return (
    <div className="profile">
      <aside className="pmenu">
        <div className="who">
          <span className="avatar">{me.username[0].toUpperCase()}</span>
          <span><strong>{me.username}</strong><small>{ROLE[me.role]}</small></span>
        </div>
        {items.map((m) => (
          <button key={m.key} className={`${tab.key === m.key ? "active" : ""} ${m.danger ? "danger-item" : ""}`} onClick={() => go(m.key)}>
            <Icon name={m.icon} />{m.label}
          </button>
        ))}
        <hr />
        <button onClick={leave}><Icon name="logout" />Log out</button>
      </aside>
      <div className="pcontent" key={tab.key}>
        <h1>{tab.label}</h1>
        {error && <p className="error">{error}</p>}
        {tab.key === "history" && <Orders embedded />}
        {tab.key === "account" && <Account me={me} reload={reload} />}
        {tab.key === "privacy" && <Privacy me={me} update={update} />}
        {tab.key === "notifications" && <Notifications me={me} update={update} />}
        {tab.key === "help" && <Help />}
        {tab.key === "delete" && <Delete onDone={leave} />}
      </div>
    </div>
  );
}