import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { args } = await req.json();
  console.log("[CLIENT]", ...args);
  return NextResponse.json({ ok: true });
}
