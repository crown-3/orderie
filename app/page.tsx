"use client";

import { useRealtimeVoice } from "./_hooks/useRealtimeVoice";
import CharacterSection from "./_components/character";
import UISection from "./_components/ui";

export default function Home() {
  const {
    status,
    start,
    stop,
    audioLevel,
    transcriptChunks,
    userTranscriptChunks,
    displayedMenuIds,
    cartItems,
    updateCartItem,
  } = useRealtimeVoice();

  const isCartMode = cartItems.length > 0;

  return (
    <main className="w-full h-[100dvh] flex flex-col">
      <div
        className={`transition-all duration-500 overflow-hidden min-h-0 ${isCartMode ? "h-[600px]" : "flex-1"}`}
      >
        <CharacterSection
          status={status}
          start={start}
          stop={stop}
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
      />
    </main>
  );
}
