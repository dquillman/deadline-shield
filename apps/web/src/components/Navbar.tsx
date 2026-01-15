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
    <div className="flex gap-4 p-4 border-b border-slate-200 dark:border-slate-800 items-center bg-white dark:bg-slate-950">
      <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        <img src="/logo.png" alt="Deadline Shield Logo" className="w-8 h-8" />
        Deadline Shield
      </Link>

      {user && (
        <>
          <Link href="/dashboard" className="text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Dashboard</Link>
          <Link href="/changes" className="text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Changes</Link>
        </>
      )}

      <div className="ml-auto">
        {user ? (
          <div className="flex gap-2.5 items-center">
            <span className="text-sm text-slate-500 dark:text-slate-400">{user.email}</span>
            <button onClick={handleLogout} className="px-3 py-1.5 cursor-pointer bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded transition-colors border border-slate-200 dark:border-slate-700">Sign out</button>
          </div>
        ) : (
          <Link href="/auth/login" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded no-underline inline-block transition-colors">Login</Link>
        )}
      </div>
    </div>
  );
}
