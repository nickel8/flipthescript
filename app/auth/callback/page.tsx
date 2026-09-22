"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Supabase appends the session to the URL hash after verifying a magic link:
// https://yoursite.com/auth/callback#access_token=xxx&refresh_token=xxx&...
//
// The hash is only readable client-side, so this must be a client component.
// We extract the token, validate it server-side, set our httpOnly cookie,
// then redirect to the dashboard.

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.slice(1); // strip leading #
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const error_description = params.get("error_description");

    if (error_description) {
      router.replace(`/cloud/sign-in?error=${encodeURIComponent(error_description)}`);
      return;
    }

    if (!access_token) {
      router.replace("/cloud/sign-in");
      return;
    }

    fetch("/api/cloud-auth/set-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token }),
    }).then((res) => {
      if (res.ok) {
        router.replace("/cloud/dashboard");
      } else {
        router.replace("/cloud/sign-in");
      }
    });
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-sm opacity-30">Signing you in…</p>
    </div>
  );
}
