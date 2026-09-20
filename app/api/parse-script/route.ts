import { NextRequest, NextResponse } from "next/server";
import { getCloudSession } from "@/lib/cloud-session";
import { put } from "@vercel/blob";
import { parseScript } from "@/lib/script-parser";

export const maxDuration = 60; // allow up to 60s for large scripts

export async function POST(req: NextRequest) {
  const session = await getCloudSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("pdf") as File | null;

  if (!file || file.type !== "application/pdf") {
    return NextResponse.json({ error: "A PDF file is required" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();

  // Upload to Vercel Blob so the PDF can be viewed later
  const blob = await put(`scripts/${session.id}/${Date.now()}-${file.name}`, buffer, {
    access: "public",
    contentType: "application/pdf",
  });

  // Parse scenes from the PDF
  const scenes = await parseScript(buffer);

  if (scenes.length === 0) {
    return NextResponse.json(
      { error: "No scenes detected. Check that the PDF is a text-based screenplay." },
      { status: 422 }
    );
  }

  return NextResponse.json({
    blobUrl: blob.url,
    filename: file.name,
    pageCount: scenes[scenes.length - 1].pageStart,
    scenes,
  });
}
