import { useRef, useState, useCallback } from "react";
import { RealtimeAgent, RealtimeSession, OpenAIRealtimeWebRTC } from "@openai/agents-realtime";
import { tool } from "@openai/agents";
import { z } from "zod";
import instructionsMd from "@/assets/instructions.md";
import menusJson from "@/assets/menus.json";

export type VoiceStatus = "idle" | "connecting" | "connected" | "error";
export type CartItem = { id: string; quantity: number };

const instructions = `${instructionsMd}

---
## 메뉴 정보 (JSON)
${JSON.stringify(menusJson, null, 2)}
`;

// Module-level setter references so tool execute functions can update React state
// without needing to recreate the agent on every render.
let _setDisplayedMenuIds: ((ids: string[]) => void) | null = null;
let _setCartItems: ((items: CartItem[]) => void) | null = null;
let _cartItemsRef: { current: CartItem[] } | null = null;

const setDisplayedMenusTool = tool({
  name: "set_displayed_menus",
  description:
    "사용자가 메뉴를 언급하거나, 물어보거나, 추천을 요청할 때마다 반드시 호출하세요. 화면에 해당 메뉴 카드를 표시합니다. 메뉴 관련 답변을 하기 전에 이 도구를 먼저 호출해야 합니다. 관심 메뉴가 없어지면 빈 배열로 호출하세요.",
  parameters: z.object({
    menu_ids: z
      .array(z.string())
      .describe("표시할 메뉴 ID 배열 (예: [\"b01\", \"s01\"]). 없애려면 []"),
  }),
  execute: async ({ menu_ids }) => {
    _setDisplayedMenuIds?.(menu_ids);
    return "displayed";
  },
});

const updateCartItemTool = tool({
  name: "update_cart_item",
  description:
    "사용자가 메뉴를 주문 확정하거나 장바구니에서 빼고 싶을 때 호출합니다. quantity=0이면 해당 메뉴를 장바구니에서 제거합니다. 주문 확정 시 set_displayed_menus([])도 함께 호출하세요.",
  parameters: z.object({
    menu_id: z.string().describe("메뉴 ID"),
    quantity: z.number().int().min(0).describe("수량. 0이면 장바구니에서 제거."),
  }),
  execute: async ({ menu_id, quantity }) => {
    const prev = _cartItemsRef?.current ?? [];
    let next: CartItem[];
    if (quantity <= 0) {
      next = prev.filter((i) => i.id !== menu_id);
    } else {
      const exists = prev.find((i) => i.id === menu_id);
      if (exists) {
        next = prev.map((i) => i.id === menu_id ? { ...i, quantity } : i);
      } else {
        next = [...prev, { id: menu_id, quantity }];
      }
    }
    _setCartItems?.(next);
    return "cart_updated";
  },
});

const agent = new RealtimeAgent({
  name: "주문돌이",
  instructions,
  tools: [setDisplayedMenusTool, updateCartItemTool],
  voice: "coral"
});

export const useRealtimeVoice = () => {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcriptChunks, setTranscriptChunks] = useState<string[]>([]);
  const [userTranscriptChunks, setUserTranscriptChunks] = useState<string[]>([]);
  const [displayedMenuIds, setDisplayedMenuIds] = useState<string[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const cartItemsRef = useRef<CartItem[]>([]);
  cartItemsRef.current = cartItems;

  // Keep module-level references up to date
  _setDisplayedMenuIds = setDisplayedMenuIds;
  _setCartItems = setCartItems;
  _cartItemsRef = cartItemsRef;

  const sessionRef = useRef<RealtimeSession | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);

  const start = useCallback(async () => {
    setStatus("connecting");
    try {
      const res = await fetch("/api/session", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(`Session API error ${res.status}: ${JSON.stringify(data)}`);
      }
      const ephemeralKey: string = data.value;

      // Intercept the RTCPeerConnection to capture the remote audio stream
      // for Web Audio analysis. WebRTC still handles playback natively.
      let resolveStream!: (s: MediaStream) => void;
      const streamPromise = new Promise<MediaStream>((r) => { resolveStream = r; });

      const transport = new OpenAIRealtimeWebRTC({
        changePeerConnection: (pc) => {
          pc.addEventListener("track", (event) => {
            if (event.streams[0]) resolveStream(event.streams[0]);
          });
          return pc;
        },
      });

      const session = new RealtimeSession(agent, {
        transport,
        config: {
          audio: {
            input: {
              turnDetection: {
                type: "semantic_vad",
                eagerness: "low",
              },
            },
          },
        },
      });
      sessionRef.current = session;

      await session.connect({ apiKey: ephemeralKey });
      setStatus("connected");

      // AI transcript
      session.transport.on("turn_started", () => {
        setTranscriptChunks([]);
      });
      session.transport.on("audio_transcript_delta", (event: { delta: string }) => {
        setTranscriptChunks((prev) => [...prev, event.delta]);
      });

      // User transcript
      session.transport.on("input_audio_buffer.speech_started", () => {
        setUserTranscriptChunks([]);
      });
      session.transport.on("conversation.item.input_audio_transcription.delta", (event: { delta: string }) => {
        setUserTranscriptChunks((prev) => [...prev, event.delta]);
      });

      const stream = await streamPromise;

      const ctx = new AudioContext();
      await ctx.resume();
      audioCtxRef.current = ctx;

      // createMediaStreamSource analyses audio without affecting native WebRTC playback.
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) {
          const n = (v - 128) / 128;
          sum += n * n;
        }
        const rms = Math.sqrt(sum / buf.length);
        setAudioLevel(Math.min(1, rms * 8));
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      console.error("Realtime voice connection failed:", err);
      sessionRef.current = null;
      setStatus("error");
    }
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
    setAudioLevel(0);
    setTranscriptChunks([]);
    setUserTranscriptChunks([]);
    setDisplayedMenuIds([]);
    setCartItems([]);
    setStatus("idle");
  }, []);

  const mute = useCallback((muted: boolean) => {
    sessionRef.current?.mute(muted);
  }, []);

  const updateCartItem = useCallback((id: string, quantity: number) => {
    setCartItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.id !== id);
      const exists = prev.find((i) => i.id === id);
      if (exists) return prev.map((i) => i.id === id ? { ...i, quantity } : i);
      return [...prev, { id, quantity }];
    });
  }, []);

  return { status, start, stop, mute, audioLevel, transcriptChunks, userTranscriptChunks, displayedMenuIds, cartItems, updateCartItem };
};
