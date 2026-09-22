import { NextRequest, NextResponse } from "next/server";
import { CLOUD_COOKIE } from "@/lib/cloud-session";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Called by the /auth/callback client page after it extracts the access_token
// from the URL hash. We validate the token with Supabase before trusting it.
export async function POST(req: NextRequest) {
  const { access_token } = await req.json();
  if (!access_token) {
    return NextResponse.json({ error: "No token" }, { status: 400 });
  }

  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${access_token}` },
    cache: "no-store",
  });

  if (!userRes.ok) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(CLOUD_COOKIE, access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
