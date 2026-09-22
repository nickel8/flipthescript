"use client";

import { useState, FormEvent, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Step = "email" | "code";

export default function CloudSignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  // Focus the code input when we reach step two
  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    await fetch("/api/cloud-auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    // Always advance — response is always { sent: true } regardless of
    // whether the email has an account (prevents enumeration).
    setLoading(false);
    setStep("code");
  }

  async function handleVerifyCode(e?: FormEvent) {
    e?.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/cloud-auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Invalid or expired code");
      setCode("");
      codeRef.current?.focus();
      return;
    }

    router.push("/cloud/dashboard");
  }

  async function handleResend() {
    setResent(false);
    setError("");
    setCode("");
    await fetch("/api/cloud-auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResent(true);
    codeRef.current?.focus();
  }

  function handleCodeChange(value: string) {
    // Digits only, max 6
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6) {
      // Auto-submit once all six digits are entered
      setTimeout(() => handleVerifyCode(), 0);
    }
  }

  if (step === "email") {
    return (
      <div className="max-w-sm mx-auto py-24 px-6">
        <h1 className="text-2xl font-bold mb-2">Sign in</h1>
        <p className="text-sm opacity-50 mb-8">
          We&apos;ll email you a six-digit code.
        </p>

        <form onSubmit={handleSendCode} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              className="w-full border border-black px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-black text-white text-sm font-bold px-4 py-2.5 hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {loading ? "Sending…" : "Send code"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto py-24 px-6">
      <h1 className="text-2xl font-bold mb-2">Check your email</h1>
      <p className="text-sm opacity-50 mb-8">
        We sent a sign-in link to <span className="font-mono">{email}</span>.
        Click it to sign in — no password needed.
      </p>

      {resent && !error && (
        <p className="text-sm text-green-700 mb-6">New link sent.</p>
      )}
      {error && <p className="text-sm text-red-600 mb-6">{error}</p>}

      <div className="flex gap-4 text-xs opacity-50 mb-10">
        <button onClick={handleResend} className="hover:opacity-100 transition-opacity">
          Resend link
        </button>
        <span>·</span>
        <button
          onClick={() => { setStep("email"); setCode(""); setError(""); }}
          className="hover:opacity-100 transition-opacity"
        >
          Use a different email
        </button>
      </div>

      {/* Code entry as a fallback — hidden until the user wants it */}
      <details className="text-xs opacity-40 hover:opacity-60 transition-opacity">
        <summary className="cursor-pointer select-none">Enter a code instead</summary>
        <form onSubmit={handleVerifyCode} className="flex flex-col gap-3 mt-4">
          <input
            ref={codeRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            maxLength={6}
            placeholder="000000"
            className="w-full border border-black/40 px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:border-black opacity-100"
          />
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="bg-black text-white text-xs font-bold uppercase tracking-widest px-4 py-2 hover:opacity-80 disabled:opacity-40 transition-opacity opacity-100"
          >
            {loading ? "Verifying…" : "Sign in with code"}
          </button>
        </form>
      </details>
    </div>
  );
}
