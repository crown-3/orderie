// POST /api/speaker/enroll
// Body: raw Float32Array PCM at 16 kHz (application/octet-stream)
// Extracts a speaker embedding and stores it for subsequent /verify calls.

import { NextRequest, NextResponse } from "next/server";
import { embed } from "../_pipeline";
import { speakerStore } from "../_store";

export async function POST(req: NextRequest) {
  try {
    const buf = await req.arrayBuffer();
    if (buf.byteLength === 0) {
      return NextResponse.json({ error: "empty body" }, { status: 400 });
    }

    const samples = new Float32Array(buf);
    const embedding = await embed(samples);

    speakerStore.embedding = embedding;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[speaker/enroll]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
