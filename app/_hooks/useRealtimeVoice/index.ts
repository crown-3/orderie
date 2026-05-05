import { useRef, useState, useCallback, useEffect } from "react";
import { RealtimeAgent, RealtimeSession, OpenAIRealtimeWebRTC } from "@openai/agents-realtime";
import { instructions } from "./_menuData";
import { createOrderingTools } from "./_tools";
import { useSonioxSTT } from "./_useSonioxSTT";
import { useAudioLevel } from "./_useAudioLevel";
import { useSpeakerGate } from "./_useSpeakerGate";
import type { VoiceStatus, CartItem } from "./_types";
import type { GateStatus } from "./_useSpeakerGate";

export type { VoiceStatus, CartItem, GateStatus };

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
  const [transcriptChunks, setTranscriptChunks] = useState<string[]>([]);
  const [displayedMenuIds, setDisplayedMenuIds] = useState<string[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isPaymentGuideVisible, setIsPaymentGuideVisible] = useState(false);
  const [presentationImage, setPresentationImage] = useState<string | null>(null);
  const [tpm, setTpm] = useState(0);

  const cartItemsRef = useRef<CartItem[]>([]);
  cartItemsRef.current = cartItems;
  const tokenWindowRef = useRef<Array<{ t: number; n: number }>>([]);

  const agentRef = useRef<RealtimeAgent | null>(null);
  const sessionRef = useRef<RealtimeSession | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const { userTranscriptChunks, onSpeechStarted, setTranscriptEnabled, start: startSTT, stop: stopSTT } = useSonioxSTT();
  const { audioLevel, start: startAnalyser, stop: stopAnalyser } = useAudioLevel(cartItemsRef);
  const { gateStatus, start: startGate, stop: stopGate } = useSpeakerGate();

  // Create agent once on mount (after SSR — "use client" components still server-render).
  useEffect(() => {
    if (agentRef.current) return;
    agentRef.current = new RealtimeAgent({
      name: "주문돌이",
      instructions,
      tools: createOrderingTools(
        cartItemsRef,
        setCartItems,
        setPresentationImage,
        slog,
      ),
      voice: "coral",
    });
  }, []);

  const cleanup = useCallback(() => {
    stopAnalyser();
    stopSTT();
    stopGate();
    audioElRef.current?.remove();
    audioElRef.current = null;
  }, [stopAnalyser, stopSTT, stopGate]);

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

      // Start the speaker gate: loads model, opens mic, returns gated stream.
      // This must happen before the WebRTC transport is created so we can
      // inject the gated track into the peer connection.
      slog("[gate] starting speaker gate");
      const gatedStream = await startGate();
      const gatedTrack = gatedStream.getAudioTracks()[0];
      slog("[gate] gated stream ready, enrolling speaker");

      // Append a real DOM audio element so mobile browsers honour autoplay reliably.
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      document.body.appendChild(audioEl);
      audioElRef.current = audioEl;
      // Android Chrome can silently pause the audio element after a layout shift.
      audioEl.addEventListener("pause", () => {
        slog("[audio] element paused — attempting resume");
        if (sessionRef.current) audioEl.play().catch((err) => slog("[audio] resume failed:", String(err)));
      });

      let resolveStream!: (s: MediaStream) => void;
      const streamPromise = new Promise<MediaStream>((r) => { resolveStream = r; });

      const transport = new OpenAIRealtimeWebRTC({
        audioElement: audioEl,
        changePeerConnection: (pc) => {
          // Intercept addTrack so the SDK's own getUserMedia track is replaced
          // with our speaker-gated track before it reaches the peer connection.
          const origAddTrack = pc.addTrack.bind(pc);
          (pc as unknown as Record<string, unknown>).addTrack = (
            track: MediaStreamTrack,
            ...streams: MediaStream[]
          ) => {
            if (track.kind === "audio") {
              slog("[gate] injecting gated audio track into PeerConnection");
              track.stop(); // discard the SDK's own mic track
              return origAddTrack(gatedTrack, gatedStream);
            }
            return origAddTrack(track, ...streams);
          };
          pc.addEventListener("track", (e) => { if (e.streams[0]) resolveStream(e.streams[0]); });
          return pc;
        },
      });

      const IS_PTT = process.env.NEXT_PUBLIC_INPUT_MODE === "ptt";
      const session = new RealtimeSession(agentRef.current!, {
        transport,
        config: {
          audio: {
            input: {
              turnDetection: IS_PTT ? null : { type: "server_vad", silence_duration_ms: 600 },
            },
          },
        },
      });
      sessionRef.current = session;

      // --- Transport event listeners ---
      session.transport.on("input_audio_buffer.speech_started", () => {
        slog("[transport] speech_started");
        onSpeechStarted();
      });
      session.transport.on("input_audio_buffer.speech_stopped", () => slog("[transport] speech_stopped"));
      session.transport.on("input_audio_buffer.committed", () => slog("[transport] audio_buffer_committed"));
      session.transport.on("turn_started", () => slog("[transport] turn_started"));
      session.transport.on("audio_transcript_delta", (event: { delta: string }) => {
        slog("[transport] audio_transcript_delta", event.delta.slice(0, 30));
        setTranscriptChunks((prev) => [...prev, event.delta]);
      });
      session.transport.on("audio_transcript_done", () => slog("[transport] audio_transcript_done"));
      session.transport.on("audio_done", () => slog("[transport] audio_done"));
      session.transport.on("response.created", () => {
        slog("[transport] response.created — AI generating");
        setTranscriptChunks([]);
      });
      session.transport.on("response.done", (event: unknown) => {
        type Usage = { input_tokens?: number; output_tokens?: number; input_token_details?: { cached_tokens?: number } };
        const resp = (event as { response?: { status?: string; output?: unknown[]; status_details?: unknown; usage?: Usage } })?.response;
        const usage = resp?.usage;
        const inputTokens = usage?.input_tokens ?? 0;
        const outputTokens = usage?.output_tokens ?? 0;
        const cachedTokens = usage?.input_token_details?.cached_tokens ?? 0;
        slog("[transport] response.done", {
          status: resp?.status,
          outputCount: resp?.output?.length ?? 0,
          outputTypes: resp?.output?.map((o: unknown) => (o as { type?: string })?.type),
          status_details: resp?.status_details,
          tokens: { input: inputTokens, output: outputTokens, cached: cachedTokens },
        });
        const tokens = inputTokens + outputTokens;
        if (tokens > 0) {
          const now = Date.now();
          tokenWindowRef.current = tokenWindowRef.current.filter((e) => e.t > now - 60_000);
          tokenWindowRef.current.push({ t: now, n: tokens });
          setTpm(tokenWindowRef.current.reduce((s, e) => s + e.n, 0));
        }
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

      const stream = await streamPromise;
      await startAnalyser(stream);
      await startSTT(sonioxKey, gatedStream);

    } catch (err) {
      slog("[session] connection failed:", String(err));
      cleanup();
      sessionRef.current = null;
      setStatus("error");
    }
  }, [cleanup, onSpeechStarted, startAnalyser, startSTT, startGate]);

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
    setCartItems([]);
    setIsPaymentGuideVisible(false);
    setPresentationImage(null);
    tokenWindowRef.current = [];
    setTpm(0);
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

  const commitSpeech = useCallback(() => {
    if (!sessionRef.current) return;
    slog("[session] commitSpeech — manual turn end");
    try {
      sessionRef.current.transport.sendEvent({ type: "input_audio_buffer.commit" });
      sessionRef.current.transport.sendEvent({ type: "response.create" });
    } catch (e) {
      slog("[session] commitSpeech failed:", String(e));
    }
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
    status, start, stop, mute, commitSpeech, setTranscriptEnabled,
    audioLevel, transcriptChunks, userTranscriptChunks,
    displayedMenuIds, cartItems, updateCartItem,
    isPaymentGuideVisible, triggerOrderComplete, tpm,
    gateStatus, presentationImage, setPresentationImage,
  };
};
