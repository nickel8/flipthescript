"use client";

import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/cloud-auth/sign-out", { method: "POST" });
    router.push("/cloud/sign-in");
  }

  return (
    <button
      onClick={signOut}
      className="text-xs font-bold uppercase tracking-widest opacity-40 hover:opacity-80 transition-opacity"
    >
      Sign out
    </button>
  );
}
