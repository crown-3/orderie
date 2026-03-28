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

interface CharacterSectionProps {
  status: VoiceStatus;
  start: () => void;
  stop: () => void;
  audioLevel: number;
  transcriptChunks: string[];
  userTranscriptChunks: string[];
  isCartMode: boolean;
}

const BUTTON_LABEL: Record<string, string> = {
  idle: "Start Talking",
  connecting: "Connecting…",
  connected: "Stop",
  error: "Retry",
};

const BUTTON_CLASS: Record<string, string> = {
  idle: "bg-blue-500 hover:bg-blue-600",
  connecting: "bg-gray-400 cursor-not-allowed",
  connected: "bg-red-500 hover:bg-red-600",
  error: "bg-orange-500 hover:bg-orange-600",
};

// line-height for leading-tight (1.25) at each font size, × 4 lines
const LINE_HEIGHT_LONG = 36 * 1.25 * 4;  // 180px
const LINE_HEIGHT_SHORT = 48 * 1.25 * 4; // 240px

const TEXT_LONG_THRESHOLD = 35;

const CharacterSection = ({
  status,
  start,
  stop,
  audioLevel,
  transcriptChunks,
  userTranscriptChunks,
  isCartMode,
}: CharacterSectionProps) => {
  const { faceOffset, pupilX } = useIdleAnimation();
  const isActive = status === "connected" || status === "connecting";

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
        <div className="flex flex-col items-center gap-4">
          <Face audioLevel={audioLevel} pupilX={pupilX} faceOffset={faceOffset} />

          {/* Voice control */}
          <button
            onClick={isActive ? stop : start}
            disabled={status === "connecting"}
            className={`px-6 py-3 rounded-full text-white font-medium transition-colors ${BUTTON_CLASS[status]}`}
          >
            {BUTTON_LABEL[status]}
          </button>
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
    </section>
  );
};

export default CharacterSection;
