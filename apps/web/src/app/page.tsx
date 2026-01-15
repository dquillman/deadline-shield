import Link from "next/link";
import Disclaimer from "@/components/Disclaimer";

export default function Home() {
  return (
    <div style={{ textAlign: "center", marginTop: 50 }}>
      <h1>Deadline-Shield</h1>
      <p style={{ fontSize: "1.25em", color: "#333", maxWidth: 600, margin: "20px auto", fontWeight: 500 }}>
        Deadline Shield watches important pages, detects meaningful changes, and tells you what to do — so you don’t miss critical deadlines.
      </p>

      <div style={{ marginTop: 40, display: "flex", gap: 20, justifyContent: "center" }}>
        <Link href="/auth/login" style={{ padding: "12px 24px", background: "#0070f3", color: "white", borderRadius: 4, textDecoration: "none" }}>
          Login
        </Link>
        <Link href="/auth/signup" style={{ padding: "12px 24px", background: "#f5f5f5", color: "#333", borderRadius: 4, textDecoration: "none" }}>
          Sign Up
        </Link>
      </div>

      <div style={{ marginTop: 60, textAlign: 'left', maxWidth: 600, margin: '60px auto 0' }}>
        <h3>Features</h3>
        <ul>
          <li>Monitor official authority pages automatically.</li>
          <li>Receive email alerts when content changes.</li>
          <li>Track history of changes for compliance auditing.</li>
        </ul>
      </div>

      <Disclaimer />
    </div>
  );
}
