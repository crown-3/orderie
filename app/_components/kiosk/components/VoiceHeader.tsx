import { MicrophoneIcon } from "@heroicons/react/24/solid";
import type { VoiceStatus } from "@/_hooks/useRealtimeVoice";
import Logo from "./Logo";

interface Props {
  status: VoiceStatus;
  isListening: boolean;
  audioLevel: number;
  /** Latest thing the user said, used as the ambient prompt when connected. */
  userQuote?: string;
  /** Tap the mic to start (idle/error) or stop (connected) the voice session. */
  onToggle: () => void;
  /** Dark variant for use on the brand-blue cart background. */
  onBrand?: boolean;
}

/**
 * Top bar: a tap-to-start mic + voice status on the left, mowiki logo on the
 * right. The mic is the entry point into voice mode — connecting requires a
 * user gesture so the browser reliably grants microphone access.
 */
const VoiceHeader = ({
  status,
  isListening,
  audioLevel,
  userQuote,
  onToggle,
  onBrand = false,
}: Props) => {
  const connected = status === "connected";

  const statusText =
    status === "connecting"
      ? "연결 중…"
      : status === "error"
        ? "연결에 실패했어요 · 마이크를 눌러 다시 시도"
        : status === "idle"
          ? "마이크를 눌러 음성 주문을 시작하세요"
          : isListening
            ? "듣고 있어요"
            : userQuote
              ? `"${userQuote}"`
              : "무엇을 도와드릴까요?";

  const accent = onBrand ? "text-white" : "text-brand";
  // Only show the "speaking" pulse on real speech (VAD) or a loud signal —
  // a high audioLevel floor keeps ambient room noise from triggering it.
  const active = connected && (isListening || audioLevel > 0.3);

  return (
    <header className="flex items-center justify-between px-8 pt-8 pb-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggle}
          disabled={status === "connecting"}
          aria-label={connected ? "음성 주문 종료" : "음성 주문 시작"}
          className="relative inline-flex items-center justify-center shrink-0 w-12 h-12 rounded-full transition-opacity disabled:opacity-60"
        >
          {active && (
            <span
              className={`absolute inline-block rounded-full ${onBrand ? "bg-white" : "bg-brand"} animate-mic-pulse`}
              style={{ width: 40, height: 40 }}
            />
          )}
          <MicrophoneIcon
            className={`relative w-8 h-8 ${accent} ${connected ? "" : "opacity-40"}`}
          />
        </button>
        <p
          className={`truncate font-bold text-[28px] tracking-[-0.7px] ${accent} ${connected ? "" : "opacity-70"}`}
        >
          {statusText}
        </p>
      </div>
      <Logo className={`text-[32px] ${onBrand ? "text-white" : ""}`} />
    </header>
  );
};

export default VoiceHeader;
