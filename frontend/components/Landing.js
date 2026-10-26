import Link from "next/link";
import { Burger, Groceries, Plate, Scooter } from "./Art";
import Logo from "./Logo";

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-top">
        <Link href="/login" className="btn landing-login">Log in / Sign up</Link>
        <Link href="/" className="brand landing-brand" aria-label="FÜD home"><Logo /></Link>
      </header>

      <section className="landing-hero">
        <div className="landing-burger"><Burger className="landing-burger-art" /></div>
        <div className="landing-copy">
          <h1 className="landing-title">Food Delivery <span>And Lots More</span></h1>
          <p className="landing-tag"><strong>One click away</strong></p>
        </div>
      </section>

      <section className="landing-anything">
        <h2>Anything Delivered</h2>
        <ul className="landing-cards">
          <li><Plate decorative /><strong>Your campus top restaurants</strong></li>
          <li><Scooter decorative /><strong>Faster Delivery</strong></li>
          <li><Groceries decorative /><strong>Groceries delivery</strong></li>
        </ul>
        <Link href="/register" className="btn big">Explore restaurants and supermarkets</Link>
        <p className="muted">Already have an account? <Link href="/login">Log in</Link></p>
      </section>
    </div>
  );
}