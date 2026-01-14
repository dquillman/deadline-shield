"use client";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.push("/dashboard");
        } catch (err: any) {
            // Map Firebase error codes to user-friendly messages
            const code = err.code || '';
            if (code === 'auth/user-not-found') {
                setError('No account found with this email. Please sign up first.');
            } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                setError('Incorrect password. Please try again.');
            } else if (code === 'auth/invalid-email') {
                setError('Invalid email address.');
            } else if (code === 'auth/too-many-requests') {
                setError('Too many failed attempts. Please try again later.');
            } else {
                setError(err.message || 'Login failed. Please try again.');
            }
        }
    };

    return (
        <div style={{ maxWidth: 400, margin: "40px auto" }}>
            <h2>Login to Deadline-Shield</h2>
            {error && <p style={{ color: "red" }}>{error}</p>}
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    style={{ padding: 8 }}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    style={{ padding: 8 }}
                />
                <button type="submit" style={{ padding: 10, background: "#0070f3", color: "white", border: "none" }}>
                    Login
                </button>
            </form>
            <p style={{ marginTop: 20 }}>
                Don't have an account? <Link href="/auth/signup">Sign up</Link>
            </p>
        </div>
    );
}
