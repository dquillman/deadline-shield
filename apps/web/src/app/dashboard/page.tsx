"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase.client";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";

type UserDoc = {
  email?: string;
  createdAt?: any;
  status?: "active" | "trialing" | "past_due" | "canceled" | "none";
  plan?: "solo" | "pro" | "team" | "none";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
};

export default function Dashboard() {
  const [uid, setUid] = useState<string | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUid(u?.uid ?? null);
      if (!u) {
        setUserDoc(null);
        return;
      }
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          email: u.email ?? "",
          createdAt: serverTimestamp(),
          status: "none",
          plan: "none"
        } satisfies UserDoc);
      }
      const snap2 = await getDoc(ref);
      setUserDoc(snap2.data() as UserDoc);
    });
  }, []);

  if (!uid) {
    return (
      <div>
        <h2>Dashboard</h2>
        <p>You’re not signed in.</p>
        <Link href="/auth">Sign in</Link>
      </div>
    );
  }

  const needsBilling = !userDoc || (userDoc.status !== "active" && userDoc.status !== "trialing");

  return (
    <div>
      <h2>Dashboard</h2>
      <p>
        <b>Status:</b> {userDoc?.status ?? "loading"} | <b>Plan:</b> {userDoc?.plan ?? "loading"}
      </p>

      {needsBilling ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <p>
            <b>Action needed:</b> Activate your subscription to enable reminders.
          </p>
          <Link href="/billing">Go to Billing</Link>
        </div>
      ) : (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <p>You’re active. Next step: we’ll add Entities + Tracks next.</p>
        </div>
      )}
    </div>
  );
}
