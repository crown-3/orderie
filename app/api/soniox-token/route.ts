import { NextResponse } from "next/server";

export async function POST() {
  const apiKey = process.env.SONIOX_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "SONIOX_API_KEY not set" }, { status: 500 });
  }
  // Return the key from the server so it never appears in the client JS bundle.
  // The browser receives it per-request and uses it only for the WebSocket handshake.
  return NextResponse.json({ api_key: apiKey });
}
