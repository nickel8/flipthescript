"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Supabase appends #access_token=... to whatever URL it redirects to after
// verifying a magic link. If the redirect_to lands here (e.g. the homepage
// root), this component picks it up, exchanges it for our session cookie,
// and forwards to the dashboard. It renders nothing visible.
export default function MagicLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    if (!access_token) return;

    // Clean the hash from the URL immediately so it isn't visible
    window.history.replaceState(null, "", window.location.pathname);

    fetch("/api/cloud-auth/set-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token }),
    }).then((res) => {
      router.replace(res.ok ? "/cloud/dashboard" : "/cloud/sign-in");
    });
  }, [router]);

  return null;
}
