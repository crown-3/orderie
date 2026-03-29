import { useState, useRef, useCallback } from "react";

// Set to false to bypass all speaker gating (raw mic passes straight through).
const VOICE_GATE_ENABLED = false;

const ENROLL_SECONDS = 4;    // seconds of first-speaker audio to enroll
const WINDOW_SECONDS = 1.5;  // sliding window sent to /verify
const TARGET_SR = 16000;     // WavLM expects 16 kHz

export type GateStatus = "idle" | "enrolling" | "active";

// Resample Float32Array from sourceSR → 16 kHz via OfflineAudioContext.
// Runs client-side so only the smaller 16 kHz payload is sent over the wire.
async function resampleTo16k(samples: Float32Array, sourceSR: number): Promise<Float32Array> {
  if (sourceSR === TARGET_SR) return samples;
  const length = Math.ceil(samples.length * TARGET_SR / sourceSR);
  const offCtx = new OfflineAudioContext(1, length, TARGET_SR);
  const buf = offCtx.createBuffer(1, samples.length, sourceSR);
  buf.copyToChannel(samples, 0);
  const src = offCtx.createBufferSource();
  src.buffer = buf;
  src.connect(offCtx.destination);
  src.start();
  const rendered = await offCtx.startRendering();
  return rendered.getChannelData(0);
}

function mergeChunks(chunks: Float32Array[], total: number): Float32Array {
  const out = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

// Send raw PCM Float32Array to a server route as application/octet-stream.
async function postPCM(url: string, samples: Float32Array): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: samples.buffer,
  });
}

export function useSpeakerGate() {
  const [gateStatus, setGateStatus] = useState<GateStatus>("idle");

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);

  const enrollChunksRef = useRef<Float32Array[]>([]);
  const windowChunksRef = useRef<Float32Array[]>([]);
  const enrollSamplesRef = useRef(0);
  const enrollDoneRef = useRef(false);
  const inferringRef = useRef(false);

  /**
   * Opens the microphone, wires up the audio gate, and returns a gated
   * MediaStream for use by Soniox and OpenAI WebRTC.
   *
   * Phase 1 — "enrolling": first ENROLL_SECONDS pass through at full volume
   *   while PCM is buffered and sent to /api/speaker/enroll.
   * Phase 2 — "active": every WINDOW_SECONDS the gate opens (gain=1) or
   *   closes (gain=0) based on /api/speaker/verify similarity score.
   */
  const start = useCallback(async (): Promise<MediaStream> => {
    const rawStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    // ── Bypass mode ───────────────────────────────────────────────────────
    if (!VOICE_GATE_ENABLED) {
      rawStreamRef.current = rawStream;
      setGateStatus("active");
      return rawStream;
    }
    // ─────────────────────────────────────────────────────────────────────
    rawStreamRef.current = rawStream;

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const sr = ctx.sampleRate;
    const enrollTarget = ENROLL_SECONDS * sr;
    const windowTarget = WINDOW_SECONDS * sr;

    const source = ctx.createMediaStreamSource(rawStream);

    // Gate node — toggled by server verify responses
    const gain = ctx.createGain();
    gain.gain.value = 1.0;  // open during enrollment
    gainRef.current = gain;

    const dest = ctx.createMediaStreamDestination();

    // ScriptProcessorNode captures PCM chunks for server-side inference.
    // (Deprecated but universally supported; AudioWorklet would need a
    //  separate worker file registered via next.config.ts public assets.)
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    enrollChunksRef.current = [];
    windowChunksRef.current = [];
    enrollSamplesRef.current = 0;
    enrollDoneRef.current = false;
    inferringRef.current = false;

    processor.onaudioprocess = (e) => {
      const chunk = new Float32Array(e.inputBuffer.getChannelData(0));

      if (!enrollDoneRef.current) {
        // ── Enrollment phase ──────────────────────────────────────────────
        enrollChunksRef.current.push(chunk);
        enrollSamplesRef.current += chunk.length;

        if (enrollSamplesRef.current >= enrollTarget) {
          enrollDoneRef.current = true;
          const merged = mergeChunks(enrollChunksRef.current, enrollSamplesRef.current);
          enrollChunksRef.current = [];

          resampleTo16k(merged, sr)
            .then((resampled) => postPCM("/api/speaker/enroll", resampled))
            .then((res) => {
              if (res.ok) setGateStatus("active");
              else console.error("[gate] enroll failed", res.status);
            })
            .catch(console.error);
        }
      } else {
        // ── Active gating phase ───────────────────────────────────────────
        windowChunksRef.current.push(chunk);
        const total = windowChunksRef.current.reduce((s, c) => s + c.length, 0);

        if (total >= windowTarget && !inferringRef.current) {
          inferringRef.current = true;
          const window = mergeChunks(windowChunksRef.current, total);
          windowChunksRef.current = [];

          resampleTo16k(window, sr)
            .then((resampled) => postPCM("/api/speaker/verify", resampled))
            .then((res) => res.json())
            .then(({ match }: { match: boolean }) => {
              // Smooth 50 ms transition to avoid audio clicks
              gain.gain.setTargetAtTime(match ? 1.0 : 0.0, ctx.currentTime, 0.05);
            })
            .catch(console.error)
            .finally(() => { inferringRef.current = false; });
        }
      }
    };

    // Processor must sit in the graph to fire; route its output to silence
    // to prevent mic feedback.
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(ctx.destination);

    // Main signal path: mic → gate → output stream
    source.connect(gain);
    gain.connect(dest);

    setGateStatus("enrolling");
    return dest.stream;
  }, []);

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    gainRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    rawStreamRef.current = null;
    enrollChunksRef.current = [];
    windowChunksRef.current = [];
    enrollSamplesRef.current = 0;
    enrollDoneRef.current = false;
    inferringRef.current = false;
    setGateStatus("idle");
  }, []);

  return { gateStatus, start, stop };
}
