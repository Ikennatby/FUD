import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api, naira } from "../../lib/api";

export default function Verify() {
  const { query, isReady } = useRouter();
  const ref = query.reference || query.trxref || "";
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isReady) return;
    if (!ref) { setError("No payment reference found."); return; }
    api(`/orders/verify/?reference=${encodeURIComponent(ref)}`).then(setOrder).catch((e) => setError(e.message));
  }, [isReady, ref]);

  if (error) return <section><h1>Something went wrong</h1><p className="error">{error}</p><p><Link href="/orders">Go to My orders</Link></p></section>;
  if (!order) return <p>Checking your payment…</p>;
  return (
    <section>
      <h1>{order.paid ? "Payment received" : "Payment not confirmed yet"}</h1>
      <p>{order.stall}: {naira(order.total)}</p>
      {order.paid
        ? <p><Link href="/orders">Track your order</Link></p>
        : <><p className="note">{order.payment}</p><p>You can retry or re-check from <Link href="/orders">My orders</Link>.</p></>}
    </section>
  );
}
