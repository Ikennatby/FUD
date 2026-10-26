import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { api, getAuth } from "../lib/api";
import Icon from "./Icon";
import Logo from "./Logo";

export default function Nav() {
  const router = useRouter();
  const [auth, setAuthState] = useState(null);
  const [me, setMe] = useState(null);
  const [unread, setUnread] = useState(0);
  const seen = useRef(null);

  const loadMe = () => {
    const a = getAuth();
    setAuthState(a);
    if (a) api("/me/").then(setMe).catch(() => {}); else { setMe(null); setUnread(0); seen.current = null; }
  };
  useEffect(loadMe, [router.pathname]);
  useEffect(() => { window.addEventListener("fud:refresh", loadMe); return () => window.removeEventListener("fud:refresh", loadMe); }, []);

  // Check for new notifications every 20 seconds, and pop one up if the person allowed browser notifications.
  useEffect(() => {
    if (!auth) return;
    const poll = async () => {
      try {
        const d = await api("/notifications/");
        setUnread(d.unread);
        const newest = d.items[0]?.id ?? 0;
        if (seen.current === null) { seen.current = newest; return; }
        if (newest > seen.current) {
          if (me?.notify_browser && typeof Notification !== "undefined" && Notification.permission === "granted") {
            d.items.filter((n) => n.id > seen.current && !n.read).forEach((n) => new Notification(n.title, { body: n.body }));
          }
          seen.current = newest;
        }
      } catch { /* ignore */ }
    };
    poll();
    const t = setInterval(poll, 20000);
    return () => clearInterval(t);
  }, [auth, me?.notify_browser]);

   if (router.pathname === "/" && !auth) return null; // the landing page has its own top bar
  return (
    <>
      <header className="nav">
        <Link href="/" className="brand" aria-label="FÜD home"><Logo /></Link>
        <nav>
          <Link href="/">Menu</Link>
          <Link href="/recommend">Meal picks</Link>
          {auth?.role === "student" && <Link href="/orders">My orders</Link>}
          {auth?.role === "stall_admin" && <Link href="/stall">My stall</Link>}
          {auth?.role === "platform_admin" && <Link href="/admin">Admin</Link>}
          {auth ? (
            <>
              <Link href="/profile?tab=notifications" className="bell" aria-label={`Notifications, ${unread} unread`}>
                <Icon name="bell" />{unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
              </Link>
              <Link href="/profile" className="pill">Profile</Link>
            </>
          ) : (
            <><Link href="/login">Log in</Link><Link href="/register" className="pill">Sign up</Link></>
          )}
        </nav>
      </header>
      {auth && me && !me.email_verified && (
        <div className="banner">
          <Icon name="mail" size={18} />
          <span><Link href="/verify-email">Verify your email</Link> to get order updates in your inbox.</span>
        </div>
      )}
    </>
  );
}
