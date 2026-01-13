"use client";

import { useEffect, useState } from "react";
import { finishMagicLink } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function FinishAuth() {
  const [status, setStatus] = useState("Finishing sign-in...");
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const ok = await finishMagicLink();
      setStatus(ok ? "Signed in! Redirecting..." : "This link is not valid on this device.");
      if (ok) router.push("/dashboard");
    })();
  }, [router]);

  return <p>{status}</p>;
}
