import { useRouter } from "next/router";
import BackgroundArt from "../components/BackgroundArt";
import Footer from "../components/Footer";
import Nav from "../components/Nav";
import "../styles/globals.css";

// Pages that don't show the footer.
const NO_FOOTER = ["/login", "/register", "/forgot-password", "/verify-email"];

export default function App({ Component, pageProps }) {
  const { pathname } = useRouter();
  return (
    <>
      <BackgroundArt />
      <div className="app-shell">
        <Nav />
        <main><Component {...pageProps} /></main>
        {!NO_FOOTER.includes(pathname) && <Footer />}
      </div>
    </>
  );
}