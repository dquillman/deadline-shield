"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase.client";
import { onAuthStateChanged } from "firebase/auth";
import { logout } from "@/lib/auth";

export default function Navbar() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setEmail(u?.email ?? null));
  }, []);

  return (
    <div style={{ display: "flex", gap: 16, padding: 16, borderBottom: "1px solid #ddd" }}>
      <Link href="/">Deadline Shield</Link>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/billing">Billing</Link>
      <div style={{ marginLeft: "auto" }}>
        {email ? (
          <button onClick={logout}>Sign out ({email})</button>
        ) : (
          <Link href="/auth">Sign in</Link>
        )}
      </div>
    </div>
  );
}
