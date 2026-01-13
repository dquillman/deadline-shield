"use client";

import { useState } from "react";
import { loginWithGoogle, sendMagicLink } from "@/lib/auth";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div>
      <h2>Sign in</h2>

      <button onClick={loginWithGoogle} style={{ padding: 10 }}>
        Continue with Google
      </button>

      <hr style={{ margin: "20px 0" }} />

      <h3>Email magic link</h3>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        style={{ padding: 10, width: "100%", maxWidth: 360 }}
      />
      <div style={{ marginTop: 10 }}>
        <button
          onClick={async () => {
            await sendMagicLink(email);
            setSent(true);
          }}
          disabled={!email}
          style={{ padding: 10 }}
        >
          Send sign-in link
        </button>
      </div>

      {sent && <p>Check your inbox. Open the link on this device to finish sign-in.</p>}
    </div>
  );
}
