import { useRef, useState, useCallback, useEffect } from "react";
import { RealtimeAgent, RealtimeSession, OpenAIRealtimeWebRTC } from "@openai/agents-realtime";
import { instructions } from "./_menuData";
import { createOrderingTools } from "./_tools";
import { useSonioxSTT } from "./_useSonioxSTT";
import { useAudioLevel } from "./_useAudioLevel";
import { buildScreenStateXml, type ScreenSnapshot } from "./_screenState";
import { routeIntent } from "./_intentRouter";
import type { VoiceStatus, CartItem } from "./_types";

export type { VoiceStatus, CartItem };

const slog = (...args: unknown[]) => {
  try {
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args }),
    }).catch(() => {});
  } catch {}
};

export const useRealtimeVoice = () => {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [isListening, setIsListening] = useState(false);
  const [transcriptChunks, setTranscriptChunks] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [optionMenuId, setOptionMenuId] = useState<string | null>(null);
  const [optionSelection, setOptionSelection] = useState<string[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [isPaymentGuideVisible, setIsPaymentGuideVisible] = useState(false);

  const cartItemsRef = useRef<CartItem[]>([]);
  cartItemsRef.current = cartItems;

  const screenRef = useRef<ScreenSnapshot>({
    optionMenuId: null,
    optionSelection: [],
    cartItems: [],
    showCart: false,
    paymentGuideVisible: false,
    activeCategory: null,
  });
  screenRef.current = {
    optionMenuId,
    optionSelection,
    cartItems,
    showCart,
    paymentGuideVisible: isPaymentGuideVisible,
    activeCategory,
  };

  const agentRef = useRef<RealtimeAgent | null>(null);
  const sessionRef = useRef<RealtimeSession | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Set when Soniox fires <fin> for a Tier 1/2 utterance.
  // Checked in response.created to cancel the Realtime response and keep audio muted.
  const pendingCancelRef = useRef<string | null>(null);

  const { userTranscriptChunks, onSpeechStarted, setTranscriptEnabled, start: startSTT, stop: stopSTT } = useSonioxSTT();
  const { audioLevel, start: startAnalyser, stop: stopAnalyser } = useAudioLevel(cartItemsRef);

  useEffect(() => {
    if (agentRef.current) return;
    agentRef.current = new RealtimeAgent({
      name: "주문돌이",
      instructions,
      tools: createOrderingTools({
        cartItemsRef,
        screenRef,
        setCartItems,
        setActiveCategory,
        setOptionMenuId,
        setOptionSelection,
        setShowCart,
        setPaymentGuideVisible: setIsPaymentGuideVisible,
        slog,
      }),
      voice: "coral",
    });
  }, []);

  const cleanup = useCallback(() => {
    stopAnalyser();
    stopSTT();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    audioElRef.current?.remove();
    audioElRef.current = null;
    setIsListening(false);
  }, [stopAnalyser, stopSTT]);

  const speakBrowser = useCallback((text: string, onEnd?: () => void) => {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "ko-KR";
    if (onEnd) { utt.onend = onEnd; utt.onerror = onEnd; }
    window.speechSynthesis.speak(utt);
  }, []);

  const start = useCallback(async () => {
    if (!agentRef.current) return;
    slog("[session] start()");
    setStatus("connecting");

    try {
      const [sessionRes, sonioxRes] = await Promise.all([
        fetch("/api/session", { method: "POST" }),
        fetch("/api/soniox-token", { method: "POST" }),
      ]);
      const [sessionData, sonioxData] = await Promise.all([
        sessionRes.json(),
        sonioxRes.json(),
      ]);
      if (!sessionRes.ok) throw new Error(`Session API error ${sessionRes.status}: ${JSON.stringify(sessionData)}`);
      if (!sonioxRes.ok) throw new Error(`Soniox token error: ${JSON.stringify(sonioxData)}`);

      const ephemeralKey: string = sessionData.value;
      const sonioxKey: string = sonioxData.api_key;

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;

      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      document.body.appendChild(audioEl);
      audioElRef.current = audioEl;
      audioEl.addEventListener("pause", () => {
        if (sessionRef.current) audioEl.play().catch(() => {});
      });

      const transport = new OpenAIRealtimeWebRTC({ audioElement: audioEl });

      const session = new RealtimeSession(agentRef.current!, {
        transport,
        config: {
          providerData: { max_output_tokens: 800 },
          audio: {
            input: {
              turnDetection: {
                type: "server_vad",
                threshold: 0.65,
                prefix_padding_ms: 300,
                silence_duration_ms: 700,
              },
            },
          },
        },
      });
      sessionRef.current = session;

      session.transport.on("input_audio_buffer.speech_started", () => {
        setIsListening(true);
        onSpeechStarted();
      });
      session.transport.on("input_audio_buffer.speech_stopped", () => setIsListening(false));
      session.transport.on("audio_transcript_delta", (event: { delta: string }) => {
        setTranscriptChunks((prev) => [...prev, event.delta]);
      });

      session.transport.on("response.created", () => {
        setIsListening(false);
        setTranscriptChunks([]);
        if (pendingCancelRef.current !== null) {
          // Tier 1/2: cancel the Realtime response so it doesn't waste TPM.
          // Audio was already muted in onFinalTranscript.
          pendingCancelRef.current = null;
          try { sessionRef.current?.transport.sendEvent({ type: "response.cancel" }); } catch {}
        } else {
          // Tier 3 or initial greeting: ensure audio is unmuted and cancel any
          // in-flight browser TTS (e.g. if Tier 3 preempts a Tier 1/2 utterance).
          audioEl.muted = false;
          window.speechSynthesis.cancel();
        }
      });

      session.transport.on("response.done", (event: unknown) => {
        const resp = (event as { response?: { status?: string } })?.response;
        slog("[transport] response.done", resp?.status);
        // Do NOT mute here — response.done fires when generation ends,
        // but WebRTC audio is still playing from the buffer. Muting here cuts it off.
        if (resp?.status === "failed") {
          try { sessionRef.current?.transport.sendEvent({ type: "response.create" }); }
          catch {}
        }
      });

      session.transport.on("error", (e: unknown) => slog("[transport] error", e));
      session.transport.on("disconnected", () => {
        if (!sessionRef.current) return;
        sessionRef.current = null;
        cleanup();
        setStatus("error");
        setTranscriptChunks([]);
      });

      await session.connect({ apiKey: ephemeralKey });
      setStatus("connected");

      await startAnalyser(micStream);
      await startSTT(sonioxKey, micStream, {
        onFinalTranscript: (text) => {
          const { tier, quickReply } = routeIntent(text);
          slog("[tier]", tier, text);

          if (tier === 1) {
            // Mute Realtime audio immediately, then set cancel flag so response.created
            // can send response.cancel. Unmute only after browser TTS finishes.
            audioEl.muted = true;
            pendingCancelRef.current = quickReply!;
            speakBrowser(quickReply!, () => { audioEl.muted = false; });
          } else if (tier === 2) {
            audioEl.muted = true;
            pendingCancelRef.current = "tier2";
            const xml = buildScreenStateXml(screenRef.current);
            fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transcript: text, screenXml: xml }),
            })
              .then((r) => r.json())
              .then((data: { text: string }) => speakBrowser(data.text, () => { audioEl.muted = false; }))
              .catch(() => speakBrowser("죄송합니다, 잠시 후 다시 말씀해 주세요.", () => { audioEl.muted = false; }));
          }
          // Tier 3: let Realtime API handle it — pendingCancelRef stays null.
        },
      });

    } catch (err) {
      slog("[session] connection failed:", String(err));
      cleanup();
      sessionRef.current = null;
      setStatus("error");
    }
  }, [cleanup, onSpeechStarted, speakBrowser, startAnalyser, startSTT]);

  const stop = useCallback(() => {
    const s = sessionRef.current;
    sessionRef.current = null;
    s?.close();
    cleanup();
    setStatus("idle");
    setTranscriptChunks([]);
    setActiveCategory(null);
    setOptionMenuId(null);
    setOptionSelection([]);
    setCartItems([]);
    setShowCart(false);
    setIsPaymentGuideVisible(false);
    pendingCancelRef.current = null;
    window.speechSynthesis.cancel();
  }, [cleanup]);

  const mute = useCallback((muted: boolean) => {
    sessionRef.current?.mute(muted);
  }, []);

  const updateCartItem = useCallback((id: string, quantity: number) => {
    setCartItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.id !== id);
      const exists = prev.find((i) => i.id === id);
      if (exists) return prev.map((i) => (i.id === id ? { ...i, quantity } : i));
      return [...prev, { id, quantity, selectedOptions: undefined }];
    });
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setShowCart(false);
  }, []);

  const openOptions = useCallback((id: string, preset?: string[]) => {
    setOptionMenuId(id);
    setOptionSelection(preset ?? []);
  }, []);

  const closeOptions = useCallback(() => {
    setOptionMenuId(null);
    setOptionSelection([]);
  }, []);

  const addConfiguredItem = useCallback((id: string, options: string[], quantity = 1) => {
    setCartItems((prev) => {
      const exists = prev.find((i) => i.id === id);
      if (exists) {
        return prev.map((i) =>
          i.id === id ? { ...i, quantity: i.quantity + quantity, selectedOptions: options } : i,
        );
      }
      return [...prev, { id, quantity, selectedOptions: options }];
    });
    setOptionMenuId(null);
    setOptionSelection([]);
  }, []);

  const triggerOrderComplete = useCallback(() => {
    setCartItems([]);
    setIsPaymentGuideVisible(false);
    try {
      sessionRef.current?.transport.sendEvent({
        type: "response.create",
        response: {
          instructions:
            "주문이 완료되었습니다. 지금 바로 고객에게 진심 어린 감사 인사를 해주세요. 예: '주문해 주셔서 진심으로 감사합니다! 맛있게 드세요. 좋은 하루 되세요!'",
        },
      });
    } catch {}
  }, []);

  return {
    status, isListening, start, stop, mute, setTranscriptEnabled,
    audioLevel, transcriptChunks, userTranscriptChunks,
    activeCategory, setActiveCategory,
    optionMenuId, optionSelection, setOptionSelection, openOptions, closeOptions,
    cartItems, updateCartItem, addConfiguredItem, clearCart,
    showCart, setShowCart,
    isPaymentGuideVisible, setIsPaymentGuideVisible, triggerOrderComplete,
  };
};
