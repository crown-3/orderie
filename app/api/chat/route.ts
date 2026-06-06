import OpenAI from "openai";
import { NextRequest } from "next/server";
import { instructions } from "../../_hooks/useRealtimeVoice/_menuData";

const openai = new OpenAI();

export async function POST(req: NextRequest) {
  const { transcript, screenXml } = await req.json() as {
    transcript: string;
    screenXml?: string;
  };

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `${instructions}${screenXml ? `\n\n현재 화면 상태(XML):\n${screenXml}` : ""}`,
      },
      { role: "user", content: transcript },
    ],
    max_tokens: 120,
  });

  return Response.json({ text: completion.choices[0].message.content ?? "" });
}
