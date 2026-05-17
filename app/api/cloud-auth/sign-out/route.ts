import { NextResponse } from "next/server";
import { CLOUD_COOKIE } from "@/lib/cloud-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(CLOUD_COOKIE);
  return response;
}
