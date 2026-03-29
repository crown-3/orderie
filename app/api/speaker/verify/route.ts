// POST /api/speaker/verify
// Body: raw Float32Array PCM at 16 kHz (application/octet-stream)
// Returns { match: boolean, similarity: number }

import { NextRequest, NextResponse } from "next/server";
import { embed, cosSim } from "../_pipeline";
import { speakerStore } from "../_store";

const SIMILARITY_THRESHOLD = 0.75;

export async function POST(req: NextRequest) {
  try {
    if (!speakerStore.embedding) {
      // No speaker enrolled yet — let audio through
      return NextResponse.json({ match: true, similarity: 1 });
    }

    const buf = await req.arrayBuffer();
    if (buf.byteLength === 0) {
      return NextResponse.json({ error: "empty body" }, { status: 400 });
    }

    const samples = new Float32Array(buf);
    const embedding = await embed(samples);

    const similarity = cosSim(speakerStore.embedding, embedding);
    const match = similarity >= SIMILARITY_THRESHOLD;

    return NextResponse.json({ match, similarity });
  } catch (err) {
    console.error("[speaker/verify]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
