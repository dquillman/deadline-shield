"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Navbar() {
  const { user, loading } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  if (loading) return null; // Or a spinner

  return (
    <div style={{ display: "flex", gap: 16, padding: 16, borderBottom: "1px solid #ddd", alignItems: "center" }}>
      <Link href="/" style={{ fontWeight: 'bold' }}>Deadline Shield</Link>

      {user && (
        <>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/changes">Changes</Link>
        </>
      )}

      <div style={{ marginLeft: "auto" }}>
        {user ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: '0.9em', color: '#666' }}>{user.email}</span>
            <button onClick={handleLogout} style={{ padding: '6px 12px', cursor: 'pointer' }}>Sign out</button>
          </div>
        ) : (
          <Link href="/auth/login" style={{ padding: '6px 12px', background: '#0070f3', color: 'white', borderRadius: 4, textDecoration: 'none' }}>Login</Link>
        )}
      </div>
    </div>
  );
}
