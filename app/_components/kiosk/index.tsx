import VoiceHeader from "./components/VoiceHeader";
import CategoryTabs from "./components/CategoryTabs";
import MenuGrid from "./components/MenuGrid";
import AnswerPanel from "./components/AnswerPanel";
import OptionModal from "./components/OptionModal";
import CartView from "./components/CartView";
import CartBar from "./components/CartBar";
import PaymentGuide from "./components/PaymentGuide";
import { CATEGORIES, getMenu, unitPrice } from "./_menus";
import type { CartItem, VoiceStatus } from "@/_hooks/useRealtimeVoice";

interface Props {
  status: VoiceStatus;
  onToggleVoice: () => void;
  isListening: boolean;
  audioLevel: number;
  /** AI's live spoken answer (accumulated transcript). */
  aiTranscript: string;
  /** User's latest spoken utterance. */
  userTranscript: string;
  activeCategory: string | null;
  onSelectCategory: (category: string) => void;
  /** Tapping a menu card opens its option/confirm modal. */
  onSelectMenu: (id: string) => void;
  // Option modal
  optionMenuId: string | null;
  optionSelection: string[];
  onChangeOptionSelection: (labels: string[]) => void;
  onAddToCart: () => void;
  onCheckoutNow: () => void;
  onCloseOptions: () => void;
  // Cart
  cartItems: CartItem[];
  showCart: boolean;
  onOpenCart: () => void;
  onCloseCart: () => void;
  onCancelCart: () => void;
  onUpdateCartItem: (id: string, quantity: number) => void;
  onCheckout: () => void;
  // Payment
  isPaymentActive: boolean;
  isPaymentComplete: boolean;
}

/**
 * The single full-screen kiosk surface. Browsing stays put as the cart fills;
 * the cart, option modal, payment guide, and completion banner layer on top —
 * all driven by voice, with full manual (touch) fallbacks.
 */
const KioskScreen = ({
  status,
  onToggleVoice,
  isListening,
  audioLevel,
  aiTranscript,
  userTranscript,
  activeCategory,
  onSelectCategory,
  onSelectMenu,
  optionMenuId,
  optionSelection,
  onChangeOptionSelection,
  onAddToCart,
  onCheckoutNow,
  onCloseOptions,
  cartItems,
  showCart,
  onOpenCart,
  onCloseCart,
  onCancelCart,
  onUpdateCartItem,
  onCheckout,
  isPaymentActive,
  isPaymentComplete,
}: Props) => {
  const userQuote = userTranscript.trim() || undefined;
  const isCartView = showCart && cartItems.length > 0;

  const cartCount = cartItems.reduce((n, i) => n + i.quantity, 0);
  const cartTotal = cartItems.reduce((sum, i) => {
    const menu = getMenu(i.id);
    return menu ? sum + unitPrice(menu, i.selectedOptions) * i.quantity : sum;
  }, 0);

  return (
    <main
      className={`relative w-full h-[100dvh] overflow-hidden flex flex-col ${
        isCartView ? "bg-brand" : "bg-white"
      }`}
    >
      <VoiceHeader
        status={status}
        onToggle={onToggleVoice}
        isListening={isListening}
        audioLevel={audioLevel}
        userQuote={userQuote}
        onBrand={isCartView}
      />

      {isCartView ? (
        <CartView
          items={cartItems}
          onUpdateQuantity={onUpdateCartItem}
          onBack={onCloseCart}
          onCancel={onCancelCart}
          onCheckout={onCheckout}
          aiTranscript={aiTranscript}
        />
      ) : (
        <>
          <AnswerPanel question={userQuote} answer={aiTranscript} />
          <CategoryTabs
            categories={CATEGORIES}
            active={activeCategory ?? CATEGORIES[0]}
            onSelect={onSelectCategory}
          />
          <MenuGrid
            activeCategory={activeCategory}
            onSelectMenu={onSelectMenu}
          />
          {cartItems.length > 0 && (
            <CartBar itemCount={cartCount} total={cartTotal} onOpen={onOpenCart} />
          )}
        </>
      )}

      {optionMenuId && !isCartView && (
        <OptionModal
          menuId={optionMenuId}
          selected={optionSelection}
          onChangeSelection={onChangeOptionSelection}
          onAddToCart={onAddToCart}
          onCheckoutNow={onCheckoutNow}
          onClose={onCloseOptions}
          aiTranscript={aiTranscript}
          userQuote={userQuote}
        />
      )}

      {isPaymentActive && <PaymentGuide />}

      {/* "주문 완료!" — fades in over everything after payment */}
      <div
        className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-700 bg-white"
        style={{
          opacity: isPaymentComplete ? 1 : 0,
          transitionDelay: isPaymentComplete ? "300ms" : "0ms",
        }}
      >
        <p className="text-brand text-7xl font-bold tracking-tight">주문 완료!</p>
      </div>
    </main>
  );
};

export default KioskScreen;
