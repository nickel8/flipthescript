import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";

const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function db(path: string, init?: RequestInit) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers as Record<string, string>),
    },
  });
}

// GET /api/sheet-notes?sheetId=xxx
export async function GET(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sheetId = req.nextUrl.searchParams.get("sheetId");
  if (!sheetId) return NextResponse.json({ error: "sheetId required" }, { status: 400 });

  const res = await db(
    `sheet_notes?sheet_id=eq.${sheetId}&order=created_at.asc&select=id,body,author_id,created_at`
  );
  const rows = await res.json();
  return NextResponse.json(Array.isArray(rows) ? rows : []);
}

// POST /api/sheet-notes — { sheetId, body }
export async function POST(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sheetId, body } = await req.json();
  if (!sheetId || !body?.trim()) {
    return NextResponse.json({ error: "sheetId and body required" }, { status: 400 });
  }

  const res = await db(`sheet_notes`, {
    method: "POST",
    body: JSON.stringify({ sheet_id: sheetId, body: body.trim(), author_id: session.id }),
  });
  if (!res.ok) return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  const [note] = await res.json();
  return NextResponse.json(note);
}

// DELETE /api/sheet-notes — { id }
export async function DELETE(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Only the author can delete their own note
  await db(
    `sheet_notes?id=eq.${id}&author_id=eq.${session.id}`,
    { method: "DELETE" }
  );
  return NextResponse.json({ ok: true });
}
