"use client";

import { useState, useEffect, useCallback } from "react";
import { useRealtimeVoice } from "./_hooks/useRealtimeVoice";
import KioskScreen from "./_components/kiosk";

export default function Home() {
  const {
    status,
    isListening,
    start,
    stop,
    audioLevel,
    transcriptChunks,
    userTranscriptChunks,
    activeCategory,
    setActiveCategory,
    optionMenuId,
    optionSelection,
    setOptionSelection,
    openOptions,
    closeOptions,
    cartItems,
    updateCartItem,
    addConfiguredItem,
    clearCart,
    showCart,
    setShowCart,
    isPaymentGuideVisible,
    setIsPaymentGuideVisible,
    triggerOrderComplete,
  } = useRealtimeVoice();

  const [isOrdering, setIsOrdering] = useState(false);
  const [isPaymentComplete, setIsPaymentComplete] = useState(false);

  const isPaymentActive = isOrdering || isPaymentGuideVisible;

  // Entry point into voice mode. Connecting must be triggered by a user gesture
  // (tapping the mic) so the browser reliably grants microphone access — a
  // getUserMedia call on page load is typically blocked.
  const toggleVoice = useCallback(() => {
    if (status === "connected" || status === "connecting") stop();
    else start();
  }, [status, start, stop]);

  // Add the configured item to the cart; optionally proceed straight to payment.
  const addToCart = useCallback(() => {
    if (optionMenuId) addConfiguredItem(optionMenuId, optionSelection);
  }, [optionMenuId, optionSelection, addConfiguredItem]);

  const checkoutNow = useCallback(() => {
    if (optionMenuId) addConfiguredItem(optionMenuId, optionSelection);
    setShowCart(false);
    setIsOrdering(true);
  }, [optionMenuId, optionSelection, addConfiguredItem, setShowCart]);

  const checkoutFromCart = useCallback(() => {
    setShowCart(false);
    setIsOrdering(true);
  }, [setShowCart]);

  // After payment starts: hold the guide for 15s, clear the cart, trigger the
  // AI thank-you, then show the completion banner.
  useEffect(() => {
    if (!isPaymentActive) return;
    const timer = setTimeout(() => {
      setIsOrdering(false);
      setIsPaymentGuideVisible(false);
      triggerOrderComplete();
      setIsPaymentComplete(true);
    }, 15000);
    return () => clearTimeout(timer);
  }, [isPaymentActive, triggerOrderComplete, setIsPaymentGuideVisible]);

  // Clear the completion banner when a new session starts.
  useEffect(() => {
    if (status === "connecting") setIsPaymentComplete(false);
  }, [status]);

  return (
    <KioskScreen
      status={status}
      onToggleVoice={toggleVoice}
      isListening={isListening}
      audioLevel={audioLevel}
      aiTranscript={transcriptChunks.join("")}
      userTranscript={userTranscriptChunks.join("")}
      activeCategory={activeCategory}
      onSelectCategory={setActiveCategory}
      onSelectMenu={(id) => openOptions(id)}
      optionMenuId={optionMenuId}
      optionSelection={optionSelection}
      onChangeOptionSelection={setOptionSelection}
      onAddToCart={addToCart}
      onCheckoutNow={checkoutNow}
      onCloseOptions={closeOptions}
      cartItems={cartItems}
      showCart={showCart}
      onOpenCart={() => setShowCart(true)}
      onCloseCart={() => setShowCart(false)}
      onCancelCart={clearCart}
      onUpdateCartItem={updateCartItem}
      onCheckout={checkoutFromCart}
      isPaymentActive={isPaymentActive}
      isPaymentComplete={isPaymentComplete}
    />
  );
}
