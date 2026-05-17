import { NextRequest, NextResponse } from "next/server";
import { CLOUD_COOKIE } from "@/lib/cloud-session";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!SUPABASE_URL || !ANON_KEY) {
      return NextResponse.json(
        { error: `Missing env: SUPABASE_URL=${!!SUPABASE_URL} SUPABASE_ANON_KEY=${!!ANON_KEY}` },
        { status: 500 }
      );
    }

    const { email, password } = await req.json();

    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok || !data.access_token) {
      const msg = data.error_description || data.message || "Sign in failed";
      return NextResponse.json({ error: msg }, { status: 401 });
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
