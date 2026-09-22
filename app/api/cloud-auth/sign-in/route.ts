import { NextRequest, NextResponse } from "next/server";
import { CLOUD_COOKIE } from "@/lib/cloud-session";

const SB_URL = process.env.SUPABASE_URL?.trim()!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim()!;

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();

  if (!email || !code) {
    return NextResponse.json({ error: "Email and code required" }, { status: 400 });
  }

  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ email, token: code, type: "email" }),
  });

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(CLOUD_COOKIE, data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
