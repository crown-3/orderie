"use client";

import { useEffect, useRef, useState } from "react";
import { VoiceStatus } from "@/_hooks/useRealtimeVoice";
import { useIdleAnimation } from "./hooks/useIdleAnimation";
import Face from "./components/face";
import { SpeakerWaveIcon } from "@heroicons/react/20/solid";

/**
 * Keeps the last non-empty chunks visible for `fadeMs` after the source goes
 * empty, so a fade-out animation can play before the element is removed.
 */
function useTranscriptDisplay(chunks: string[], fadeMs = 500) {
  const [display, setDisplay] = useState<string[]>([]);
  const [fading, setFading] = useState(false);
  const hasContentRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (chunks.length > 0) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      setDisplay(chunks);
      setFading(false);
      hasContentRef.current = true;
    } else if (hasContentRef.current) {
      hasContentRef.current = false;
      setFading(true);
      timerRef.current = setTimeout(() => {
        setDisplay([]);
        setFading(false);
        timerRef.current = null;
      }, fadeMs);
    }
  }, [chunks]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { display, fading };
}

const IS_PTT                    = process.env.NEXT_PUBLIC_INPUT_MODE === "ptt";
const IS_DEBUG                  = process.env.NEXT_PUBLIC_DEBUG === "true";
const DISABLE_USER_TRANSCRIPT   = process.env.NEXT_PUBLIC_DISABLE_USER_TRANSCRIPT === "true";
const KEY_COMMIT   = process.env.NEXT_PUBLIC_KEY_COMMIT   ?? "a";
const KEY_SLEEP    = process.env.NEXT_PUBLIC_KEY_SLEEP    ?? "k";
const KEY_WAKE     = process.env.NEXT_PUBLIC_KEY_WAKE     ?? "l";
const KEY_WINK     = process.env.NEXT_PUBLIC_KEY_WINK     ?? "j";
const KEY_CENTER   = process.env.NEXT_PUBLIC_KEY_CENTER   ?? "c";
const KEY_PT_PREV  = process.env.NEXT_PUBLIC_KEY_PT_PREV  ?? "d";
const KEY_PT_NEXT  = process.env.NEXT_PUBLIC_KEY_PT_NEXT  ?? "f";
const KEY_PT_CLOSE = process.env.NEXT_PUBLIC_KEY_PT_CLOSE ?? "x";

interface CharacterSectionProps {
  status: VoiceStatus;
  start: () => void;
  stop: () => void;
  mute: (muted: boolean) => void;
  commitSpeech: () => void;
  setTranscriptEnabled: (enabled: boolean) => void;
  audioLevel: number;
  transcriptChunks: string[];
  userTranscriptChunks: string[];
  isCartMode: boolean;
  onPresentationNavigate?: (dir: "prev" | "next" | "close") => void;
}

// line-height for leading-tight (1.25) at each font size, × 4 lines
const LINE_HEIGHT_LONG = 36 * 1.25 * 4;  // 180px
const LINE_HEIGHT_SHORT = 48 * 1.25 * 4; // 240px

const TEXT_LONG_THRESHOLD = 35;

const CharacterSection = ({
  status,
  start,
  stop,
  mute,
  commitSpeech,
  setTranscriptEnabled,
  audioLevel,
  transcriptChunks,
  userTranscriptChunks,
  isCartMode,
  onPresentationNavigate,
}: CharacterSectionProps) => {
  const { faceOffset } = useIdleAnimation();
  const isActive = status === "connected" || status === "connecting";

  const [pupilX, setPupilX] = useState(0);
  const [pupilY, setPupilY] = useState(0);
  const [isSleeping, setIsSleeping] = useState(false);
  const [isWinking, setIsWinking] = useState(false);
  const winkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [debugToast, setDebugToast] = useState<{ key: string; desc: string; id: number } | null>(null);
  const [toastFading, setToastFading] = useState(false);
  const debugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debugFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showDebugToast(key: string, desc: string) {
    if (!IS_DEBUG) return;
    if (debugTimerRef.current) clearTimeout(debugTimerRef.current);
    if (debugFadeTimerRef.current) clearTimeout(debugFadeTimerRef.current);
    setToastFading(false);
    setDebugToast({ key, desc, id: Date.now() });
    debugTimerRef.current = setTimeout(() => {
      setToastFading(true);
      debugFadeTimerRef.current = setTimeout(() => {
        setDebugToast(null);
        setToastFading(false);
      }, 500);
    }, 2000);
  }

  // In PTT mode, mute mic and disable STT as soon as the session is ready.
  // When user transcript is disabled, also suppress STT regardless of input mode.
  useEffect(() => {
    if (status === "connected") {
      if (IS_PTT) {
        mute(true);
        setTranscriptEnabled(false);
      } else if (DISABLE_USER_TRANSCRIPT) {
        setTranscriptEnabled(false);
      }
    }
  }, [status, mute, setTranscriptEnabled]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === KEY_COMMIT && status === "connected") {
        if (IS_PTT) {
          if (!e.repeat) {
            mute(false);
            if (!DISABLE_USER_TRANSCRIPT) setTranscriptEnabled(true);
            showDebugToast(KEY_COMMIT.toUpperCase(), "말하는 중...");
          }
        } else {
          commitSpeech();
          if (!e.repeat) showDebugToast(KEY_COMMIT.toUpperCase(), "AI 즉시 응답");
        }
      }
      if (e.key === KEY_SLEEP) {
        setIsSleeping(true);
        if (!e.repeat) showDebugToast(KEY_SLEEP.toUpperCase(), "수면 모드 켜기");
      }
      if (e.key === KEY_WAKE) {
        setIsSleeping(false);
        if (!e.repeat) showDebugToast(KEY_WAKE.toUpperCase(), "수면 모드 끄기");
      }
      if (e.key === KEY_WINK) {
        if (winkTimerRef.current) clearTimeout(winkTimerRef.current);
        setIsWinking(true);
        const audio = new Audio("/bell.mp3");
        audio.play().catch(() => {});
        winkTimerRef.current = setTimeout(() => {
          setIsWinking(false);
          winkTimerRef.current = null;
        }, 600);
        if (!e.repeat) showDebugToast(KEY_WINK.toUpperCase(), "윙크");
      }
      if (e.key === KEY_CENTER) {
        setPupilX(0);
        setPupilY(0);
        if (!e.repeat) showDebugToast(KEY_CENTER.toUpperCase(), "시선 정면");
      }
      if (e.key === KEY_PT_PREV) {
        if (!e.repeat) { onPresentationNavigate?.("prev"); showDebugToast(KEY_PT_PREV.toUpperCase(), "이전 슬라이드"); }
      }
      if (e.key === KEY_PT_NEXT) {
        if (!e.repeat) { onPresentationNavigate?.("next"); showDebugToast(KEY_PT_NEXT.toUpperCase(), "다음 슬라이드"); }
      }
      if (e.key === KEY_PT_CLOSE) {
        if (!e.repeat) { onPresentationNavigate?.("close"); showDebugToast(KEY_PT_CLOSE.toUpperCase(), "슬라이드 닫기"); }
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        if (!e.repeat) {
          const dirMap: Record<string, [number, number, string, string]> = {
            ArrowLeft:  [-100,    0, "←", "시선 왼쪽"],
            ArrowRight: [ 100,    0, "→", "시선 오른쪽"],
            ArrowUp:    [   0, -100, "↑", "시선 위"],
            ArrowDown:  [   0,  100, "↓", "시선 아래"],
          };
          const [dx, dy, k, d] = dirMap[e.key];
          setPupilX(dx);
          setPupilY(dy);
          showDebugToast(k, d);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === KEY_COMMIT && IS_PTT && status === "connected") {
        commitSpeech();
        mute(true);
        setTranscriptEnabled(false);
        showDebugToast(KEY_COMMIT.toUpperCase(), "AI 응답 중...");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [status, commitSpeech, mute, setTranscriptEnabled]);

  useEffect(() => () => {
    if (winkTimerRef.current) clearTimeout(winkTimerRef.current);
    if (debugTimerRef.current) clearTimeout(debugTimerRef.current);
    if (debugFadeTimerRef.current) clearTimeout(debugFadeTimerRef.current);
  }, []);

  const { display: aiDisplay, fading: aiFading } = useTranscriptDisplay(transcriptChunks);
  const { display: userDisplay, fading: userFading } = useTranscriptDisplay(userTranscriptChunks);

  const aiTextLong = aiDisplay.join("").length > TEXT_LONG_THRESHOLD;
  const userTextLong = userDisplay.join("").length > TEXT_LONG_THRESHOLD;

  const aiClipHeight = aiTextLong ? LINE_HEIGHT_LONG : LINE_HEIGHT_SHORT;
  const userClipHeight = userTextLong ? LINE_HEIGHT_LONG : LINE_HEIGHT_SHORT;

  return (
    <section className="w-full h-full relative flex justify-center items-center bg-[#E87F07]">
      {aiDisplay.length > 0 && (
        <div className={`absolute top-0 w-full h-[335px] z-30 ${aiFading ? "animate-fade-out" : ""}`}>
          {/* Gradient background */}
          <div
            className="absolute inset-0 animate-fade-top-to-bottom"
            style={{
              background:
                "linear-gradient(0deg, rgba(217, 217, 217, 0.00) 0%, rgba(255, 255, 255, 0.80) 90.38%)",
            }}
          />

          {/* Text content */}
          <div className="relative">
            <div className="flex items-center gap-2 mt-7 ml-6">
              <SpeakerWaveIcon className="w-7 mb-1" />
              <p className="font-bold text-2xl">주문돌이가 말하고 있어요</p>
            </div>

            {/* Flexible clip: grows with text up to 4 lines, then clips from top */}
            <div
              className="overflow-hidden flex flex-col justify-end ml-6 mt-2 w-5/6"
              style={{ maxHeight: `${aiClipHeight}px` }}
            >
              <p
                className="font-bold leading-tight tracking-tight transition-[font-size] duration-300 ease-out"
                style={{ fontSize: aiTextLong ? "36px" : "48px" }}
              >
                {aiDisplay.map((chunk, i) => (
                  <span key={i} className="inline-block whitespace-pre animate-text-slide-fade-in">
                    {chunk}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>
      )}

      {!isCartMode && (
        <div className="relative">
          <div
            onClick={status === "connecting" ? undefined : isActive ? stop : start}
            className={status === "connecting" ? "cursor-not-allowed" : "cursor-pointer"}
          >
            <Face audioLevel={audioLevel} pupilX={pupilX} pupilY={pupilY} faceOffset={faceOffset} isConnected={status === "connected"} isSleeping={isSleeping} isWinking={isWinking} />
          </div>

          {(status === "idle" || isSleeping) && (
            <>
              {[
                { label: "z", size: 22, delay: 0 },
                { label: "Z", size: 36, delay: 1 },
                { label: "Z", size: 52, delay: 2 },
              ].map(({ label, size, delay }, i) => (
                <span
                  key={i}
                  className="absolute pointer-events-none font-black text-white select-none"
                  style={{
                    fontSize: size,
                    left: "65%",
                    top: "10%",
                    animation: `sleep-z 3s ${delay}s ease-in-out infinite`,
                    opacity: 0,
                  }}
                >
                  {label}
                </span>
              ))}
            </>
          )}
        </div>
      )}

      {userDisplay.length > 0 && (
        <div className={`absolute bottom-0 w-full h-[335px] flex flex-col justify-end items-end z-30 ${userFading ? "animate-fade-out" : ""}`}>
          {/* Gradient background */}
          <div
            className="absolute inset-0 animate-fade-bottom-to-top"
            style={{
              background:
                "linear-gradient(180deg, rgba(217, 217, 217, 0.00) 0%, rgba(255, 255, 255, 0.80) 90.38%)",
            }}
          />

          {/* Text content */}
          <div className="relative flex flex-col items-end">
            <div className="flex items-center gap-4 mb-2 mr-6">
              <div className="ml-1 w-3 h-3 relative">
                <div className="absolute w-3 h-3 rounded-full bg-[#000] animate-ping" />
                <div className="absolute w-3 h-3 rounded-full bg-[#000]" />
              </div>
              <p className="font-bold text-2xl">주문돌이가 당신의 말을 듣고 있어요</p>
            </div>

            {/* Flexible clip: grows with text up to 4 lines, then clips from top */}
            <div
              className="overflow-hidden flex flex-col justify-end mr-7 mb-6 w-5/6"
              style={{ maxHeight: `${userClipHeight}px` }}
            >
              {/* Single accumulated string — no inline-block so it wraps naturally */}
              <p
                className="text-right font-bold leading-tight tracking-tight whitespace-pre-wrap break-words transition-[font-size] duration-300 ease-out animate-text-slide-fade-in"
                style={{ fontSize: userTextLong ? "36px" : "48px" }}
              >
                {userDisplay.join("")}
              </p>
            </div>
          </div>
        </div>
      )}
      {debugToast && (
        <div
          key={debugToast.id}
          className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none whitespace-nowrap ${toastFading ? "animate-fade-out" : ""}`}
        >
          <div className="bg-black/80 text-white px-5 py-3 rounded-2xl font-bold backdrop-blur-md flex items-center gap-3 shadow-2xl">
            <kbd className="bg-white/20 border border-white/30 px-3 py-1 rounded-lg font-mono text-xl min-w-[2.5rem] text-center">
              {debugToast.key}
            </kbd>
            <span className="text-xl">{debugToast.desc}</span>
          </div>
        </div>
      )}
    </section>
  );
};

export default CharacterSection;
