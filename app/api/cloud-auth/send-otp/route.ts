import { NextRequest, NextResponse } from "next/server";

const SB_URL = process.env.SUPABASE_URL?.trim()!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim()!;

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // create_user: false — only existing accounts receive a code.
  // We surface rate-limit errors so the client can show a useful message,
  // but for all other outcomes we return { sent: true } to prevent email enumeration.
  const sbRes = await fetch(`${SB_URL}/auth/v1/otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({
      email,
      create_user: false,
      // Direct the magic link to our callback page so we can set the session cookie.
      // This URL must also be in Supabase → Auth → URL Configuration → Redirect URLs.
      redirect_to: "https://flip-the-script.app/auth/callback",
    }),
  });

  if (sbRes.status === 429) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute before trying again." },
      { status: 429 }
    );
  }

  return NextResponse.json({ sent: true });
}
