import { NextRequest, NextResponse } from "next/server";

const SB_URL = process.env.SUPABASE_URL?.trim()!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim()!;

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // create_user: false — only existing accounts receive a code.
  // We call this regardless and always return { sent: true } so the response
  // cannot be used to discover whether an email address has an account.
  await fetch(`${SB_URL}/auth/v1/otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ email, create_user: false }),
  });

  return NextResponse.json({ sent: true });
}
