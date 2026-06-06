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

// Fire-and-forget server log — output appears in the Next.js terminal.
const slog = (...args: unknown[]) => {
  try {
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args }),
    }).catch(() => { });
  } catch { }
};

export const useRealtimeVoice = () => {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [isListening, setIsListening] = useState(false);
  const [transcriptChunks, setTranscriptChunks] = useState<string[]>([]);
  const [displayedMenuIds, setDisplayedMenuIds] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [optionMenuId, setOptionMenuId] = useState<string | null>(null);
  // Live, not-yet-confirmed option labels shown in the option modal. Updated by
  // both the AI (as it confirms each option) and manual chip taps.
  const [optionSelection, setOptionSelection] = useState<string[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  // Cart visibility is explicit — adding an item no longer forces the cart open.
  const [showCart, setShowCart] = useState(false);
  const [isPaymentGuideVisible, setIsPaymentGuideVisible] = useState(false);

  const cartItemsRef = useRef<CartItem[]>([]);
  cartItemsRef.current = cartItems;

  // Live snapshot of the whole screen, read on demand by the get_screen_state
  // tool. Kept fresh synchronously on every render so a tool call mid-turn
  // always sees the latest state (including manual taps).
  const screenRef = useRef<ScreenSnapshot>({
    optionMenuId: null,
    optionSelection: [],
    cartItems: [],
    showCart: false,
    paymentGuideVisible: false,
    activeCategory: null,
    displayedMenuIds: [],
  });
  screenRef.current = {
    optionMenuId,
    optionSelection,
    cartItems,
    showCart,
    paymentGuideVisible: isPaymentGuideVisible,
    activeCategory,
    displayedMenuIds,
  };

  const agentRef = useRef<RealtimeAgent | null>(null);
  const sessionRef = useRef<RealtimeSession | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const { userTranscriptChunks, onSpeechStarted, setTranscriptEnabled, start: startSTT, stop: stopSTT } = useSonioxSTT();

  // Stores a Tier-1 quick reply (or "tier2") while we wait for the Realtime
  // API's response.created event — at which point we cancel it and play our own TTS.
  const pendingCancelRef = useRef<string | null>(null);
  const { audioLevel, start: startAnalyser, stop: stopAnalyser } = useAudioLevel(cartItemsRef);

  // Create agent once on mount (after SSR — "use client" components still server-render).
  useEffect(() => {
    if (agentRef.current) return;
    agentRef.current = new RealtimeAgent({
      name: "주문돌이",
      instructions,
      tools: createOrderingTools({
        cartItemsRef,
        screenRef,
        setCartItems,
        setDisplayedMenuIds,
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

  const start = useCallback(async () => {
    if (!agentRef.current) return;
    slog("[session] start()");
    setStatus("connecting");

    try {
      // Fetch both tokens in parallel to reduce connection latency.
      const [sessionRes, sonioxRes] = await Promise.all([
        fetch("/api/session", { method: "POST" }),
        fetch("/api/soniox-token", { method: "POST" }),
      ]);
      const [sessionData, sonioxData] = await Promise.all([sessionRes.json(), sonioxRes.json()]);
      if (!sessionRes.ok) throw new Error(`Session API error ${sessionRes.status}: ${JSON.stringify(sessionData)}`);
      if (!sonioxRes.ok) throw new Error(`Soniox token error: ${JSON.stringify(sonioxData)}`);

      const ephemeralKey: string = sessionData.value;
      const sonioxKey: string = sonioxData.api_key;

      // Open one mic stream for the level analyser + Soniox STT. The Realtime
      // SDK opens its own mic track for the WebRTC peer connection.
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;

      // Append a real DOM audio element so mobile browsers honour autoplay reliably.
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      // Start muted — only unmuted when a Tier-3 or greeting response.created fires.
      // This prevents any Realtime audio from leaking during Tier 1/2 turns.
      audioEl.muted = true;
      document.body.appendChild(audioEl);
      audioElRef.current = audioEl;
      // Android Chrome can silently pause the audio element after a layout shift.
      audioEl.addEventListener("pause", () => {
        slog("[audio] element paused — attempting resume");
        if (sessionRef.current) audioEl.play().catch((err) => slog("[audio] resume failed:", String(err)));
      });

      const transport = new OpenAIRealtimeWebRTC({ audioElement: audioEl });

      const session = new RealtimeSession(agentRef.current!, {
        transport,
        config: {
          // Hard ceiling on output (text + audio) tokens per response. Spoken
          // replies should be 1–2 sentences anyway (see instructions.md); this
          // is a backstop against runaway monologues that burn TPM. Spread into
          // the wire session payload via providerData.
          providerData: { max_output_tokens: 1200 },
          audio: {
            input: {
              // Natural turn-taking: the AI responds when the user stops
              // speaking. A higher threshold ignores ambient noise so the
              // "listening" indicator only fires on real speech.
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

      const muteRealtime = () => { if (audioElRef.current) audioElRef.current.muted = true; };
      const unmuteRealtime = () => { if (audioElRef.current) audioElRef.current.muted = false; };

      // --- Transport event listeners ---
      session.transport.on("input_audio_buffer.speech_started", () => {
        slog("[transport] speech_started");
        setIsListening(true);
        onSpeechStarted();
      });
      session.transport.on("input_audio_buffer.speech_stopped", () => {
        slog("[transport] speech_stopped");
        setIsListening(false);
      });
      session.transport.on("input_audio_buffer.committed", () => slog("[transport] audio_buffer_committed"));
      session.transport.on("turn_started", () => slog("[transport] turn_started"));
      session.transport.on("audio_transcript_delta", (event: { delta: string }) => {
        setTranscriptChunks((prev) => [...prev, event.delta]);
      });
      session.transport.on("audio_transcript_done", () => slog("[transport] audio_transcript_done"));
      session.transport.on("audio_done", () => slog("[transport] audio_done"));
      session.transport.on("response.created", () => {
        slog("[transport] response.created — AI generating");
        setIsListening(false);
        setTranscriptChunks([]);
        if (pendingCancelRef.current !== null) {
          // Tier 1/2: cancel the Realtime response; audio stays muted.
          slog("[router] cancelling Realtime response for tier 1/2");
          pendingCancelRef.current = null;
          try { sessionRef.current?.transport.sendEvent({ type: "response.cancel" }); }
          catch (e) { slog("[router] cancel failed:", String(e)); }
        } else {
          // Tier 3 or initial greeting: unmute so the user can hear it.
          unmuteRealtime();
        }
      });
      session.transport.on("response.done", (event: unknown) => {
        const resp = (event as { response?: { status?: string; output?: unknown[]; status_details?: unknown } })?.response;
        slog("[transport] response.done", {
          status: resp?.status,
          outputCount: resp?.output?.length ?? 0,
          status_details: resp?.status_details,
        });
        // Re-arm mute so the next turn starts silent; response.created unmutes for Tier 3.
        muteRealtime();
        if (resp?.status === "failed") {
          slog("[transport] response failed — retrying");
          try { sessionRef.current?.transport.sendEvent({ type: "response.create" }); }
          catch (e) { slog("[transport] retry failed:", String(e)); }
        }
      });
      session.transport.on("response.cancelled", () => slog("[transport] response.cancelled"));
      session.transport.on("session.created", (e: unknown) => slog("[transport] session.created", e));
      session.transport.on("session.updated", (e: unknown) => slog("[transport] session.updated", e));
      session.transport.on("error", (e: unknown) => slog("[transport] error", e));
      // Detect silent WebRTC drops (network hiccup, mobile background, etc.)
      // stop() nulls sessionRef BEFORE calling close(), so this guard prevents
      // double-cleanup when the user manually stops the session.
      session.transport.on("disconnected", () => {
        slog("[transport] disconnected — session dropped");
        if (!sessionRef.current) return;
        sessionRef.current = null;
        cleanup();
        setStatus("error");
        setTranscriptChunks([]);
      });

      slog("[session] connecting...");
      await session.connect({ apiKey: ephemeralKey });
      slog("[session] connected");
      setStatus("connected");

      // Tier 1/2 TTS — plays pre-scripted or gpt-4o-mini reply via browser speech synthesis.
      // Audio stays muted (owned by response.created / response.done cycle).
      const speakBrowser = (text: string) => {
        if (typeof speechSynthesis === "undefined") return;
        speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = "ko-KR";
        speechSynthesis.speak(utt);
        setTranscriptChunks([text]);
      };

      await startAnalyser(micStream);
      await startSTT(sonioxKey, micStream, {
        // Audio is already muted by default. Just set pendingCancelRef so
        // response.created knows to cancel and stay muted for this turn.
        onFinalTranscript: (text) => {
          const { tier, quickReply } = routeIntent(text);
          slog("[router] tier:", tier, "text:", text);
          if (tier === 1) {
            pendingCancelRef.current = quickReply!;
            speakBrowser(quickReply!);
          } else if (tier === 2) {
            pendingCancelRef.current = "tier2";
            const screenXml = buildScreenStateXml(screenRef.current);
            fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transcript: text, screenXml }),
            })
              .then((r) => r.json() as Promise<{ text: string }>)
              .then(({ text: reply }) => speakBrowser(reply))
              .catch((e) => {
                slog("[tier2] fetch failed:", String(e));
                pendingCancelRef.current = null;
              });
          }
          // Tier 3: server_vad handles it — nothing to do here.
        },
      });

    } catch (err) {
      slog("[session] connection failed:", String(err));
      cleanup();
      sessionRef.current = null;
      setStatus("error");
    }
  }, [cleanup, onSpeechStarted, startAnalyser, startSTT]);

  const stop = useCallback(() => {
    slog("[session] stop()");
    // Null sessionRef BEFORE close() so the 'disconnected' handler skips its cleanup.
    const s = sessionRef.current;
    sessionRef.current = null;
    s?.close();
    cleanup();
    setStatus("idle");
    setTranscriptChunks([]);
    setDisplayedMenuIds([]);
    setActiveCategory(null);
    setOptionMenuId(null);
    setOptionSelection([]);
    setCartItems([]);
    setShowCart(false);
    setIsPaymentGuideVisible(false);
  }, [cleanup]);

  const mute = useCallback((muted: boolean) => {
    sessionRef.current?.mute(muted);
  }, []);

  const updateCartItem = useCallback((id: string, quantity: number) => {
    setCartItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.id !== id);
      const exists = prev.find((i) => i.id === id);
      if (exists) return prev.map((i) => i.id === id ? { ...i, quantity } : i);
      return [...prev, { id, quantity, selectedOptions: undefined }];
    });
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setShowCart(false);
  }, []);

  // Open the option modal for a menu, optionally pre-checking known options.
  const openOptions = useCallback((id: string, preset?: string[]) => {
    setOptionMenuId(id);
    setOptionSelection(preset ?? []);
  }, []);

  const closeOptions = useCallback(() => {
    setOptionMenuId(null);
    setOptionSelection([]);
  }, []);

  // Add a configured item (with its chosen options) to the cart, then close the
  // option modal. Adding does NOT switch to the cart view.
  const addConfiguredItem = useCallback((id: string, options: string[], quantity = 1) => {
    setCartItems((prev) => {
      const exists = prev.find((i) => i.id === id);
      if (exists) {
        return prev.map((i) =>
          i.id === id
            ? { ...i, quantity: i.quantity + quantity, selectedOptions: options }
            : i,
        );
      }
      return [...prev, { id, quantity, selectedOptions: options }];
    });
    setOptionMenuId(null);
    setOptionSelection([]);
  }, []);

  const triggerOrderComplete = useCallback(() => {
    slog("[session] triggerOrderComplete — clearing cart, triggering thank-you");
    setCartItems([]);
    setIsPaymentGuideVisible(false);
    try {
      sessionRef.current?.transport.sendEvent({
        type: "response.create",
        response: {
          instructions:
            "주문이 완료되었습니다. 지금 바로 고객에게 진심 어린 감사 인사를 해주세요. 반드시 말하세요. 예: '주문해 주셔서 진심으로 감사합니다! 맛있게 드세요. 좋은 하루 되세요!'",
        },
      });
    } catch (e) {
      slog("[session] triggerOrderComplete sendEvent failed:", String(e));
    }
  }, []);

  return {
    status, isListening, start, stop, mute, setTranscriptEnabled,
    audioLevel, transcriptChunks, userTranscriptChunks,
    displayedMenuIds, activeCategory, setActiveCategory,
    optionMenuId, optionSelection, setOptionSelection, openOptions, closeOptions,
    cartItems, updateCartItem, addConfiguredItem, clearCart,
    showCart, setShowCart,
    isPaymentGuideVisible, setIsPaymentGuideVisible, triggerOrderComplete,
  };
};
