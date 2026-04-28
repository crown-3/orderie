"use client";

import { useState, useEffect } from "react";
import { useRealtimeVoice } from "./_hooks/useRealtimeVoice";
import CharacterSection from "./_components/character";
import UISection from "./_components/ui";
import OverlaySection from "./_components/overlay";

export default function Home() {
  const {
    status,
    start,
    stop,
    commitSpeech,
    audioLevel,
    transcriptChunks,
    userTranscriptChunks,
    displayedMenuIds,
    cartItems,
    updateCartItem,
    isPaymentGuideVisible,
    triggerOrderComplete,
    tpm,
  } = useRealtimeVoice();

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
          commitSpeech={commitSpeech}
          audioLevel={audioLevel}
          transcriptChunks={transcriptChunks}
          userTranscriptChunks={userTranscriptChunks}
          isCartMode={isCartMode}
        />
      </div>
      <UISection
        displayedMenuIds={displayedMenuIds}
        cartItems={cartItems}
        onUpdateCartItem={updateCartItem}
        onOrder={handleOrder}
        isOrdering={isPaymentActive}
        isPaymentComplete={isPaymentComplete}
      />
      <OverlaySection isVisible={isPaymentActive} tpm={tpm} />
    </main>
  );
}
