import { useEffect, useState } from "react";
import Landing from "../components/Landing";
import Menu from "../components/Menu";
import { getAuth } from "../lib/api";

// Visitors who aren't logged in see the landing page. Logged-in people go straight to the menu.
export default function Index() {
  const [view, setView] = useState("loading");
  useEffect(() => { setView(getAuth() ? "menu" : "landing"); }, []);
  if (view === "loading") return <div className="page-loading" aria-busy="true" />;
  return view === "menu" ? <Menu /> : <Landing />;
}