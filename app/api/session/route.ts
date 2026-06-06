import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI();

export async function POST() {
  try {
    const session = await openai.realtime.clientSecrets.create({
      session: {
        type: "realtime",
        model: "gpt-realtime-mini",
      },
    });
    return NextResponse.json(session);
  } catch (err) {
    console.error("Failed to create realtime client secret:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
