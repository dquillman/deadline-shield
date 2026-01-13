"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase.client";
import { onAuthStateChanged } from "firebase/auth";

export default function BillingPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
  }, []);

  async function startCheckout(plan: "solo" | "pro" | "team") {
    if (!uid) return;
    setLoading(true);

    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, uid })
    });

    const data = await res.json();
    if (data?.url) window.location.href = data.url;

    setLoading(false);
  }

  if (!uid) return <p>Please sign in first.</p>;

  return (
    <div>
      <h2>Billing</h2>
      <p>Start a 14-day trial (card required).</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button disabled={loading} onClick={() => startCheckout("solo")}>
          Solo $29/mo
        </button>
        <button disabled={loading} onClick={() => startCheckout("pro")}>
          Pro $59/mo
        </button>
        <button disabled={loading} onClick={() => startCheckout("team")}>
          Team $149/mo
        </button>
      </div>

      <p style={{ marginTop: 16, fontSize: 14 }}>
        After checkout, Stripe webhooks will mark your account active/trialing.
      </p>
    </div>
  );
}
