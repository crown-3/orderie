import { useState, useRef, useCallback } from "react";

type SonioxToken = { text: string; speaker?: number };

export function useSonioxSTT() {
  const [userTranscriptChunks, setUserTranscriptChunks] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fullTextRef = useRef("");
  const speechStartBaseRef = useRef(0);
  const utteranceAccumulatedRef = useRef("");
  // The speaker ID of the first person who speaks — treated as the main orderer.
  // Secondary defence on top of the audio-level voice gate.
  const mainSpeakerRef = useRef<number | null>(null);

  // Call when OpenAI VAD fires input_audio_buffer.speech_started.
  const onSpeechStarted = useCallback(() => {
    speechStartBaseRef.current = fullTextRef.current.length;
    utteranceAccumulatedRef.current = "";
    setUserTranscriptChunks([]);
  }, []);

  /**
   * @param apiKey  Soniox API key
   * @param stream  Already-gated MediaStream from useSpeakerGate.
   *                The gate owns the mic track lifecycle; we do not stop it here.
   */
  const start = useCallback(async (apiKey: string, stream: MediaStream) => {
    fullTextRef.current = "";
    speechStartBaseRef.current = 0;
    utteranceAccumulatedRef.current = "";
    mainSpeakerRef.current = null;

    const ws = new WebSocket("wss://stt-rt.soniox.com/transcribe-websocket");
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          api_key: apiKey,
          model: "stt-rt-v4",
          audio_format: "auto",
          language_hints: ["ko"],
          enable_speaker_diarization: true,
        }),
      );
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          e.data.arrayBuffer().then((buf) => ws.send(buf));
        }
      });
      recorder.start(100);
    });

    ws.addEventListener("message", (evt) => {
      const msg = JSON.parse(evt.data as string);
      if (!Array.isArray(msg.tokens)) return;

      const tokens = msg.tokens as SonioxToken[];

      // Lock in the first speaker who produces real speech as the main orderer.
      if (mainSpeakerRef.current === null) {
        for (const t of tokens) {
          if (t.text !== "<end>" && t.text !== "<fin>" && t.speaker !== undefined) {
            mainSpeakerRef.current = t.speaker;
            break;
          }
        }
      }

      // Filter out tokens from other speakers. Tokens without a speaker field
      // (e.g. control tokens) are kept.
      const relevantTokens =
        mainSpeakerRef.current !== null
          ? tokens.filter((t) => t.speaker === undefined || t.speaker === mainSpeakerRef.current)
          : tokens;

      const hasFin = relevantTokens.some((t) => t.text === "<fin>");
      const fullText = relevantTokens
        .filter((t) => t.text !== "<end>" && t.text !== "<fin>")
        .map((t) => t.text)
        .join("");

      if (hasFin) {
        utteranceAccumulatedRef.current += fullText.slice(speechStartBaseRef.current);
        speechStartBaseRef.current = 0;
        fullTextRef.current = "";
      } else {
        fullTextRef.current = fullText;
      }

      const display = utteranceAccumulatedRef.current + fullText.slice(speechStartBaseRef.current);
      setUserTranscriptChunks(display ? [display] : []);
    });

    ws.addEventListener("error", (e) => console.error("Soniox WebSocket error:", e));
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    // Note: mic stream lifecycle is owned by useSpeakerGate — not stopped here.
    fullTextRef.current = "";
    speechStartBaseRef.current = 0;
    utteranceAccumulatedRef.current = "";
    mainSpeakerRef.current = null;
    setUserTranscriptChunks([]);
  }, []);

  return { userTranscriptChunks, onSpeechStarted, start, stop };
}
