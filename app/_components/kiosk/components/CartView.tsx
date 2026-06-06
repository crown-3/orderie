import { MinusIcon, PlusIcon, ChevronLeftIcon } from "@heroicons/react/24/solid";
import type { CartItem } from "@/_hooks/useRealtimeVoice";
import { getMenu, unitPrice, won } from "../_menus";

interface Props {
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onBack: () => void;
  onCancel: () => void;
  onCheckout: () => void;
  /** AI's live spoken response, shown as a caption. */
  aiTranscript: string;
}

/**
 * Cart screen ("장바구니"). Renders on the brand-blue background with white item
 * cards and the 취소 / 결제하기 actions, matching the Figma direction.
 */
const CartView = ({
  items,
  onUpdateQuantity,
  onBack,
  onCancel,
  onCheckout,
  aiTranscript,
}: Props) => {
  const rows = items
    .map((item) => ({ item, menu: getMenu(item.id) }))
    .filter((r): r is { item: CartItem; menu: NonNullable<ReturnType<typeof getMenu>> } =>
      Boolean(r.menu),
    );

  const total = rows.reduce(
    (sum, { item, menu }) => sum + unitPrice(menu, item.selectedOptions) * item.quantity,
    0,
  );

  return (
    <div className="flex-1 min-h-0 bg-brand flex flex-col px-7 pt-2 pb-7">
      <div className="flex items-center gap-2 mb-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="메뉴로 돌아가기"
          className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white"
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <h1 className="text-white font-bold text-[34px] tracking-[-0.8px]">장바구니</h1>
      </div>
      <p className="text-white/80 text-[18px] leading-snug mb-4 min-h-[24px] pl-1">
        {aiTranscript.trim()}
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 auto-rows-min gap-4 content-start">
        {rows.map(({ item, menu }) => (
          <div key={item.id} className="bg-white rounded-[16px] p-5 flex flex-col">
            <p className="font-bold text-brand-deep text-[22px] tracking-[-0.6px] leading-tight">
              {menu.name}
            </p>
            <p className="text-ink/50 font-medium text-[17px] mt-1 min-h-[24px]">
              {item.selectedOptions?.length
                ? item.selectedOptions.join(" / ")
                : menu.description}
            </p>
            <div className="h-px bg-black/10 my-3" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-ink">
                <span className="text-[15px] font-bold">수량</span>
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                  className="w-7 h-7 rounded-full bg-black/5 flex items-center justify-center"
                  aria-label="수량 줄이기"
                >
                  <MinusIcon className="w-4 h-4" />
                </button>
                <span className="text-[18px] font-bold w-5 text-center tabular-nums">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                  className="w-7 h-7 rounded-full bg-black/5 flex items-center justify-center"
                  aria-label="수량 늘리기"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
              <p className="font-bold text-price text-[22px]">
                {won(unitPrice(menu, item.selectedOptions) * item.quantity)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 text-white font-bold mt-4 mb-3">
        <span className="text-[22px]">합계</span>
        <span className="text-[40px] leading-none">{won(total)}</span>
      </div>

      <div className="grid grid-cols-2 gap-5 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border-[3px] border-white text-white font-bold text-[28px] py-4"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onCheckout}
          className="rounded-full bg-white text-brand font-bold text-[28px] py-4"
        >
          결제하기
        </button>
      </div>
    </div>
  );
};

export default CartView;
