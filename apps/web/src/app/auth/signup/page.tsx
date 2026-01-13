"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserProfile } from "@/lib/types";

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [org, setOrg] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Create User Profile per MVP spec
            const profile: UserProfile = {
                uid: user.uid,
                email: user.email,
                organization: org,
                plan: "Starter", // Default to Starter
            };

            await setDoc(doc(db, "users", user.uid), profile);

            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div style={{ maxWidth: 400, margin: "40px auto" }}>
            <h2>Sign up for Deadline-Shield</h2>
            {error && <p style={{ color: "red" }}>{error}</p>}
            <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                    type="text"
                    placeholder="Organization Name"
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                    required
                    style={{ padding: 8 }}
                />
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ padding: 8 }}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ padding: 8 }}
                />
                <button type="submit" style={{ padding: 10, background: "#0070f3", color: "white", border: "none" }}>
                    Sign Up
                </button>
            </form>
            <p style={{ marginTop: 20 }}>
                Already have an account? <Link href="/auth/login">Login</Link>
            </p>
        </div>
    );
}
