"use client";

import { useState, useEffect, useCallback } from "react";
import { useRealtimeVoice } from "./_hooks/useRealtimeVoice";
import { PRESENTATION_IMAGE_KEYS } from "./assets/presentations";
import CharacterSection from "./_components/character";
import UISection from "./_components/ui";
import OverlaySection from "./_components/overlay";

export default function Home() {
  const {
    status,
    start,
    stop,
    mute,
    commitSpeech,
    setTranscriptEnabled,
    audioLevel,
    transcriptChunks,
    userTranscriptChunks,
    displayedMenuIds,
    cartItems,
    updateCartItem,
    isPaymentGuideVisible,
    triggerOrderComplete,
    tpm,
    presentationImage,
    setPresentationImage,
  } = useRealtimeVoice();

  const navigatePresentation = useCallback((dir: "prev" | "next" | "close") => {
    setPresentationImage((current) => {
      if (dir === "close") return null;
      const idx = current ? PRESENTATION_IMAGE_KEYS.indexOf(current) : -1;
      if (dir === "prev") return idx <= 0 ? PRESENTATION_IMAGE_KEYS[PRESENTATION_IMAGE_KEYS.length - 1] : PRESENTATION_IMAGE_KEYS[idx - 1];
      return idx >= PRESENTATION_IMAGE_KEYS.length - 1 ? PRESENTATION_IMAGE_KEYS[0] : PRESENTATION_IMAGE_KEYS[idx + 1];
    });
  }, [setPresentationImage]);

  const [isOrdering, setIsOrdering] = useState(false);
  const [isPaymentComplete, setIsPaymentComplete] = useState(false);

  const isPaymentActive = isOrdering || isPaymentGuideVisible;

  // Hide overlay after 5 s, clear cart, trigger AI thank-you, show completion banner.
  useEffect(() => {
    if (!isPaymentActive) return;
    const timer = setTimeout(() => {
      setIsOrdering(false);
      triggerOrderComplete();
      setIsPaymentComplete(true);
    }, 15000);
    return () => clearTimeout(timer);
  }, [isPaymentActive, triggerOrderComplete]);

  // Clear completion banner when a new session starts.
  useEffect(() => {
    if (status === "connecting") setIsPaymentComplete(false);
  }, [status]);

  const handleOrder = () => {
    setIsOrdering(true);
  };

  const isCartMode = cartItems.length > 0;

  return (
    <main className="w-full h-[100dvh] flex relative">
      <div
        className={`transition-[height] duration-500 overflow-hidden min-h-0 flex-1`}
      >
        <CharacterSection
          status={status}
          start={start}
          stop={stop}
          mute={mute}
          commitSpeech={commitSpeech}
          setTranscriptEnabled={setTranscriptEnabled}
          audioLevel={audioLevel}
          transcriptChunks={transcriptChunks}
          userTranscriptChunks={userTranscriptChunks}
          isCartMode={isCartMode}
          onPresentationNavigate={navigatePresentation}
        />
      </div>
      <UISection
        displayedMenuIds={displayedMenuIds}
        cartItems={cartItems}
        onUpdateCartItem={updateCartItem}
        onOrder={handleOrder}
        isOrdering={isPaymentActive}
        isPaymentComplete={isPaymentComplete}
        presentationImage={presentationImage}
      />
      <OverlaySection isVisible={isPaymentActive} tpm={tpm} />
    </main>
  );
}
